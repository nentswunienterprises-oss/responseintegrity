import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabaseClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "react-router-dom";
import { useNavigate } from "react-router-dom"; // ✅ React Router hook
import { getDefaultDashboardRoute } from "@shared/portals";
import type { Role } from "@shared/portals";
import { API_URL } from "@/lib/config";
import { clearAllCache, queryClient, setCurrentUserId } from "@/lib/queryClient";
import { buildForgotPasswordPath, buildPasswordResetReturnTo } from "@/lib/password-reset-navigation";

interface AuthFormProps {
  mode: "signup" | "login";
  defaultRole?: Role;
  affiliateCode?: string;
}

export function AuthForm({ mode, defaultRole = "parent", affiliateCode = "" }: AuthFormProps) {
  // Read all tracking parameters from URL (silent tracking)
  const urlParams = new URLSearchParams(window.location.search);
  const urlProductionCode = urlParams.get('production') || '';
  const urlAffiliateCode = urlParams.get('affiliate') || urlProductionCode;
  const urlPipeline = urlParams.get('pipeline') || '';
  const urlTrackingSource = urlParams.get('utm_source') || '';
  const urlTrackingCampaign = urlParams.get('utm_campaign') || '';
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  // Use URL param if available, otherwise use passed prop
  const [code, setCode] = useState(affiliateCode || urlAffiliateCode);
  const [role] = useState<Role>(defaultRole);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const location = useLocation();
  const navigate = useNavigate(); // ✅ use React Router navigate

  const passwordResetReturnTo = buildPasswordResetReturnTo(location.pathname, location.search, role);

  const redirectByRole = (role: Role) => {
    const dashboardRoute = getDefaultDashboardRoute(role);
    navigate(dashboardRoute, { replace: true });
  };

  // Google OAuth login handler
  const handleGoogleLogin = async () => {
    console.log("🔵 Google OAuth button clicked");
    console.log("  Role:", role);
    console.log("  Mode:", mode);
    console.log("  Default Role:", defaultRole);
    
    setLoading(true);
    try {
      // Store the intended role and mode in sessionStorage so callback knows what to do
      sessionStorage.setItem('oauth_role', role);
      sessionStorage.setItem('oauth_mode', mode);
      if (code) {
        sessionStorage.setItem('oauth_affiliate_code', code);
        sessionStorage.setItem('oauth_production_link_code', code);
      }
      if (urlPipeline) {
        sessionStorage.setItem('oauth_production_pipeline', urlPipeline);
      }
      if (urlTrackingSource) {
        sessionStorage.setItem('oauth_tracking_source', urlTrackingSource);
      }
      if (urlTrackingCampaign) {
        sessionStorage.setItem('oauth_tracking_campaign', urlTrackingCampaign);
      }
      
      console.log("  Stored in sessionStorage - role:", role, "mode:", mode);
      
      const redirectUrl = `${window.location.origin}/auth/callback`;
      console.log("  Redirect URL:", redirectUrl);
      console.log("  Calling supabase.auth.signInWithOAuth...");
      
      const { error } = await supabase.auth.signInWithOAuth({ 
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
          // Pass role in OAuth metadata for new signups
          scopes: 'email profile'
        }
      });
      
      console.log("  OAuth response received, error:", error);
      
      if (error) {
        console.error("❌ Google OAuth error:", error);
        toast({
          title: "Google Login Error",
          description: error.message,
          variant: "destructive",
        });
        setLoading(false);
      } else {
        console.log("✅ OAuth initiated successfully - should redirect to Google");
      }
      // Don't set loading to false here - user is being redirected
    } catch (err: any) {
      console.error("❌ Exception in handleGoogleLogin:", err);
      toast({
        title: "Error",
        description: err.message || "Failed to start Google login",
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    let redirectUrl: string | undefined;

    try {
      // Clear any cached user data from previous sessions to prevent role mixing
      clearAllCache();
      
      // Affiliate code is now optional - organic signups allowed
      // Code can come from URL (silent) or be entered manually
      // No validation needed - empty code will be sent as null to backend

      if (mode === "signup") {
        // Call backend signup endpoint
        console.log("🚀 SIGNUP STARTING");
        console.log("  Email:", email);
        console.log("  Role (state value):", role);
        console.log("  Role type:", typeof role);
        console.log("  Affiliate Code:", code);

        // Determine tracking_source: 'affiliate' if code present, else 'organic'
        let trackingSource = urlTrackingSource;
        if (!trackingSource) {
          trackingSource = code ? 'affiliate' : 'organic';
        }

        const body = {
          email,
          password,
          role,
          first_name: firstName,
          last_name: lastName,
          affiliate_code: code || null,
          production_link_code: code || null,
          production_pipeline: urlPipeline || null,
          tracking_source: trackingSource,
          tracking_campaign: urlTrackingCampaign || null,
        };
        console.log("📤 Sending signup body:", JSON.stringify(body, null, 2));

        const response = await fetch(`${API_URL}/api/auth/signup`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(body),
        });

        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.message || "Signup failed");
        }
        
        console.log("✅ Signup response received");
        console.log("  Response data:", data);
        console.log("  User role from response:", data.user?.user_metadata?.role);
        console.log("  Redirect URL:", data.redirectUrl);

        // Sign in to Supabase on the client side to establish client session
        // IMPORTANT: Wait for this to complete before redirecting
        const { error: supabaseError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        
        if (supabaseError) {
          console.warn("Supabase client signin after signup failed:", supabaseError.message);
          // Don't fail - server session should still work
        } else {
          console.log("✅ Supabase client session established");
        }

        redirectUrl = data.redirectUrl || getDefaultDashboardRoute(role);

        toast({
          title: "Welcome!",
          description: "Your account has been created successfully. You may log in now.",
        });
        
        // Wait for session to fully propagate before redirecting
        // Increased from 100ms to 500ms to ensure cookies are properly set
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Force page reload to ensure fresh session is loaded
        // Do not auto-login after signup; require email verification
        setLoading(false);
        return;
      }

      if (mode === "login") {
        // Call backend signin endpoint with role validation
        const response = await fetch(`${API_URL}/api/auth/signin`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ email, password, expectedRole: role }),
        });

        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.message || "Login failed");
        }

        if (data.dbUser) {
          queryClient.setQueryData(["/api/auth/user"], data.dbUser);
          if (data.dbUser.id) {
            setCurrentUserId(data.dbUser.id);
          }
        }

        // Also sign in to Supabase on the client side
        // IMPORTANT: Wait for this to complete before redirecting
        const { data: loginData, error: supabaseError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (supabaseError) {
          console.warn("Supabase client signin failed:", supabaseError.message);
          // Don't fail - server session should still work
        } else {
          // Check if email is confirmed
          const user = loginData?.user;
          if (!user?.email_confirmed_at && !user?.confirmed_at) {
            toast({
              title: "Email not verified",
              description: "Please verify your email before logging in.",
              variant: "destructive",
            });
            setLoading(false);
            return;
          }
          console.log("✅ Supabase client session established");
        }
        redirectUrl = data.redirectUrl || getDefaultDashboardRoute(role);
        toast({
          title: "Welcome back!",
          description: "You have been logged in successfully.",
        });
      }
      
      // Ensure redirectUrl is defined before redirecting
      if (!redirectUrl) {
        console.error("❌ Redirect URL is undefined, role:", role);
        throw new Error("Could not determine redirect location. Please contact support.");
      }
      
      navigate(redirectUrl, { replace: true });
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md">
      <div className="mb-6">
        <h3 className="text-2xl font-bold" style={{ color: "#1A1A1A" }}>
          {mode === "signup" ? "Create Account" : "Welcome Back"}
        </h3>
        <p className="text-sm mt-1" style={{ color: "#5A5A5A" }}>
          {mode === "signup" ? "Enter your details to get started" : "Login to your dashboard"}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {mode === "signup" && (
          <>
            <div className="space-y-2">
              <Label htmlFor="firstName" style={{ color: "#1A1A1A" }}>First Name</Label>
              <Input 
                id="firstName" 
                type="text" 
                placeholder="John" 
                value={firstName} 
                onChange={(e) => setFirstName(e.target.value)} 
                required 
                className="rounded-lg border-gray-200 focus:border-[#E63946] focus:ring-[#E63946]"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="lastName" style={{ color: "#1A1A1A" }}>Last Name</Label>
              <Input 
                id="lastName" 
                type="text" 
                placeholder="Doe" 
                value={lastName} 
                onChange={(e) => setLastName(e.target.value)} 
                required 
                className="rounded-lg border-gray-200 focus:border-[#E63946] focus:ring-[#E63946]"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" style={{ color: "#1A1A1A" }}>Email</Label>
              <Input 
                id="email" 
                type="email" 
                placeholder="your@email.com" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                required 
                className="rounded-lg border-gray-200 focus:border-[#E63946] focus:ring-[#E63946]"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" style={{ color: "#1A1A1A" }}>Password</Label>
              <Input 
                id="password" 
                type="password" 
                placeholder="Enter your password" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                required 
                minLength={6} 
                className="rounded-lg border-gray-200 focus:border-[#E63946] focus:ring-[#E63946]"
              />
            </div>

          </>
        )}

        {mode === "login" && (
          <>
            <div className="space-y-2">
              <Label htmlFor="login-email" style={{ color: "#1A1A1A" }}>Email</Label>
              <Input 
                id="login-email" 
                type="email" 
                placeholder="your@email.com" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                required 
                className="rounded-lg border-gray-200 focus:border-[#E63946] focus:ring-[#E63946]"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="login-password" style={{ color: "#1A1A1A" }}>Password</Label>
              <Input 
                id="login-password" 
                type="password" 
                placeholder="Enter your password" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                required 
                className="rounded-lg border-gray-200 focus:border-[#E63946] focus:ring-[#E63946]"
              />
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                className="text-sm font-medium text-[#E63946] hover:underline"
                onClick={() => navigate(buildForgotPasswordPath(passwordResetReturnTo))}
              >
                Forgot password?
              </button>
            </div>
          </>
        )}

        <Button 
          type="submit" 
          className="w-full rounded-full font-semibold py-6 mt-6 border-0 shadow-lg hover:shadow-xl transition-all" 
          style={{ backgroundColor: "#E63946", color: "white" }}
          disabled={loading}
        >
          {loading ? "Please wait..." : mode === "signup" ? "Sign Up" : "Login"}
        </Button>
      </form>
    </div>
  );
}

