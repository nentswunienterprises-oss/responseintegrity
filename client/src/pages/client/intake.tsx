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
import { getParentIntakeDefinitions, getParentIntakeStatus } from "@/lib/intakeWindows";
import { ArrowLeft, ArrowRight, LogIn } from "lucide-react";
import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

export default function ParentIntakeEntry() {
  const navigate = useNavigate();
  const location = useLocation();
  const status = getParentIntakeStatus();
  const intakeDefinitions = getParentIntakeDefinitions();
  const backTarget = resolveTrackedBackTarget(location.search, "/");
  const intakeReturnTo = buildTrackedReturnTo(location.pathname, location.search);
  const fastTrackEnabled = isFastTrackAccessEnabled(location.search);
  const fastTrackBadge = getFastTrackBadgeLabel(location.search);
  const fastTrackDescription = getFastTrackDescription(location.search);
  const fastTrackParams = getFastTrackExtraParams(location.search);

  const loginPath = buildTrackedPath("/client/signup", location.search, {
    mode: "login",
    lock: "login",
    returnTo: intakeReturnTo,
    ...fastTrackParams,
  });

  const signupPath = status.activeDefinition
    ? buildTrackedPath("/client/signup", location.search, {
        mode: "signup",
        lock: "signup",
        intake: status.activeDefinition.key,
        returnTo: intakeReturnTo,
        ...fastTrackParams,
      })
    : fastTrackEnabled
      ? buildTrackedPath("/client/signup", location.search, {
          mode: "signup",
          returnTo: intakeReturnTo,
          ...fastTrackParams,
        })
    : null;

  const operatingModelPath = buildTrackedPath("/about/how-we-operate", location.search, {
    returnTo: intakeReturnTo,
  });

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#FFF5ED] text-[#171311]">
      <div className="fixed inset-0 -z-10 bg-[#FFF5ED]" />

      <header
        className="fixed inset-x-0 top-0 z-50 border-b border-[#E8D6CB] backdrop-blur-md"
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
                Parent intake gateway
              </div>
              <h1 className="mt-5 max-w-4xl text-4xl font-bold leading-[0.95] tracking-[-0.05em] text-[#171311] sm:text-5xl lg:text-[4.15rem]">
                {status.isOpen ? "Enter through the current intake." : "Protected entry starts here."}
              </h1>
              <div className="mt-6 max-w-3xl space-y-3 text-base leading-7 text-[#544B45] sm:text-[17px]">
                <p className="font-semibold text-[#7C2D21]">{status.heading}</p>
                <p>{status.summary}</p>
              </div>

              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                {signupPath ? (
                  <Button
                    size="lg"
                    className="rounded-full px-8 shadow-sm"
                    style={{ backgroundColor: "#E63946" }}
                    onClick={() => navigate(signupPath)}
                  >
                    Continue to Parent Sign Up
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                ) : (
                  <Button
                    size="lg"
                    className="rounded-full px-8 shadow-sm"
                    style={{ backgroundColor: "#171311", color: "white" }}
                    onClick={() => navigate(operatingModelPath)}
                  >
                    See How We Operate
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                )}
                <Button
                  size="lg"
                  variant="outline"
                  className="rounded-full border-[#D7C0AF] bg-white/75 px-8 text-[#171311] hover:bg-white"
                  onClick={() => navigate(loginPath)}
                >
                  Already Enrolled? Log In
                </Button>
              </div>
            </div>
          </div>

          <div className="grid gap-4 xl:content-start">
            <Card className="rounded-[28px] border border-[#2A211D] bg-[#1F1814] p-5 text-white shadow-[0_18px_50px_rgba(25,19,16,0.18)]">
              <p className="text-sm font-bold uppercase tracking-tight text-[#E63946]">Today In The Rhythm</p>
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
                  <p className="text-[11px] uppercase tracking-[0.18em] text-white/55">Next opening</p>
                  <p className="mt-1 text-base font-semibold text-white">{status.nextOpeningLabel}</p>
                </div>
              </div>
            </Card>

            <Card className="rounded-[28px] border border-[#E5D3C5] bg-white/84 p-5 shadow-sm">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8A4B35]">Protected standard</p>
                <p className="mt-3 text-base font-semibold leading-7 text-[#171311]">
                  Two annual intakes.
                  <br />
                  Fixed cadence.
                  <br />
                  No panic enrollment.
                </p>
              </div>
            </Card>
          </div>
        </section>

        <section className="mt-10 grid gap-4 lg:grid-cols-2">
          {intakeDefinitions.map((definition) => {
            const isActive = status.activeDefinition?.key === definition.key;

            return (
              <Card
                key={definition.key}
                className={`rounded-[28px] border p-6 shadow-sm ${
                  isActive ? "border-[#E63946] bg-[#FFF7F4]" : "border-[#E5D3C5] bg-white/88"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8A4B35]">
                      {definition.shortLabel}
                    </p>
                    <h2 className="mt-2 text-2xl font-bold tracking-tight text-[#171311]">{definition.label}</h2>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${
                      isActive ? "bg-[#E63946] text-white" : "bg-[#FFF2EC] text-[#8A4B35]"
                    }`}
                  >
                    {isActive ? "Open now" : "Defined window"}
                  </span>
                </div>

                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.18em] text-[#8A4B35]">Enrollment window</p>
                    <p className="mt-2 text-base font-semibold text-[#171311]">{definition.windowLabel}</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.18em] text-[#8A4B35]">Training start</p>
                    <p className="mt-2 text-base font-semibold text-[#171311]">{definition.trainingBeginsLabel}</p>
                  </div>
                </div>

                <p className="mt-6 text-sm leading-7 text-[#564E48]">{definition.bestFor}</p>
                <div className="mt-4 space-y-2">
                  <p className="text-sm font-semibold text-[#171311]">{definition.cadenceLabel}</p>
                  (definition.additionalCadenceLabels ?? []).map((cadence) => (
                    <p key={cadence} className="text-sm font-medium text-[#564E48]">{cadence}</p>
                  ))}
                </div>
              </Card>
            );
          })}
        </section>

        {fastTrackEnabled ? (
          <section className="mt-10 rounded-[30px] border border-dashed border-[#D9B8AA] bg-[#FFF8F4] p-7 shadow-sm sm:p-8">
            <div className="max-w-3xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8A4B35]">
                {fastTrackBadge}
              </p>
              <h2 className="mt-2 text-3xl font-bold tracking-tight text-[#171311]">Direct signup is temporarily unlocked.</h2>
              <p className="mt-4 text-sm leading-7 text-[#534B45] sm:text-base">{fastTrackDescription}</p>
            </div>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Button
                size="lg"
                className="rounded-full px-8 shadow-sm"
                style={{ backgroundColor: "#171311", color: "white" }}
                onClick={() => navigate(buildTrackedPath("/client/signup", location.search, {
                  mode: "signup",
                  returnTo: intakeReturnTo,
                  ...fastTrackParams,
                }))}
              >
                Enter Direct Parent Signup
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}
