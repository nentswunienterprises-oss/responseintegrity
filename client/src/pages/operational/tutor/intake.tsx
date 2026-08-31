import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  getFastTrackBadgeLabel,
  getFastTrackDescription,
  getFastTrackExtraParams,
  isFastTrackAccessEnabled,
} from "@/lib/fastTrackAccess";
import { ResponseIntegrityLogo } from "@/components/ResponseIntegrityLogo";
import { buildTrackedPath, buildTrackedReturnTo, resolveTrackedBackTarget } from "@/lib/publicTracking";
import { getTutorCycleDefinitions, getTutorIntakeStatus } from "@/lib/intakeWindows";
import { ArrowLeft, ArrowRight, LogIn } from "lucide-react";
import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

const pathwayStages = [
  {
    title: "Applicant Mode",
    body: "You apply, submit documents, and are screened for fit before the system opens more trust.",
  },
  {
    title: "Training Mode",
    body: "You learn the Response Integrity OS and prove you can operate inside structure, not just explain math.",
  },
  {
    title: "Sandbox Mode",
    body: "You move through protected practice pressure where execution is checked before live student responsibility opens.",
  },
  {
    title: "Trial",
    body: "You carry exactly two governed Trial families and complete nine qualifying sessions per family before certification can be reviewed.",
  },
  {
    title: "Certified Live",
    body: "Only tutors with complete Trial evidence and explicit COO approval become deployable into the live student pool.",
  },
] as const;

export default function TutorIntakeEntry() {
  const navigate = useNavigate();
  const location = useLocation();
  const status = getTutorIntakeStatus();
  const cycleDefinitions = getTutorCycleDefinitions();
  const backTarget = resolveTrackedBackTarget(location.search, "/operational/specialist/landing");
  const intakeReturnTo = buildTrackedReturnTo(location.pathname, location.search);
  const fastTrackEnabled = isFastTrackAccessEnabled(location.search);
  const fastTrackBadge = getFastTrackBadgeLabel(location.search);
  const fastTrackDescription = getFastTrackDescription(location.search);
  const fastTrackParams = getFastTrackExtraParams(location.search);

  const loginPath = buildTrackedPath("/operational/signup", location.search, {
    role: "tutor",
    mode: "login",
    lock: "login",
    returnTo: intakeReturnTo,
    ...fastTrackParams,
  });

  const signupPath = status.isOpen && status.activeCycle
    ? buildTrackedPath("/operational/signup", location.search, {
        role: "tutor",
        mode: "signup",
        lock: "signup",
        cycle: status.activeCycle.key,
        returnTo: intakeReturnTo,
        ...fastTrackParams,
      })
    : fastTrackEnabled
      ? buildTrackedPath("/operational/signup", location.search, {
          role: "tutor",
          mode: "signup",
          returnTo: intakeReturnTo,
          ...fastTrackParams,
        })
    : null;

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#FFF5ED] text-[#171311]">
      <div
        className="fixed inset-0 -z-10"
        style={{
          background:
            "radial-gradient(circle at 10% 12%, rgba(214,62,45,0.10) 0%, rgba(214,62,45,0) 28%), radial-gradient(circle at 88% 8%, rgba(28,43,56,0.10) 0%, rgba(28,43,56,0) 25%), linear-gradient(180deg, #FFF8F2 0%, #FFF5ED 46%, #FFF0F0 100%)",
        }}
      />

      <header
        className="fixed inset-x-0 top-0 z-50 border-b border-[#E5D6C9] backdrop-blur-md"
        style={{ backgroundColor: "rgba(255, 245, 237, 0.95)" }}
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-3 sm:h-20 sm:px-6 md:px-12">
          <Button
            variant="ghost"
            className="rounded-full px-2 text-sm font-medium text-[#171311] hover:bg-transparent sm:px-4 sm:text-base"
            onClick={() => navigate(backTarget)}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>

          <div className="hidden sm:block">
            <ResponseIntegrityLogo size="md" variant="integrity" />
          </div>

          <Button
            className="rounded-full px-4 text-sm font-semibold sm:px-6 sm:text-base"
            style={{ backgroundColor: "#E63946", color: "white" }}
            onClick={() => navigate(loginPath)}
          >
            Log In
          </Button>
        </div>
      </header>

      <div className="h-16 sm:h-20" />

      <main className="mx-auto max-w-7xl px-4 pb-16 pt-6 sm:px-6 md:px-12 md:pb-20 md:pt-10">
        <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="overflow-hidden rounded-[34px] border border-[#E7CEC4] bg-[#FFF1E8] shadow-sm">
            <div className="p-6 sm:p-8 lg:p-10">
              <div className="inline-flex rounded-full border border-[#E9CFC2] bg-[#FFF4EE]/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#8A3024] shadow-sm">
                Specialist intake gateway
              </div>
              <h1 className="mt-5 max-w-4xl text-4xl font-bold leading-[0.95] tracking-[-0.05em] text-[#171311] sm:text-5xl lg:text-[4.15rem]">
                {status.isOpen ? "Check the current specialist window." : "Specialist entry is protected by window."}
              </h1>
              <div className="mt-6 max-w-3xl space-y-3 text-base leading-7 text-[#534A43] sm:text-[17px]">
                <p className="font-semibold text-[#E63946]">{status.heading}</p>
                <p>{status.summary}</p>
                <p>{status.detail}</p>
              </div>

              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                {signupPath ? (
                  <Button
                    size="lg"
                    className="rounded-full px-8 shadow-sm"
                    style={{ backgroundColor: "#E63946" }}
                    onClick={() => navigate(signupPath)}
                  >
                    Continue to Specialist Application
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                ) : (
                  <Button
                    size="lg"
                    className="rounded-full px-8 shadow-sm"
                    style={{ backgroundColor: "#171311", color: "white" }}
                    onClick={() => navigate(backTarget)}
                  >
                    Return to Specialist Landing
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                )}
                <Button
                  size="lg"
                  variant="outline"
                  className="rounded-full border-[#D7C0AF] bg-white/75 px-8 text-[#171311] hover:bg-white"
                  onClick={() => navigate(loginPath)}
                >
                  Already In The System? Log In
                </Button>
              </div>
            </div>
          </div>

          <div className="grid gap-4 xl:content-start">
            <Card className="rounded-[28px] border border-[#2A211D] bg-[#1F1814] p-5 text-white shadow-[0_18px_50px_rgba(25,19,16,0.18)]">
              <p className="text-sm font-bold uppercase tracking-tight text-[#E63946]">Today In The Specialist Rhythm</p>
              <div className="mt-6 space-y-4 text-sm text-white/82">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-white/55">Date</p>
                  <p className="mt-1 text-base font-semibold text-white">{status.todayLabel}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-white/55">Current status</p>
                  <p className="mt-1 text-base font-semibold text-white">{status.badge}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-white/55">Next application window</p>
                  <p className="mt-1 text-base font-semibold text-white">{status.nextOpeningLabel}</p>
                </div>
              </div>
            </Card>

            <Card className="rounded-[28px] border border-[#E5D3C5] bg-white/84 p-5 shadow-sm">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8A4B35]">Protected standard</p>
                <p className="mt-3 text-base font-semibold leading-7 text-[#171311]">
                  Two certification cycles.
                  <br />
                  Evidence before trust.
                  <br />
                  No casual specialist entry.
                </p>
              </div>
            </Card>
          </div>
        </section>

        <section className="mt-10 grid gap-4 lg:grid-cols-2">
          {cycleDefinitions.map((cycle) => {
            const isActive = status.activeCycle?.key === cycle.key;

            return (
              <Card
                key={cycle.key}
                className={`rounded-[28px] border p-6 shadow-sm ${
                  isActive ? "border-[#E63946] bg-[#FFF7F4]" : "border-[#E5D3C5] bg-white/88"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8A4B35]">
                      {cycle.supportsLabel}
                    </p>
                    <h2 className="mt-2 text-2xl font-bold tracking-tight text-[#171311]">{cycle.label}</h2>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${
                      isActive ? "bg-[#E63946] text-white" : "bg-[#FFF2EC] text-[#8A4B35]"
                    }`}
                  >
                    {isActive ? "Current cycle" : "Defined cycle"}
                  </span>
                </div>

                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.18em] text-[#8A4B35]">Application window</p>
                    <p className="mt-2 text-base font-semibold text-[#171311]">{cycle.applicationWindowLabel}</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.18em] text-[#8A4B35]">Conditioning window</p>
                    <p className="mt-2 text-base font-semibold text-[#171311]">{cycle.conditioningWindowLabel}</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.18em] text-[#8A4B35]">Certification deadline</p>
                    <p className="mt-2 text-base font-semibold text-[#171311]">{cycle.certificationDeadlineLabel}</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.18em] text-[#8A4B35]">Deployment begins</p>
                    <p className="mt-2 text-base font-semibold text-[#171311]">{cycle.deploymentBeginsLabel}</p>
                  </div>
                </div>

                <p className="mt-6 text-sm leading-7 text-[#564E48]">
                  Deployment lock-in runs {cycle.deploymentLockInLabel}. The window determines when a specialist can become deployable, even though evidence determines whether they certify.
                </p>
              </Card>
            );
          })}
        </section>

        <section className="mt-10 rounded-[30px] border border-[#E5D3C5] bg-white/86 p-7 shadow-sm sm:p-8">
          <div className="max-w-3xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8A4B35]">How trust opens</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-[#171311]">The intake window creates entry. Evidence creates trust.</h2>
            <p className="mt-4 text-sm leading-7 text-[#534B45] sm:text-base">
              Response Integrity does not hire tutors casually. The application window gets you into the system. What happens after that is earned through applicant mode, training pressure, sandbox readiness, governed Trial validation, and explicit live certification.
            </p>
          </div>

          <div className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {pathwayStages.map((stage, index) => (
              <Card key={stage.title} className="rounded-[24px] border border-[#EEDFD3] bg-[#FFF8F3] p-5 shadow-none">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#E63946]">
                  {String(index + 1).padStart(2, "0")}
                </p>
                <h3 className="mt-3 text-lg font-bold tracking-tight text-[#171311]">{stage.title}</h3>
                <p className="mt-3 text-sm leading-7 text-[#4F4742]">{stage.body}</p>
              </Card>
            ))}
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            {signupPath ? (
              <Button
                size="lg"
                className="rounded-full px-8 shadow-sm"
                style={{ backgroundColor: "#E63946" }}
                onClick={() => navigate(signupPath)}
              >
                Continue to Specialist Application
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            ) : null}
            <Button
              size="lg"
              variant="outline"
              className="rounded-full border-[#D7C0AF] bg-white/75 px-8 text-[#171311] hover:bg-white"
              onClick={() => navigate(loginPath)}
            >
              <LogIn className="mr-2 h-4 w-4" />
              Continue to Log In
            </Button>
            {!signupPath ? (
              <Button
                size="lg"
                variant="ghost"
                className="rounded-full px-4 text-[#171311] hover:bg-white/70"
                onClick={() => navigate(backTarget)}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Specialist Landing
              </Button>
            ) : null}
          </div>
        </section>

        {fastTrackEnabled ? (
          <section className="mt-10 rounded-[30px] border border-dashed border-[#D9B8AA] bg-[#FFF8F4] p-7 shadow-sm sm:p-8">
            <div className="max-w-3xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8A4B35]">
                {fastTrackBadge}
              </p>
              <h2 className="mt-2 text-3xl font-bold tracking-tight text-[#171311]">Private specialist access is available.</h2>
              <p className="mt-4 text-sm leading-7 text-[#534B45] sm:text-base">{fastTrackDescription}</p>
            </div>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Button
                size="lg"
                className="rounded-full px-8 shadow-sm"
                style={{ backgroundColor: "#171311", color: "white" }}
                onClick={() => navigate(buildTrackedPath("/operational/signup", location.search, {
                  role: "tutor",
                  mode: "signup",
                  returnTo: intakeReturnTo,
                  ...fastTrackParams,
                }))}
              >
                Enter Private Specialist Access
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}
