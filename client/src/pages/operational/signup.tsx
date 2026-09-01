import { useEffect, useState } from "react";
import { AuthForm } from "@/components/auth/auth-form";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  getFastTrackBadgeLabel,
  getFastTrackDescription,
  isFastTrackAccessEnabled,
} from "@/lib/fastTrackAccess";
import { getTutorCycleLabel } from "@/lib/intakeWindows";
import { resolveTrackedBackTarget } from "@/lib/publicTracking";
import { useLocation, useNavigate } from "react-router-dom";
import { Crown, ArrowLeft, ArrowRight, Check } from "lucide-react";

export default function OperationalSignup() {
  const location = useLocation();
  const navigate = useNavigate();
  const urlParams = new URLSearchParams(location.search);
  const roleParam = urlParams.get("role");
  const modeParam = urlParams.get("mode");
  const lockParam = urlParams.get("lock");
  const initialRole = roleParam === "tutor" ? "tutor" : roleParam === "td" ? "td" : null;
  const lockedMode = lockParam === "login" || lockParam === "signup"
    ? (lockParam as "signup" | "login")
    : null;
  const initialMode = lockedMode ?? (modeParam === "login" ? "login" : "signup");

  const [selectedRole, setSelectedRole] = useState<"tutor" | "td" | null>(initialRole);
  const [mode, setMode] = useState<"signup" | "login">(initialMode);
  const termsHref = selectedRole === "td" ? "/td-terms-of-use" : "/specialist-terms-of-use";
  const cycleLabel = getTutorCycleLabel(urlParams.get("cycle"));
  const fastTrackEnabled = isFastTrackAccessEnabled(location.search);
  const fastTrackBadge = getFastTrackBadgeLabel(location.search);
  const fastTrackDescription = getFastTrackDescription(location.search);
  const backTarget = resolveTrackedBackTarget(
    location.search,
    initialRole === "tutor" ? "/operational/specialist/landing" : "/operational/landing",
  );

  useEffect(() => {
    setSelectedRole(initialRole);
    setMode(initialMode);
  }, [initialMode, initialRole]);

  if (!selectedRole) {
    return (
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#FFF5ED" }}>
        <header className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md" style={{ backgroundColor: "rgba(255, 245, 237, 0.95)" }}>
          <div className="max-w-7xl mx-auto px-3 sm:px-6 md:px-12 h-16 sm:h-20 flex items-center justify-between">
            <Button
              variant="ghost"
              className="text-sm sm:text-base font-medium hover:bg-transparent flex items-center gap-1 sm:gap-2 px-2 sm:px-4"
              style={{ color: "#1A1A1A" }}
              onClick={() => navigate(backTarget)}
            >
              <ArrowLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              Back
            </Button>

            <span className="text-lg sm:text-xl lg:text-2xl font-bold tracking-tight" style={{ color: "#1A1A1A" }}>
              JOIN OUR TEAM
            </span>

            <div className="w-16 sm:w-20" />
          </div>
        </header>

        <div className="h-16 sm:h-20" />

        <div className="flex-1 flex items-center justify-center px-6 py-12">
          <div className="w-full max-w-screen-xl space-y-10">
            <div className="text-center space-y-4">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full" style={{ backgroundColor: "#FFF0F0" }}>
                <span className="text-sm font-medium" style={{ color: "#E63946" }}>
                  Choose Your Role
                </span>
              </div>
              <h2 className="text-3xl md:text-4xl font-bold" style={{ color: "#1A1A1A" }}>
                How Would You Like to <span style={{ color: "#E63946" }}>Make an Impact?</span>
              </h2>
              <p style={{ color: "#5A5A5A" }}>
                Select whether you&apos;re joining as a Specialist or Territory Director
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              <Card
                className="p-8 border-0 shadow-lg hover:shadow-xl transition-all cursor-pointer group flex flex-col h-full min-w-0"
                style={{ backgroundColor: "white" }}
                onClick={() => setSelectedRole("tutor")}
              >
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform"
                  style={{ backgroundColor: "#FFF0F0" }}
                />
                <h3 className="text-2xl font-bold mb-3" style={{ color: "#1A1A1A" }}>Specialist</h3>
                <p className="mb-6" style={{ color: "#5A5A5A" }}>
                  Lead student Response Pods and train execution
                </p>
                <ul className="space-y-2 mb-6">
                  {["Learn the Operating System", "Be part of proof", "Shape the future"].map((item) => (
                    <li key={item} className="flex items-center gap-2 text-sm" style={{ color: "#5A5A5A" }}>
                      <Check className="w-4 h-4" style={{ color: "#E63946" }} />
                      {item}
                    </li>
                  ))}
                </ul>
                <Button
                  className="w-full px-4 sm:px-6 rounded-full py-2.5 sm:py-3.5 mt-auto font-semibold border-0 text-center box-border"
                  style={{ backgroundColor: "#E63946", color: "white" }}
                >
                  Continue as Specialist
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Card>

              <Card
                className="p-8 border-0 shadow-lg hover:shadow-xl transition-all cursor-pointer group flex flex-col h-full min-w-0"
                style={{ backgroundColor: "white" }}
                onClick={() => setSelectedRole("td")}
              >
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform"
                  style={{ backgroundColor: "#FFF0F0" }}
                >
                  <Crown className="w-8 h-8" style={{ color: "#E63946" }} />
                </div>
                <h3 className="text-2xl font-bold mb-3" style={{ color: "#1A1A1A" }}>Territory Director</h3>
                <p className="mb-6" style={{ color: "#5A5A5A" }}>
                  Oversee multiple pods, tutors, and ensure quality consistency
                </p>
                <ul className="space-y-2 mb-6">
                  {["Lead the method rollout", "Build founding pods", "Own a territory"].map((item) => (
                    <li key={item} className="flex items-center gap-2 text-sm" style={{ color: "#5A5A5A" }}>
                      <Check className="w-4 h-4" style={{ color: "#E63946" }} />
                      {item}
                    </li>
                  ))}
                </ul>
                <Button
                  className="w-full px-4 sm:px-6 rounded-full py-2.5 sm:py-3.5 mt-auto font-semibold border-0 text-center box-border"
                  style={{ backgroundColor: "#E63946", color: "white" }}
                >
                  Continue as Director
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Card>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const isTutorRole = selectedRole === "tutor";
  const title = isTutorRole
    ? lockedMode === "login"
      ? "Continue to Specialist Login"
      : lockedMode === "signup"
        ? fastTrackEnabled && !urlParams.get("cycle")
          ? "Continue to Specialist Access"
          : "Continue to Specialist Application"
        : fastTrackEnabled
          ? "Specialist Access"
        : "Join as a Specialist"
    : "Join as Territory Director";
  const description = isTutorRole
    ? lockedMode === "login"
      ? "Existing tutors continue here. This route is reserved for login only."
      : lockedMode === "signup"
        ? fastTrackEnabled && !urlParams.get("cycle")
          ? fastTrackDescription ?? "This path is available by invitation while the public intake gate remains unchanged."
          : `${cycleLabel} entry continues here. This route is reserved for application only.`
        : fastTrackEnabled
          ? fastTrackDescription ?? "This path is available by invitation while the public intake gate remains unchanged."
        : "Help transform students and condition reliable responses to math pressure."
    : "Lead a territory and oversee multiple pods and tutors.";
  const badgeText = isTutorRole
    ? lockedMode === "login"
      ? "Existing Specialist Access"
      : lockedMode === "signup"
        ? fastTrackEnabled && !urlParams.get("cycle")
          ? fastTrackBadge ?? cycleLabel
          : cycleLabel
        : fastTrackEnabled
          ? fastTrackBadge ?? "Specialist Access"
        : "Specialist Access"
    : "Territory Director Access";

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#FFF5ED" }}>
      <header className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md" style={{ backgroundColor: "rgba(255, 245, 237, 0.95)" }}>
        <div className="max-w-7xl mx-auto px-6 md:px-12 h-20 flex items-center justify-between">
          <Button
            variant="ghost"
            className="text-base font-medium hover:bg-transparent flex items-center gap-2"
            style={{ color: "#1A1A1A" }}
            onClick={() => {
              if (!initialRole) {
                setSelectedRole(null);
                return;
              }

              navigate(backTarget);
            }}
          >
            <ArrowLeft className="w-4 h-4" />
            {!initialRole ? "Back to Roles" : "Back"}
          </Button>

          <span className="text-xl lg:text-2xl font-bold tracking-tight" style={{ color: "#1A1A1A" }}>
            {selectedRole === "tutor" ? "SPECIALIST" : "TERRITORY DIRECTOR"}
          </span>

          <div className="w-28" />
        </div>
      </header>

      <div className="h-20" />

      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center space-y-4">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto"
              style={{ backgroundColor: "#FFF0F0" }}
            >
              {selectedRole === "tutor" ? null : (
                <Crown className="w-8 h-8" style={{ color: "#E63946" }} />
              )}
            </div>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full mx-auto" style={{ backgroundColor: "#FFF0F0" }}>
              <span className="text-xs font-medium" style={{ color: "#E63946" }}>
                {badgeText}
              </span>
            </div>
            <h2 className="text-3xl font-bold" style={{ color: "#1A1A1A" }}>
              {title}
            </h2>
            <p style={{ color: "#5A5A5A" }}>
              {description}
            </p>
          </div>

          {lockedMode ? null : (
            <div className="flex gap-2 justify-center p-1 rounded-full" style={{ backgroundColor: "#FFF0F0" }}>
              <button
                className={`flex-1 py-2 sm:py-3 px-4 sm:px-6 rounded-full font-semibold text-sm sm:text-base transition-all ${
                  mode === "login" ? "shadow-md" : ""
                }`}
                style={{
                  backgroundColor: mode === "login" ? "#E63946" : "transparent",
                  color: mode === "login" ? "white" : "#5A5A5A",
                }}
                onClick={() => setMode("login")}
              >
                Login
              </button>

              <button
                className={`flex-1 py-2 sm:py-3 px-4 sm:px-6 rounded-full font-semibold text-sm sm:text-base transition-all ${
                  mode === "signup" ? "shadow-md" : ""
                }`}
                style={{
                  backgroundColor: mode === "signup" ? "#E63946" : "transparent",
                  color: mode === "signup" ? "white" : "#5A5A5A",
                }}
                onClick={() => setMode("signup")}
              >
                Sign Up
              </button>
            </div>
          )}

          <Card className="p-8 border-0 shadow-lg" style={{ backgroundColor: "white" }}>
            <AuthForm mode={mode} defaultRole={selectedRole} />
          </Card>

          <p className="text-xs text-center" style={{ color: "#5A5A5A" }}>
            By signing up, you agree to our{" "}
            <a href={termsHref} target="_blank" className="underline hover:text-[#E63946]" style={{ color: "#1A1A1A" }}>
              Terms of Use
            </a>{" "}
            and{" "}
            <a href="/privacy-policy" target="_blank" className="underline hover:text-[#E63946]" style={{ color: "#1A1A1A" }}>
              Privacy Policy
            </a>.
          </p>
        </div>
      </div>
    </div>
  );
}
