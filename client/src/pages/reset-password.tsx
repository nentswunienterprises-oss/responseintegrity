import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabaseClient";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft } from "lucide-react";
import { ResponseIntegrityLogo } from "@/components/ResponseIntegrityLogo";
import {
  buildForgotPasswordPath,
  clearPasswordResetReturnTo,
  getPasswordResetFallbackLoginPath,
} from "@/lib/password-reset-navigation";

export default function ResetPasswordPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const hashParams = useMemo(
    () => new URLSearchParams(location.hash.startsWith("#") ? location.hash.slice(1) : location.hash),
    [location.hash]
  );
  const returnTo = useMemo(() => getPasswordResetFallbackLoginPath(location.search), [location.search]);
  const [isRecovery, setIsRecovery] = useState(() => {
    return (
      searchParams.get("type") === "recovery" ||
      hashParams.get("type") === "recovery" ||
      searchParams.has("code") ||
      hashParams.has("access_token")
    );
  });

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [recoveringSession, setRecoveringSession] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const looksLikeRecoveryLink =
      searchParams.get("type") === "recovery" ||
      hashParams.get("type") === "recovery" ||
      searchParams.has("code") ||
      hashParams.has("access_token");

    if (looksLikeRecoveryLink) {
      setIsRecovery(true);
    }

    const ensureRecoverySession = async () => {
      if (!looksLikeRecoveryLink) {
        return;
      }

      setRecoveringSession(true);
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session?.access_token) {
          return;
        }

        const code = searchParams.get("code");
        if (!code) {
          return;
        }

        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          console.warn("Password recovery code exchange failed:", error.message);
        }
      } finally {
        setRecoveringSession(false);
      }
    };

    void ensureRecoverySession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setIsRecovery(true);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [hashParams, searchParams]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (recoveringSession) {
      toast({
        title: "Verifying reset link",
        description: "Please wait a moment and try again.",
      });
      return;
    }

    if (password.length < 6) {
      toast({
        title: "Password too short",
        description: "Use at least 6 characters.",
        variant: "destructive",
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: "Passwords do not match",
        description: "Please make sure both password fields match.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      let { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session?.access_token && searchParams.has("code")) {
        const code = searchParams.get("code");
        if (code) {
          await supabase.auth.exchangeCodeForSession(code);
          const nextSession = await supabase.auth.getSession();
          sessionData = nextSession.data;
        }
      }

      if (!sessionData.session?.access_token) {
        throw new Error("This reset link is invalid or expired. Please request a new password reset email.");
      }

      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        throw error;
      }

      clearPasswordResetReturnTo();
      setCompleted(true);
      toast({
        title: "Password updated",
        description: "Your password was reset successfully.",
      });
    } catch (err: any) {
      const rawMessage = typeof err?.message === "string" ? err.message : "";
      const isSessionError = /session not found|auth session missing|recovery session/i.test(rawMessage.toLowerCase());

      toast({
        title: "Unable to reset password",
        description: isSessionError
          ? "This reset link is invalid or expired. Please request a new password reset email."
          : rawMessage || "Please try again.",
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
            onClick={() => navigate(returnTo)}
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
                Password Reset
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold" style={{ color: "#1A1A1A" }}>
              {isRecovery ? "Set a new password" : "Password reset link required"}
            </h2>
            <p className="text-base sm:text-lg" style={{ color: "#5A5A5A" }}>
              {isRecovery
                ? "Enter your new password to complete account recovery."
                : "Please request a password reset link from the login page."}
            </p>
          </div>

          <div className="rounded-xl sm:rounded-2xl p-5 sm:p-8 shadow-lg" style={{ backgroundColor: "white" }}>
            {completed ? (
              <div className="space-y-4">
                <p className="text-sm text-[#1A1A1A]">
                  Your password has been updated. You can now login with your new password.
                </p>
                <Button
                  className="w-full rounded-full font-semibold py-6 mt-6 border-0 shadow-lg hover:shadow-xl transition-all"
                  style={{ backgroundColor: "#E63946", color: "white" }}
                  onClick={() => navigate(returnTo)}
                >
                  Return to Login
                </Button>
              </div>
            ) : isRecovery ? (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="new-password" style={{ color: "#1A1A1A" }}>New Password</Label>
                  <Input
                    id="new-password"
                    type="password"
                    placeholder="Enter new password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className="rounded-lg border-gray-200 focus:border-[#E63946] focus:ring-[#E63946]"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm-password" style={{ color: "#1A1A1A" }}>Confirm Password</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    placeholder="Confirm new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={6}
                    className="rounded-lg border-gray-200 focus:border-[#E63946] focus:ring-[#E63946]"
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full rounded-full font-semibold py-6 mt-6 border-0 shadow-lg hover:shadow-xl transition-all"
                  style={{ backgroundColor: "#E63946", color: "white" }}
                  disabled={loading || recoveringSession}
                >
                  {loading ? "Updating..." : recoveringSession ? "Verifying link..." : "Update password"}
                </Button>
              </form>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-[#1A1A1A]">
                  This page is only used after clicking a password reset link from your email.
                </p>
                <Button
                  className="w-full rounded-full font-semibold py-6 mt-6 border-0 shadow-lg hover:shadow-xl transition-all"
                  style={{ backgroundColor: "#E63946", color: "white" }}
                  onClick={() => navigate(buildForgotPasswordPath(returnTo))}
                >
                  Request a reset link
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
