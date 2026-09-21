import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import type {
  Express,
  RequestHandler,
  Request,
  Response,
  NextFunction,
} from "express";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { storage, supabase as serverSupabase } from "./storage";
import { captureDemandParent } from "./demandCapture";
import {
  normalizeProductionLinkCode,
  normalizeProductionPipeline,
  validateProductionLinkForRole,
} from "@shared/productionLinks";
import { getDefaultDashboardRoute } from "@shared/portals";
import { getAllowedOdEmailList, isAllowedOdEmail, normalizeEmail } from "@shared/odAccess";
import { isEmergencyDbMode } from "./emergencyMode";
import {
  authenticateEmergencyUser,
  createEmergencyTutorAccount,
  emergencyExpectedRoleMatches,
} from "./emergencyAuth";
import {
  describeRuntimeDatabaseTarget,
  describeSupabaseApiTarget,
  getDatabasePoolStats,
  pool,
  sessionPool,
} from "./db";

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
  throw new Error("Missing Supabase environment variables");
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY,
);

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const isVercelRuntime = process.env.VERCEL === "1";
  
  let sessionStore;
  
  // Use PostgreSQL for persistent session storage if DATABASE_URL is available
  if (process.env.DATABASE_URL) {
    try {
      const PgSession = connectPg(session);
      
      // Keep session persistence isolated from application-query capacity.
      // Both pools use the normalized transaction-pooler target, while the
      // session pool stays deliberately small.
      sessionStore = new PgSession({
        pool: sessionPool,
        tableName: "sessions",
        createTableIfMissing: false, // Table already exists from schema
        // Serverless instances are short-lived; background pruning timers can
        // outlive the request and surface pool errors after the response path.
        pruneSessionInterval: isVercelRuntime ? false : 900,
        errorLog: (error: unknown) => {
          console.error(
            "[AUTH] PostgreSQL session-store error",
            error instanceof Error ? error.message : String(error),
          );
        },
      });
      
      console.log("✅ Using PostgreSQL for persistent session storage");
    } catch (error) {
      console.error("⚠️  Failed to initialize PostgreSQL session store, falling back to memory:", error);
      sessionStore = null; // Will fall back to memory store
    }
  }
  
  // Fallback to memory store if PostgreSQL not available
  if (!sessionStore) {
    const memorystore = require("memorystore");
    const MemoryStore = memorystore(session);
    sessionStore = new MemoryStore({
      checkPeriod: sessionTtl,
    });
    console.log("⚠️  Using memory store for sessions (will clear on restart)");
  }

  const isProduction = process.env.NODE_ENV === "production";
  const isVercelPreview = process.env.VERCEL_ENV === "preview";

  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: isProduction,
      // Preview is same-origin on *.vercel.app, so do not use the production cross-site cookie contract.
      sameSite: isVercelPreview ? "lax" : isProduction ? "none" : "lax",
      maxAge: sessionTtl,
      domain: isProduction && !isVercelPreview ? ".responseintegrity.co.za" : undefined,
      path: "/",
    },
  });
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);

  // Keep the mode probe independent from PostgreSQL-backed session loading.
  // This endpoint is our first preview health boundary and must still report
  // the selected auth mode when the session store itself is unhealthy.
  app.get("/api/auth/mode", (_req: Request, res: Response) => {
    const emergencyDbMode = isEmergencyDbMode();
    const isPreview = process.env.VERCEL_ENV === "preview";
    const databaseTarget =
      isPreview && process.env.DATABASE_URL
        ? describeRuntimeDatabaseTarget(process.env.DATABASE_URL)
        : undefined;
    const supabaseTarget =
      isPreview && process.env.SUPABASE_URL
        ? describeSupabaseApiTarget(process.env.SUPABASE_URL)
        : undefined;
    const runtimeTargetsAligned =
      databaseTarget?.projectRef && supabaseTarget?.projectRef
        ? databaseTarget.projectRef === supabaseTarget.projectRef
        : undefined;

    res.json({
      emergencyDbMode,
      authMode: emergencyDbMode ? "db-session" : "supabase",
      ...(databaseTarget ? { databaseTarget } : {}),
      ...(supabaseTarget ? { supabaseTarget } : {}),
      ...(runtimeTargetsAligned !== undefined ? { runtimeTargetsAligned } : {}),
    });
  });

  app.use(getSession());

  // connect-pg-simple reports request-time store failures through next(error).
  // Handle that boundary explicitly so Vercel returns structured JSON instead
  // of terminating the invocation with FUNCTION_INVOCATION_FAILED.
  app.use((error: unknown, req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) return next(error);

    const errorRecord =
      error && typeof error === "object"
        ? (error as { message?: unknown; code?: unknown; stack?: unknown })
        : {};
    const message =
      typeof errorRecord.message === "string"
        ? errorRecord.message
        : String(error);
    const code =
      typeof errorRecord.code === "string"
        ? errorRecord.code
        : null;
    const hasBearerToken =
      typeof req.headers.authorization === "string" &&
      req.headers.authorization.startsWith("Bearer ");

    console.error("[AUTH] Session middleware unavailable", {
      method: req.method,
      path: req.path,
      message,
      code,
      pools: getDatabasePoolStats(),
    });

    // Non-emergency GETs can still be authenticated independently by the
    // downstream Supabase bearer-token path. Do not let a legacy Express
    // session-store outage collapse read-only portal state when a bearer token
    // is already present. Mutations remain fail-closed.
    if (!isEmergencyDbMode() && req.method === "GET" && hasBearerToken) {
      (req as any).session = new (session as any).Session(req, {});
      console.warn("[AUTH] Continuing bearer-authenticated GET without persisted Express session", {
        path: req.path,
      });
      return next();
    }

    return res.status(503).json({
      error: "SESSION_STORE_UNAVAILABLE",
      message: "Authentication session storage is temporarily unavailable",
    });
  });

  if (isEmergencyDbMode()) {
    console.warn("[AUTH] EMERGENCY_DB_MODE is active: using PostgreSQL sessions and direct password verification");
  }

  // Sign up endpoint
  app.post("/api/auth/signup", async (req: Request, res: Response) => {
      // Store affiliate_code in session for later use (e.g., enrollment)
      const incomingProductionCode = normalizeProductionLinkCode(req.body.production_link_code);
      const incomingAffiliateCode = normalizeProductionLinkCode(req.body.affiliate_code);
      const requestedProductionPipeline = normalizeProductionPipeline(req.body.production_pipeline);
      let productionLink: any = null;
      if (
        isEmergencyDbMode() &&
        (req.body.role || "tutor") === "tutor" &&
        (incomingProductionCode || incomingAffiliateCode)
      ) {
        return res.status(503).json({ message: "Specialist Production Link signup is temporarily unavailable." });
      }
      if (incomingProductionCode) {
        productionLink = await storage.getAffiliateByCode(incomingProductionCode);
        const validationError = validateProductionLinkForRole(productionLink, requestedProductionPipeline, req.body.role || "tutor");
        if (validationError) {
          return res.status(400).json({ message: validationError });
        }
        if (productionLink.ownership_status === "unresolved_legacy") {
          return res.status(400).json({ message: "This legacy Production Link has unresolved ownership and cannot create new attribution" });
        }
        req.session.affiliateCode = incomingAffiliateCode || incomingProductionCode;
        (req.session as any).productionLinkCode = productionLink.production_link_code;
        (req.session as any).productionPipeline = productionLink.pipeline_type;
        (req.session as any).trackingSource = req.body.tracking_source || null;
        (req.session as any).trackingCampaign = req.body.tracking_campaign || null;
      } else if (incomingAffiliateCode) {
        const legacyLink = await storage.getAffiliateByCode(incomingAffiliateCode);
        if (legacyLink && legacyLink.pipeline_type !== "demand") {
          return res.status(400).json({ message: "Capacity Production Links must use the canonical production URL" });
        }
        req.session.affiliateCode = incomingAffiliateCode;
        console.log("[SIGNUP] affiliate_code stored in session as affiliateCode:", req.session.affiliateCode);
      } else {
        console.log("[SIGNUP] No affiliate_code in signup body; session.affiliateCode not set.");
      }
    try {
      const { email, password, role = "tutor", first_name = "", last_name = "", affiliate_code = null, production_link_code = null, production_pipeline = null, tracking_source = "organic", tracking_campaign = null } = req.body;
      const normalizedEmail = normalizeEmail(email);

      if (role === "od" && !isAllowedOdEmail(normalizedEmail)) {
        return res.status(403).json({
          message: `Only approved OD emails can create an OD account: ${getAllowedOdEmailList()}`,
        });
      }

      if (!email || !password) {
        return res
          .status(400)
          .json({ message: "Email and password are required" });
      }

      if (isEmergencyDbMode()) {
        if (role !== "tutor") {
          return res.status(503).json({ message: "New account creation is temporarily available for specialists only." });
        }
        if (password.length < 6) {
          return res.status(400).json({ message: "Password must be at least 6 characters" });
        }
        if (!first_name.trim() || !last_name.trim()) {
          return res.status(400).json({ message: "First name and last name are required" });
        }
        if (productionLink) {
          return res.status(503).json({ message: "Specialist Production Link signup is temporarily unavailable." });
        }

        try {
          const user = await createEmergencyTutorAccount(pool, {
            email: normalizedEmail,
            password,
            firstName: first_name.trim(),
            lastName: last_name.trim(),
            trackingSource: tracking_source,
            trackingCampaign: tracking_campaign,
          });
          console.log("[EMERGENCY SIGNUP] created tutor", { userId: user.id });
          return res.status(201).json({
            user: { id: user.id, email: user.email, role: user.role },
            message: "Account created. Please log in to continue.",
          });
        } catch (error) {
          if ((error as { code?: string })?.code === "DUPLICATE_EMAIL") {
            return res.status(409).json({ message: "An account with this email already exists." });
          }
          console.error("[EMERGENCY SIGNUP] failed", error instanceof Error ? error.message : "unknown error");
          return res.status(500).json({ message: "Failed to create account" });
        }
      }

      // Create user in Supabase Auth with metadata
      // NOTE: NOT passing metadata here due to trigger issues
      // We'll create the user record manually after auth succeeds
      const isPreviewSmokeIdentity =
        process.env.VERCEL_ENV === "preview" &&
        normalizedEmail.endsWith("@smoke.responseintegrity.co.za");

      let authData: any;
      let authError: any = null;

      if (isPreviewSmokeIdentity) {
        const smokeUserId = randomUUID();
        await pool.query(
          `INSERT INTO auth.users
            (id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
           VALUES ($1, 'authenticated', 'authenticated', $2, NOW(), '{}'::jsonb, '{}'::jsonb, NOW(), NOW())`,
          [smokeUserId, normalizedEmail],
        );

        authData = {
          user: {
            id: smokeUserId,
            email: normalizedEmail,
          },
          session: null,
        };
        console.log("[PREVIEW SMOKE] issued isolated Proof auth identity", {
          email: normalizedEmail,
          userId: authData.user.id,
        });
      } else {
        const signupResult = await supabase.auth.signUp({
          email,
          password,
        });
        authData = signupResult.data;
        authError = signupResult.error;
      }

      if (authError) {
        console.error("Supabase signup error:", authError);
        return res.status(400).json({ message: authError.message });
      }

      if (!authData.user) {
        return res.status(400).json({ message: "Failed to create user" });
      }

      console.log("✅ Supabase auth user created");
      console.log("  Auth User ID:", authData.user.id);

      // Manually create user record in public.users table
      // (Trigger is disabled due to issues)
      console.log("📝 Creating user record in public.users...");
      console.log("  Role value before insert:", role);
      console.log("  Role type:", typeof role);
      console.log("  Role is undefined?", role === undefined);
      console.log("  Role is null?", role === null);
      console.log("  Role is empty string?", role === "");
      
      const fullName = `${first_name} ${last_name}`.trim() || email.split("@")[0];
      console.log("  Full name for insert:", fullName);
      
      const { data: newUser, error: insertError } = await supabase
        .from("users")
        .insert({
          id: authData.user.id,
          email: normalizedEmail,
          role,
          first_name,
          last_name,
          name: fullName,
        })
        .select()
        .maybeSingle();

      if (insertError) {
        console.error("❌ Error creating user record:", insertError);
        // Try to delete the auth user since we couldn't create the user record
        await supabase.auth.admin.deleteUser(authData.user.id).catch(err => {
          console.error("Could not delete failed auth user:", err);
        });
        return res.status(500).json({ message: "Failed to create user profile" });
      }

      console.log("✅ User record created successfully!");
      console.log("  Inserted user data:", newUser);
      console.log("  User role from database:", newUser?.role);
      console.log("  User ID:", newUser?.id);
      console.log("  User email:", newUser?.email);
      
      // Verify the role was saved correctly
      if (newUser?.role !== role) {
        console.error("❌ ROLE MISMATCH!");
        console.error("  Expected role:", role);
        console.error("  Actual role in DB:", newUser?.role);
      }

      const user = newUser;

      if (user && user.role === "tutor" && productionLink) {
        try {
          await storage.claimUserProductionAttribution(
            user.id,
            productionLink.production_link_code,
            tracking_source,
            tracking_campaign,
          );
        } catch (error) {
          console.error("[SIGNUP] Failed to persist specialist Production Link attribution:", error);
          await supabase.auth.admin.deleteUser(user.id).catch((cleanupError) => {
            console.error("Could not delete account after attribution failure:", cleanupError);
          });
          return res.status(500).json({ message: "Failed to persist Production Link attribution" });
        }
      }

      // If new affiliate signed up, generate their unique code
      if (user && user.role === "affiliate") {
        try {
          console.log("🎁 Generating affiliate code for new affiliate:", user.id);
          // Wrap in Promise.race with timeout to prevent hanging
          const codePromise = storage.getOrCreateAffiliateCode(user.id);
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error("Code generation timeout")), 5000)
          );
          const code = await Promise.race([codePromise, timeoutPromise]);
          console.log("✅ Affiliate code generated/retrieved:", code);
        } catch (error) {
          console.warn("⚠️  Affiliate code generation failed (non-blocking):", error instanceof Error ? error.message : String(error));
          // Generate a temporary local code if Supabase is unreachable
          const localCode = `AFIX${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
          console.log("📝 Generated temporary local code for affiliate:", localCode);
          // Don't fail the signup - user can get code from dashboard later
        }
      }

      if (user?.role === "parent") {
        await captureDemandParent(serverSupabase, storage, {
          userId: user.id, fullName: `${first_name} ${last_name}`.trim() || email.split("@")[0], email,
          code: production_link_code || affiliate_code || req.session.affiliateCode,
          source: tracking_source, campaign: tracking_campaign,
        });
      }

      // Set session with user data and token
      (req.session as any).userId = authData.user.id;
      (req.session as any).email = authData.user.email;
      (req.session as any).accessToken = authData.session?.access_token;
      
      // Force session to be marked as modified so cookie will be sent
      req.session.touch();


      let redirectUrl: string;
      
      if (user?.role === "parent") {
        redirectUrl = "/client/parent/gateway";
      } else {
        redirectUrl = getDefaultDashboardRoute((user?.role as any) || "tutor");
      }

      // Validate redirectUrl is set
      if (!redirectUrl) {
        console.error("❌ CRITICAL: redirectUrl is undefined! Falling back to getDefaultDashboardRoute");
        console.error("  User role:", user?.role);
        console.error("  User:", user);
        redirectUrl = getDefaultDashboardRoute((user?.role as any) || "tutor");
        console.warn("⚠️  Fallback redirect URL:", redirectUrl);
      }

      console.log("✅ Final Redirect URL determined:", redirectUrl, "for role:", user?.role);

      // Save session before sending response
      req.session.save((err) => {
        if (err) {
          console.error("❌ Session save error:", err);
          return res.status(500).json({ message: "Session error" });
        }
        
        // Make sure the response includes the session cookie
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        
        res.json({
          user: authData.user,
          redirectUrl,
          message: "Signup successful",
        });
      });
    } catch (error) {
      console.error("Signup error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Sign in endpoint
  app.post("/api/auth/signin", async (req: Request, res: Response) => {
    try {
      console.log("═══════════════════════════════════════");
      console.log("🔐 SIGNIN REQUEST RECEIVED");
      console.log("═══════════════════════════════════════");
      
      const { email, password, expectedRole } = req.body;
      const normalizedEmail = normalizeEmail(email);
      if (expectedRole === "od" && !isAllowedOdEmail(normalizedEmail)) {
        return res.status(403).json({
          message: `Only approved OD emails can use the OD portal: ${getAllowedOdEmailList()}`,
        });
      }
      console.log("✅ Parsed request body successfully");


      if (!email || !password) {
        return res
          .status(400)
          .json({ message: "Email and password are required" });
      }

      if (isEmergencyDbMode()) {
        const result = await authenticateEmergencyUser(pool, email, password, req.ip || "unknown");
        if ("error" in result) {
          console.warn("[AUTH] Emergency login rejected", {
            outcome: result.error,
            internalReason: result.reason,
          });
          if (result.error === "throttled") {
            return res.status(429).json({
              message: "Too many login attempts. Please wait a few minutes and try again.",
            });
          }
          return res.status(401).json({ message: "Email or password is incorrect" });
        }

        const user = await storage.getUser(result.authUser.id);
        if (!user) {
          console.error("[AUTH] Auth user has no public.users record", { authUserId: result.authUser.id });
          return res.status(401).json({ message: "Invalid credentials" });
        }
        if (!emergencyExpectedRoleMatches(user.role, expectedRole)) {
          return res.status(403).json({
            message: `This account is not registered as a ${expectedRole}. Your account is registered as a ${user.role}.`,
          });
        }

        (req.session as any).userId = user.id;
        (req.session as any).email = user.email;
        delete (req.session as any).accessToken;
        const redirectUrl = user.role === "parent"
          ? "/client/parent/gateway"
          : getDefaultDashboardRoute((user.role as any) || "tutor");

        return req.session.save((err) => {
          if (err) {
            console.error("[AUTH] Emergency session save error", err);
            return res.status(500).json({ message: "Session error" });
          }
          console.log("[EMERGENCY LOGIN] credential source", {
            userId: user.id,
            source: result.authUser.email_confirmed_at ? "supabase-auth" : "emergency",
          });
          res.json({
            user: {
              id: result.authUser.id,
              email: result.authUser.email,
              email_confirmed_at: result.authUser.email_confirmed_at,
              app_metadata: result.authUser.raw_app_meta_data || {},
              user_metadata: result.authUser.raw_user_meta_data || {},
            },
            dbUser: user,
            redirectUrl,
            message: "Login successful",
          });
        });
      }

      // Authenticate with Supabase
      const { data: authData, error: authError } =
        await supabase.auth.signInWithPassword({
          email,
          password,
        });

      if (authError) {
        console.error("Supabase signin error:", authError);
        const isRateLimited =
          authError.code === "over_request_rate_limit" ||
          authError.status === 429;
        return res.status(isRateLimited ? 429 : 401).json({
          message: isRateLimited
            ? "Too many login attempts. Please wait a few minutes and try again."
            : "Email or password is incorrect",
        });
      }

      if (!authData.user) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      // Get user from our database
      // ✅ Get user directly from Supabase 'users' table
      let { data: user, error: fetchError } = await supabase
        .from("users")
        .select("*")
        .eq("email", email)
        .maybeSingle();

      // If user record doesn't exist yet, auto-provision it using auth info
      if (!user) {
        console.warn("⚠️  No user record found, auto-provisioning user:", email);
        const roleToAssign = expectedRole || "tutor";
        if (roleToAssign === "od" && !isAllowedOdEmail(normalizedEmail)) {
          return res.status(403).json({
            message: `Only approved OD emails can be assigned the OD role: ${getAllowedOdEmailList()}`,
          });
        }
        const name = (authData.user.user_metadata as any)?.name || email.split("@")[0];
        const first_name = (authData.user.user_metadata as any)?.first_name || "";
        const last_name = (authData.user.user_metadata as any)?.last_name || "";

        const { data: newUser, error: insertError } = await supabase
          .from("users")
          .insert({
            id: authData.user.id,
            email: normalizedEmail,
            role: roleToAssign,
            first_name,
            last_name,
            name,
          })
          .select()
          .maybeSingle();

        if (insertError || !newUser) {
          console.error("❌ Failed to auto-provision user:", insertError);
          return res.status(401).json({ message: "User not found" });
        }

        console.log("✅ Auto-provisioned user record:", newUser.id, newUser.role);
        user = newUser;
      }

      console.log("═══════════════════════════════════════");
      console.log("👤 USER FETCHED FROM DATABASE:");
      console.log("  Role:", user.role);
      console.log("  Expected Role:", expectedRole);
      console.log("═══════════════════════════════════════");

      // ✅ Validate role if expectedRole is provided
      if (expectedRole) {
        console.log(`⚙️  Role validation check: "${user.role}" === "${expectedRole}" ?`);
        if (user.role !== expectedRole) {
          console.error(
            `❌ ROLE MISMATCH: User has role '${user.role}' but tried to login as '${expectedRole}'`
          );
          return res.status(403).json({
            message: `This account is not registered as a ${expectedRole}. Your account is registered as a ${user.role}.`,
          });
        }
      }

      console.log("✅ Role validation PASSED");

      // If parent is logging in, check if they should have a lead
      if (user.role === "parent") {
        try {
          console.log("🔍 Checking for retroactive lead creation for parent");
          
          // Find all encounters for this parent (by email)
          const { data: encounters } = await supabase
            .from("encounters")
            .select("id, affiliate_id")
            .eq("parent_email", email);
          
          if (encounters && encounters.length > 0) {
            // For each encounter, check if a lead exists
            for (const encounter of encounters) {
              const { data: existingLead } = await supabase
                .from("leads")
                .select("id")
                .eq("encounter_id", encounter.id)
                .eq("user_id", user.id)
                .maybeSingle();
              
              // If no lead exists for this encounter+user combo, create one
              if (!existingLead) {
                console.log("⚠️  No lead found for encounter", encounter.id, "- creating retroactively");
                await storage.createLead(encounter.affiliate_id, user.id, encounter.id, { leadType: 'parent' });
                console.log("✅ Retroactive lead created for encounter:", encounter.id);
              }
            }
          }
        } catch (error) {
          console.warn("⚠️  Error checking retroactive lead creation:", error);
          // Don't fail signin if this check fails
        }
      }

      // Set session
      (req.session as any).userId = authData.user.id;
      (req.session as any).email = authData.user.email;
      (req.session as any).accessToken = authData.session?.access_token;

      console.log("💾 User ID being saved:", authData.user.id);
      console.log("🔍 User role for redirect:", user.role);

      // Determine redirect based on role
      let redirectUrl: string;
      
      if (user.role === "parent") {
        redirectUrl = "/client/parent/gateway";
      } else {
        redirectUrl = getDefaultDashboardRoute((user.role as any) || "tutor");
      }

      // Validate redirectUrl is set
      if (!redirectUrl) {
        console.error("❌ CRITICAL: redirectUrl is undefined! Falling back to getDefaultDashboardRoute");
        console.error("  User role:", user.role);
        console.error("  User:", user);
        // Fallback to role-based default route to avoid breaking signin flow
        redirectUrl = getDefaultDashboardRoute((user?.role as any) || (expectedRole as any) || "tutor");
        console.warn("⚠️  Fallback redirect URL:", redirectUrl);
      }

      console.log("📍 Final redirect URL:", redirectUrl, "for role:", user.role);

      // Save session before sending response
      req.session.save((err) => {
        if (err) {
          console.error("❌ Session save error:", err);
          return res.status(500).json({ message: "Session error" });
        }
        
        console.log("✅ Session saved successfully for user");
        
        res.json({
          user: authData.user,
          dbUser: user,
          redirectUrl,
          message: "Login successful",
        });
      });
    } catch (error) {
      console.error("❌ SIGNIN ERROR:");
      console.error("Error type:", error instanceof Error ? error.constructor.name : typeof error);
      console.error("Error message:", error instanceof Error ? error.message : String(error));
      console.error("Full error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // OAuth profile creation endpoint - handles new users signing up via Google OAuth
  app.post("/api/auth/oauth-profile", async (req: Request, res: Response) => {
      if (isEmergencyDbMode()) {
        return res.status(503).json({ message: "Social login is temporarily unavailable. Please use your existing password." });
      }
    try {
      console.log("═══════════════════════════════════════");
      console.log("🔐 OAUTH PROFILE CREATION REQUEST");
      console.log("Request body:", JSON.stringify(req.body));
      console.log("═══════════════════════════════════════");

      const {
        user_id,
        email,
        role,
        first_name = "",
        last_name = "",
        affiliate_code = null,
        production_link_code = null,
        production_pipeline = null,
        tracking_source = "organic",
        tracking_campaign = null,
      } = req.body;
      const incomingProductionCode = normalizeProductionLinkCode(production_link_code);
      const requestedProductionPipeline = normalizeProductionPipeline(production_pipeline);
      const effectiveAffiliateCode = incomingProductionCode || normalizeProductionLinkCode(affiliate_code) || (req.session as any).affiliateCode || null;
      let productionLink: any = null;
      if (incomingProductionCode) {
        productionLink = await storage.getAffiliateByCode(incomingProductionCode);
        const validationError = validateProductionLinkForRole(productionLink, requestedProductionPipeline, role);
        if (validationError) {
          return res.status(400).json({ message: validationError });
        }
        if (productionLink.ownership_status === "unresolved_legacy") {
          return res.status(400).json({ message: "This legacy Production Link has unresolved ownership and cannot create new attribution" });
        }
        req.session.affiliateCode = effectiveAffiliateCode;
        (req.session as any).productionLinkCode = productionLink.production_link_code;
        (req.session as any).productionPipeline = productionLink.pipeline_type;
      } else if (effectiveAffiliateCode) {
        const legacyLink = await storage.getAffiliateByCode(effectiveAffiliateCode);
        if (legacyLink && legacyLink.pipeline_type !== "demand") {
          return res.status(400).json({ message: "Capacity Production Links must use the canonical production URL" });
        }
      }
      if (effectiveAffiliateCode) {
        req.session.affiliateCode = effectiveAffiliateCode;
        if (productionLink) {
          (req.session as any).productionLinkCode = productionLink.production_link_code;
          (req.session as any).productionPipeline = productionLink.pipeline_type;
        }
        (req.session as any).trackingSource = tracking_source || null;
        (req.session as any).trackingCampaign = tracking_campaign || null;
      }
      const normalizedEmail = normalizeEmail(email);

      if (!user_id || !email || !role) {
        return res.status(400).json({ message: "user_id, email, and role are required" });
      }

      // Validate role is a public signup role
      const publicSignupRoles = ["parent", "tutor", "affiliate", "od"];
      if (!publicSignupRoles.includes(role)) {
        return res.status(400).json({ message: "Invalid role for OAuth signup" });
      }
      if (role === "od" && !isAllowedOdEmail(normalizedEmail)) {
        return res.status(403).json({
          message: `Only approved OD emails can create an OD account: ${getAllowedOdEmailList()}`,
        });
      }

      // Check if user profile already exists
      const existingUser = await storage.getUser(user_id);
      if (existingUser) {
        console.log("✅ User profile already exists, returning existing role:", existingUser.role);
        if (productionLink && existingUser.role === "tutor") {
          await storage.claimUserProductionAttribution(
            user_id,
            productionLink.production_link_code,
            tracking_source,
            tracking_campaign,
          );
        }
        if (existingUser.role === "parent") {
          await captureDemandParent(serverSupabase, storage, {
            userId: user_id, fullName: existingUser.name || email, email,
            code: effectiveAffiliateCode, source: tracking_source, campaign: tracking_campaign,
          });
        }
        return res.json({ role: existingUser.role, message: "User already exists" });
      }

      console.log("🆕 Creating new user profile for OAuth user:", email, "with role:", role);

      // Update user metadata in Supabase Auth to include role
      const { error: updateError } = await supabase.auth.admin.updateUserById(user_id, {
        user_metadata: { role }
      });

      if (updateError) {
        console.error("Failed to update user metadata:", updateError);
        // Continue anyway - we'll still create the database record
      }

      // Create user in database
      await storage.upsertUser({
        id: user_id,
        email: normalizedEmail,
        role,
        firstName: first_name,
        lastName: last_name,
        verificationStatus: "pending",
      });

      if (role === "tutor" && productionLink) {
        await storage.claimUserProductionAttribution(
          user_id,
          productionLink.production_link_code,
          tracking_source,
          tracking_campaign,
        );
      }

      console.log("✅ User profile created successfully");

      if (role === "parent") {
        await captureDemandParent(serverSupabase, storage, {
          userId: user_id, fullName: `${first_name || ""} ${last_name || ""}`.trim() || email, email,
          code: effectiveAffiliateCode, source: tracking_source, campaign: tracking_campaign,
        });
      }

      res.json({ 
        role, 
        message: "OAuth profile created successfully" 
      });
    } catch (error) {
      console.error("OAuth profile creation error:", error);
      res.status(500).json({ message: "Failed to create OAuth profile" });
    }
  });

  // Logout endpoint
  app.post("/api/auth/logout", async (req: Request, res: Response) => {
    try {
      const accessToken = (req.session as any).accessToken;

      if (accessToken && !isEmergencyDbMode()) {
        await supabase.auth.signOut();
      }

      req.session.destroy((err) => {
        if (err) {
          console.error("Session destruction error:", err);
        }
        res.json({ message: "Logged out successfully" });
      });
    } catch (error) {
      console.error("Logout error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get current user endpoint
  app.get("/api/auth/user", async (req: Request, res: Response) => {
    try {
      console.log("🔍 GET /api/auth/user - Checking authentication...");
      
      if (isEmergencyDbMode()) {
        const userId = (req.session as any)?.userId;
        if (!userId) return res.status(401).json({ message: "Unauthorized" });
        const user = await storage.getUser(userId);
        if (!user) return res.status(401).json({ message: "Unauthorized" });
        return res.json(user);
      }

      // Prefer explicit Bearer token auth over any backend session cookie.
      let userId: string | undefined = undefined;
      let authSource = "session";
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith("Bearer ")) {
        const token = authHeader.substring(7);
        try {
          const { data: { user: supabaseUser }, error: supabaseError } = await supabase.auth.getUser(token);
          
          if (supabaseError || !supabaseUser) {
            console.log("❌ Supabase token invalid:", supabaseError?.message);
            // Fall back to session cookie auth if available
            userId = (req.session as any).userId;
            authSource = "session";
            console.log("🔍 Falling back to session auth, userId from session:", userId);
          } else {
            console.log("✅ Supabase token valid, user ID:", supabaseUser.id);
            userId = supabaseUser.id;
            authSource = "jwt";
          }
        } catch (tokenError) {
          console.log("❌ Error verifying token:", tokenError);
          userId = (req.session as any).userId;
          authSource = "session";
          console.log("🔍 Falling back to session auth after token verification error, userId from session:", userId);
        }
      } else {
        userId = (req.session as any).userId;
        authSource = "session";
        console.log("🔍 User ID from session:", userId);
      }

      if (!userId) {
        console.log("❌ No userId in session or auth header");
        return res.status(401).json({ message: "Unauthorized" });
      }

      console.log(`🔑 Using userId from ${authSource}:`, userId);
      
      const user = await storage.getUser(userId);
      if (!user) {
        console.log("❌ User not found in database for ID:", userId);
        return res.status(401).json({ message: "User not found" });
      }

      console.log("✅ User authenticated", { userId: user.id, role: user.role });
      console.log("📋 Full user object:", JSON.stringify(user, null, 2));
      console.log("📋 User role type:", typeof user.role);
      console.log("📋 User role === 'parent':", user.role === "parent");
      console.log("📋 User role === 'affiliate':", user.role === "affiliate");
      
      // DEBUG: Check if user is a parent with a lead (affiliate relationship)
      if (user.role === "parent") {
        try {
          const { data: parentLead } = await supabase
            .from("leads")
            .select("affiliate_id, affiliate:affiliate_id(role)")
            .eq("parent_id", userId)
            .maybeSingle();
          
          if (parentLead) {
            console.log("📋 Parent has lead relationship:");
            console.log("  Affiliate ID:", parentLead.affiliate_id);
            const affiliate = parentLead.affiliate as { role?: string } | null;
            console.log("  Affiliate role:", affiliate?.role);
          }
        } catch (debugError) {
          console.warn("Debug check failed:", debugError);
        }
      }
      
      res.json(user);
    } catch (error) {
      console.error("Get user error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
}

// Middleware to check if user is authenticated
export const isAuthenticated: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    if (isEmergencyDbMode()) {
      const userId = (req.session as any)?.userId;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      const user = await storage.getUser(userId);
      if (!user) return res.status(401).json({ message: "Unauthorized" });
      (req as any).dbUser = user;
      return next();
    }

    // First, try session-based auth only when no explicit Bearer token is present.
    if (!(req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) && req.session && (req.session as any).userId) {
      const sessionUserId = (req.session as any).userId;
      // Session auth found - use it
      try {
        // Add timeout to prevent hanging on database queries
        const userPromise = storage.getUser(sessionUserId);
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("getUser timeout after 5s")), 5000)
        );
        const user = await Promise.race([userPromise, timeoutPromise]);
        if (user) {
          (req as any).dbUser = user;
          return next();
        }
      } catch (userError) {
        console.error("[isAuthenticated] error fetching user from session:", userError);
        return res.status(500).json({ message: "Error retrieving user" });
      }
    }

    // Second, try Bearer token auth (for cross-origin requests from Vercel frontend)
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      
      // Verify the JWT token with Supabase
      const { data: { user: supabaseUser }, error } = await supabase.auth.getUser(token);
      
      if (error) {
        console.error("Token verification failed:", error.message);
        return res.status(401).json({ message: "Invalid token" });
      }
      
      if (supabaseUser) {
        // Get user from our database
        console.time("⏱️ storage.getUser (Bearer)");
        try {
          const userPromise = storage.getUser(supabaseUser.id);
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error("getUser timeout after 5s")), 5000)
          );
          const user = await Promise.race([userPromise, timeoutPromise]);
          console.timeEnd("⏱️ storage.getUser (Bearer)");
          if (user) {
            (req as any).dbUser = user;
            return next();
          } else {
            console.error("User not found in database for Supabase user:", supabaseUser.id);
            return res.status(401).json({ message: "User not found" });
          }
        } catch (userError) {
          console.error("❌ Error fetching user (Bearer):", userError);
          return res.status(500).json({ message: "Error retrieving user" });
        }
      }
    }

    // No valid auth found
    return res.status(401).json({ message: "Unauthorized" });
  } catch (error) {
    console.error("Auth middleware error:", error);
    res.status(401).json({ message: "Unauthorized" });
  }
};
