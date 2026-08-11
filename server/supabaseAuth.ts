import { createClient } from "@supabase/supabase-js";
import type {
  Express,
  RequestHandler,
  Request,
  Response,
  NextFunction,
} from "express";
import session from "express-session";
import connectPg from "connect-pg-simple";
import pg from "pg";
import { storage } from "./storage";
import { getDefaultDashboardRoute } from "@shared/portals";
import { getAllowedOdEmailList, isAllowedOdEmail, normalizeEmail } from "@shared/odAccess";

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
  throw new Error("Missing Supabase environment variables");
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY,
);

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  
  let sessionStore;
  
  // Use PostgreSQL for persistent session storage if DATABASE_URL is available
  if (process.env.DATABASE_URL) {
    try {
      const PgSession = connectPg(session);
      
      // Create PostgreSQL pool for session storage
      // Supabase requires SSL in all environments
      const pgPool = new pg.Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }, // Supabase requires SSL
      });

      sessionStore = new PgSession({
        pool: pgPool,
        tableName: "sessions",
        createTableIfMissing: false, // Table already exists from schema
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

  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production", // true in prod, false in dev
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax", // 'none' for cross-site in prod
      maxAge: sessionTtl,
      domain: process.env.NODE_ENV === "production" ? ".responseintegrity.co.za" : undefined,
      path: "/",
    },
  });
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());

  // Sign up endpoint
  app.post("/api/auth/signup", async (req: Request, res: Response) => {
      console.log("[SESSION] Before signup: req.sessionID:", req.sessionID);
      console.log("[SESSION] Before signup: req.session:", req.session);
      // Store affiliate_code in session for later use (e.g., enrollment)
      if (req.body.affiliate_code) {
        req.session.affiliateCode = req.body.affiliate_code;
        console.log("[SIGNUP] affiliate_code stored in session as affiliateCode:", req.session.affiliateCode);
      } else {
        console.log("[SIGNUP] No affiliate_code in signup body; session.affiliateCode not set.");
      }
    try {
      const { email, password, role = "tutor", first_name = "", last_name = "", affiliate_code = null, tracking_source = "organic", tracking_campaign = null } = req.body;
      const normalizedEmail = normalizeEmail(email);

      if (role === "od" && !isAllowedOdEmail(normalizedEmail)) {
        return res.status(403).json({
          message: `Only approved OD emails can create an OD account: ${getAllowedOdEmailList()}`,
        });
      }

      console.log("═══════════════════════════════════════");
      console.log("📝 SIGNUP REQUEST RECEIVED");
      console.log("Request body:", JSON.stringify(req.body));
      console.log("  Email:", email);
      console.log("  Role from request:", req.body.role);
      console.log("  Role extracted (with default):", role);
      console.log("  First Name:", first_name);
      console.log("  Last Name:", last_name);
      console.log("  Affiliate Code:", affiliate_code);
      console.log("  Tracking Source:", tracking_source);
      console.log("  Tracking Campaign:", tracking_campaign);
      console.log("═══════════════════════════════════════");

      if (!email || !password) {
        return res
          .status(400)
          .json({ message: "Email and password are required" });
      }

      // Create user in Supabase Auth with metadata
      // NOTE: NOT passing metadata here due to trigger issues
      // We'll create the user record manually after auth succeeds
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (authError) {
        console.error("Supabase signup error:", authError);
        return res.status(400).json({ message: authError.message });
      }

      if (!authData.user) {
        return res.status(400).json({ message: "Failed to create user" });
      }

      console.log("✅ Supabase auth user created");
      console.log("  Auth User ID:", authData.user.id);
      console.log("  Email:", authData.user.email);

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

      // --- PARENT RECORD UPSERT ON SIGNUP ---
      if (user && user.role === "parent") {
        // --- Robust onboarding_type and affiliate_type logic ---
        // Use affiliate code from body or session
        const effectiveAffiliateCode = affiliate_code || req.session.affiliateCode || null;
        let resolvedOnboardingType = 'commercial';
        let resolvedAffiliateType = null;
        if (effectiveAffiliateCode) {
          // Always set onboarding_type to 'pilot' if affiliate code is present
          resolvedOnboardingType = 'pilot';
          // Only set affiliate_type if code lookup succeeds
          const { data: codeData, error: codeError } = await supabase
            .from("affiliate_codes")
            .select("type, affiliate_type")
            .eq("code", effectiveAffiliateCode)
            .maybeSingle();
          if (codeError) {
            console.error('[SIGNUP] Error looking up affiliate code for onboarding_type/affiliate_type:', codeError);
          }
          // Always set affiliate_type, even if null, for analytics/tracking
          resolvedAffiliateType = (codeData && (codeData.affiliate_type || codeData.type)) || null;
        }
        // Debug log to confirm values before upsert
        console.log("[SIGNUP][DEBUG] About to upsert parent record:", {
          user_id: user.id,
          onboarding_type: resolvedOnboardingType,
          affiliate_type: resolvedAffiliateType,
          affiliate_code: effectiveAffiliateCode,
          first_name,
          last_name,
          email
        });
        const parentFullName = `${first_name} ${last_name}`.trim() || email.split("@")[0];
        try {
          // Upsert parent record with both onboarding_type and affiliate_type always present
          const { data: parentUpserted, error: parentUpsertError } = await supabase
            .from("parents")
            .upsert({
              user_id: user.id,
              onboarding_type: resolvedOnboardingType,
              affiliate_type: resolvedAffiliateType, // always included, even if null
              affiliate_code: effectiveAffiliateCode,
              full_name: parentFullName,
              updated_at: new Date().toISOString(),
            }, {
              onConflict: 'user_id',
              ignoreDuplicates: false,
              update: [
                'onboarding_type',
                'affiliate_type',
                'affiliate_code',
                'full_name',
                'updated_at'
              ]
            })
            .select()
            .single();
          if (parentUpsertError) {
            console.error("[SIGNUP] Error upserting parent onboarding/affiliate type:", parentUpsertError);
          } else {
            console.log("[SIGNUP] Parent upsert successful. Upserted row:", parentUpserted);
          }
        } catch (err) {
          console.error("[SIGNUP] Exception during parent upsert:", err);
        }
      }

      // If parent signed up with affiliate code, create a lead
      if (user && user.role === "parent" && affiliate_code) {
        try {
          console.log("📝 Processing affiliate code:", affiliate_code);
          console.log("📧 Parent signup email:", email);
          const onboardingType = 'pilot';
          const fullName = `${first_name} ${last_name}`.trim() || email.split("@")[0];
          // Get affiliate info from code
          const affiliateInfo = await storage.getAffiliateByCode(affiliate_code.toUpperCase());
          if (affiliateInfo && affiliateInfo.affiliate_id) {
            console.log("✅ Found affiliate for code:", affiliateInfo.affiliate_id);
            // Find the encounter by email (since parent_email matches the signup email)
            const { data: encounter } = await supabase
              .from("encounters")
              .select("id")
              .eq("affiliate_id", affiliateInfo.affiliate_id)
              .eq("parent_email", email)
              .order("created_at", { ascending: false })
              .maybeSingle();
            const leadData = {
              trackingSource: tracking_source,
              trackingCampaign: tracking_campaign,
              leadType: 'parent',
              onboardingType,
              fullName,
              affiliateType: affiliateInfo.affiliate_type,
              affiliateName: affiliateInfo.affiliate_name,
            };
            if (encounter) {
              console.log("✅ Found encounter for parent email:", email, "encounter_id:", encounter.id);
              // Create a lead linked to this encounter
              await storage.createLead(affiliateInfo.affiliate_id, user.id, encounter.id, leadData);
              console.log("✅ Lead created (with encounter) for affiliate:", affiliateInfo.affiliate_id, "encounter_id:", encounter.id);
            } else {
              console.log("ℹ️  No prior encounter found for parent email:", email);
              // Still create a lead - parent is now a lead even without prior encounter
              await storage.createLead(affiliateInfo.affiliate_id, user.id, undefined, leadData);
              console.log("✅ Lead created (new signup) for affiliate:", affiliateInfo.affiliate_id, "user_id:", user.id);
            }
          } else {
            console.warn("⚠️  Affiliate code not found:", affiliate_code);
          }
        } catch (error) {
          console.error("❌ Error processing affiliate code:", error);
          // Don't fail the signup if affiliate processing fails
        }
      }

      // If no affiliate code (organic signup), still create a lead to track them
      if (!affiliate_code) {
        try {
          console.log("📊 Organic signup - creating organic lead");
          const onboardingType = 'commercial';
          const fullName = `${first_name} ${last_name}`.trim() || email.split("@")[0];
          const leadData = {
            trackingSource: tracking_source || 'organic',
            trackingCampaign: tracking_campaign || null,
            leadType: 'parent',
            onboardingType,
            fullName,
          };
          await storage.createLead(null, user.id, null, leadData);
          console.log("✅ Organic lead created for user:", user.id);
        } catch (error) {
          console.error("❌ Error creating organic lead:", error);
          // Don't fail signup if organic lead creation fails
        }
      }

      // Set session with user data and token
      console.log("💾 BEFORE setting session values:");
      console.log("  authData.user.id:", authData.user.id);
      console.log("  authData.user.email:", authData.user.email);
      console.log("  authData.session?.access_token:", authData.session?.access_token ? "EXISTS" : "NULL");

      (req.session as any).userId = authData.user.id;
      (req.session as any).email = authData.user.email;
      (req.session as any).accessToken = authData.session?.access_token;
      
      // Force session to be marked as modified so cookie will be sent
      req.session.touch();

      console.log("💾 AFTER setting session values:");
      console.log("  req.session.userId:", (req.session as any).userId);
      console.log("  req.session.email:", (req.session as any).email);
      console.log("  req.session.accessToken:", (req.session as any).accessToken ? "EXISTS" : "NULL");
      console.log("🔍 User role for redirect:", user?.role);

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
          console.log("[SESSION] After signup: req.sessionID:", req.sessionID);
          console.log("[SESSION] After signup: req.session:", req.session);
        if (err) {
          console.error("❌ Session save error:", err);
          return res.status(500).json({ message: "Session error" });
        }
        
        console.log("✅ Session saved successfully for signup");
        console.log("  Session ID:", req.sessionID);
        console.log("  Session cookie headers about to be sent:");
        const setCookieHeader = res.getHeader('Set-Cookie');
        console.log("  Set-Cookie header:", setCookieHeader);
        console.log("  Session contents after save:", {
          userId: (req.session as any).userId,
          email: (req.session as any).email,
          accessToken: (req.session as any).accessToken ? "EXISTS" : "NULL",
        });
        
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
      console.log("[SESSION] Before signin: req.sessionID:", req.sessionID);
      console.log("[SESSION] Before signin: req.session:", req.session);
      console.log("[SESSION] After signin: req.sessionID:", req.sessionID);
      console.log("[SESSION] After signin: req.session:", req.session);
    try {
      console.log("═══════════════════════════════════════");
      console.log("🔐 SIGNIN REQUEST RECEIVED");
      console.log("Request body:", JSON.stringify(req.body));
      console.log("═══════════════════════════════════════");
      
      const { email, password, expectedRole } = req.body;
      const normalizedEmail = normalizeEmail(email);
      if (expectedRole === "od" && !isAllowedOdEmail(normalizedEmail)) {
        return res.status(403).json({
          message: `Only approved OD emails can use the OD portal: ${getAllowedOdEmailList()}`,
        });
      }
      console.log("✅ Parsed request body successfully");

      console.log("🔐 Parsed values:", { email, password: password ? "***" : null, expectedRole });

      if (!email || !password) {
        return res
          .status(400)
          .json({ message: "Email and password are required" });
      }

      // Authenticate with Supabase
      const { data: authData, error: authError } =
        await supabase.auth.signInWithPassword({
          email,
          password,
        });

      if (authError) {
        console.error("Supabase signin error:", authError);
        return res.status(401).json({ message: "Invalid credentials" });
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
      console.log("  Email:", user.email);
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
          console.log("🔍 Checking for retroactive lead creation for parent:", email);
          
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

      console.log("💾 Setting session - Session ID:", req.sessionID);
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
        
        console.log("✅ Session saved successfully for user:", user.email);
        
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
    try {
      console.log("═══════════════════════════════════════");
      console.log("🔐 OAUTH PROFILE CREATION REQUEST");
      console.log("Request body:", JSON.stringify(req.body));
      console.log("═══════════════════════════════════════");

      const { user_id, email, role, first_name = "", last_name = "", affiliate_code = null } = req.body;
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

      console.log("✅ User profile created successfully");

      // Handle affiliate code for parents
      if (role === "parent" && affiliate_code) {
        try {
          const { data: affiliate } = await supabase
            .from("users")
            .select("id")
            .eq("affiliate_code", affiliate_code)
            .eq("role", "affiliate")
            .maybeSingle();

          if (affiliate) {
            console.log("🔗 Creating lead for parent with affiliate code:", affiliate_code);
            await storage.createLead(affiliate.id, user_id, null, { leadType: 'parent' });
          } else {
            console.warn("⚠️  Affiliate code not found:", affiliate_code);
          }
        } catch (error) {
          console.error("Error creating lead for OAuth parent:", error);
          // Don't fail the whole request
        }
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
      console.log("[SESSION] Before logout: req.sessionID:", req.sessionID);
      console.log("[SESSION] Before logout: req.session:", req.session);
    try {
      const accessToken = (req.session as any).accessToken;

      if (accessToken) {
        await supabase.auth.signOut();
      }

      req.session.destroy((err) => {
          console.log("[SESSION] After logout: req.sessionID:", req.sessionID);
          console.log("[SESSION] After logout: req.session:", req.session);
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
      console.log("[SESSION] Before /api/auth/user: req.sessionID:", req.sessionID);
      console.log("[SESSION] Before /api/auth/user: req.session:", req.session);
    try {
      console.log("🔍 GET /api/auth/user - Checking authentication...");
      console.log("🔍 Session check - Session ID:", req.sessionID);
      
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

      console.log("✅ User authenticated:", user.email, "with role:", user.role);
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
