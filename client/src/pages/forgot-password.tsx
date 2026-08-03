import { FormEvent, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabaseClient";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft } from "lucide-react";
import { ResponseIntegrityLogo } from "@/components/ResponseIntegrityLogo";
import { getPasswordResetFallbackLoginPath, storePasswordResetReturnTo } from "@/lib/password-reset-navigation";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const { toast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const returnTo = useMemo(() => getPasswordResetFallbackLoginPath(location.search), [location.search]);

  useEffect(() => {
    storePasswordResetReturnTo(returnTo);
  }, [returnTo]);

  const goBackToLogin = () => {
    navigate(returnTo);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);

    try {
      storePasswordResetReturnTo(returnTo);
      const callbackUrl = new URL("/auth/callback", window.location.origin);
      callbackUrl.searchParams.set("next", "/reset-password");
      callbackUrl.searchParams.set("returnTo", returnTo);
      const redirectTo = callbackUrl.toString();
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo,
      });

      if (error) {
        throw error;
      }

      setSubmitted(true);
      toast({
        title: "Reset email sent",
        description: "Check your inbox for instructions to reset your password.",
      });
    } catch (err: any) {
      toast({
        title: "Unable to send reset email",
        description: err.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#FFF5ED" }}>
      <header className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md" style={{ backgroundColor: "rgba(255, 245, 237, 0.95)" }}>
        <div className="max-w-7xl mx-auto px-3 sm:px-6 md:px-12 h-28 sm:h-20 pb-6 sm:pb-0 flex items-end sm:items-center justify-center md:justify-between">
          <div className="hidden md:block md:w-[140px]" aria-hidden="true" />
          <ResponseIntegrityLogo size="lg" variant="integrity" />
          <Button
            variant="ghost"
            className="hidden md:inline-flex text-sm sm:text-base font-medium hover:bg-transparent items-center gap-1 sm:gap-2 px-2 sm:px-4"
            style={{ color: "#1A1A1A" }}
            onClick={goBackToLogin}
          >
            <ArrowLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            Back to Login
          </Button>
        </div>
      </header>

      <div className="h-28 sm:h-20" />

      <div className="flex-1 flex items-center justify-center px-4 sm:px-6 py-8 sm:py-12">
        <div className="w-full max-w-md space-y-6 sm:space-y-8">
          <div className="text-center space-y-3 sm:space-y-4">
            <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full mx-auto" style={{ backgroundColor: "#FFF0F0" }}>
              <span className="text-xs sm:text-sm font-medium" style={{ color: "#E63946" }}>
                Reset Password
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold" style={{ color: "#1A1A1A" }}>
              Forgot your password?
            </h2>
            <p className="text-base sm:text-lg" style={{ color: "#5A5A5A" }}>
              Enter your email and we will send a password reset link.
            </p>
          </div>

          <div className="rounded-xl sm:rounded-2xl p-5 sm:p-8 shadow-lg" style={{ backgroundColor: "white" }}>
            {submitted ? (
              <div className="space-y-4">
                <p className="text-sm text-[#1A1A1A]">
                  If an account with that email exists, a password reset email has been sent.
                </p>
                <Button
                  className="w-full rounded-full font-semibold py-6 mt-6 border-0 shadow-lg hover:shadow-xl transition-all"
                  style={{ backgroundColor: "#E63946", color: "white" }}
                  onClick={() => navigate(returnTo)}
                >
                  Return to Login
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="forgot-email" style={{ color: "#1A1A1A" }}>Email</Label>
                  <Input
                    id="forgot-email"
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="rounded-lg border-gray-200 focus:border-[#E63946] focus:ring-[#E63946]"
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full rounded-full font-semibold py-6 mt-6 border-0 shadow-lg hover:shadow-xl transition-all"
                  style={{ backgroundColor: "#E63946", color: "white" }}
                  disabled={loading}
                >
                  {loading ? "Sending..." : "Send reset link"}
                </Button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
