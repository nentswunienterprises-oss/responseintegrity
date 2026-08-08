import React, { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ResponseIntegrityLogo } from "@/components/ResponseIntegrityLogo";
import {
  getFastTrackBadgeLabel,
  getFastTrackDescription,
  getFastTrackExtraParams,
  isFastTrackAccessEnabled,
} from "@/lib/fastTrackAccess";
import { buildTrackedPath, buildTrackedReturnTo } from "@/lib/publicTracking";

const operatorCycles = [
  {
    title: "Annual Tutor Certification Cycle",
    support: "Supports the Full-Year Conditioning Intake",
    applicationWindow: "1 October - 31 October",
    conditioningWindow: "1 November - 15 January",
    deploymentBegins: "1 February",
  },
  {
    title: "Mid-Year Tutor Certification Cycle",
    support: "Supports the Mid-Year Conditioning Intake",
    applicationWindow: "1 April - 30 April",
    conditioningWindow: "1 May - 20 May",
    deploymentBegins: "1 June",
  },
] as const;

const conditioningModes = [
  {
    title: "Applicant",
    body: "You are stepping into the system. Response Integrity checks your fit, your readiness, and whether you are ready for tutor responsibility.",
  },
  {
    title: "Training",
    body: "You learn the Response Integrity OS and show that you can hold structure, not just explain math clearly.",
  },
  {
    title: "Sandbox",
    body: "You begin operating in a protected practice lane. It feels real because it is meant to sharpen you, but full trust is still being built.",
  },
  {
    title: "Trial",
    body: "You operate in a supervised validation lane where your consistency and outcomes are checked before full live deployment.",
  },
  {
    title: "Certified Live",
    body: "You have shown stable alignment and can now carry real student and parent responsibility inside the live system.",
  },
] as const;

const fitSignals = [
  "You stay calm when a student is confused, slow, or frustrated.",
  "You do not need to freestyle to feel impressive.",
  "You can take correction fast without getting defensive.",
  "You care about doing the session properly, not just seeming helpful.",
] as const;

const nonFitSignals = [
  "You prefer a looser tutoring style and may not enjoy working inside a fixed operating standard.",
  "You tend to step in early when a student feels discomfort, rather than holding the learning process steady.",
  "You feel more drawn to keeping the interaction easy than to maintaining clear structure under pressure.",
  "You may find a high-feedback, high-correction environment harder to enjoy or sustain.",
] as const;

const roleBlocks = [
  {
    title: "What this role is",
    body: "A Response Integrity tutor helps students become clearer, steadier, and more reliable under pressure. The role is centered on structure, consistency, and real change.",
  },
  {
    title: "What this role is not",
    body: "This is not casual homework help, over-accommodating support, or personality-led tutoring. Response Integrity does not reward loose sessions or random teaching style.",
  },
  {
    title: "What the system protects",
    body: "The system protects clarity, structure, pressure discipline, and session integrity so student improvement is stable and repeatable.",
  },
  {
    title: "What ongoing users should expect",
    body: "If you already have an account, use the login entry point below. It opens directly on the tutor login side with no signup detour.",
  },
] as const;

export default function TutorLanding() {
  const navigate = useNavigate();
  const location = useLocation();
  const landingReturnTo = buildTrackedReturnTo(location.pathname, location.search);
  const fastTrackEnabled = isFastTrackAccessEnabled(location.search);
  const fastTrackBadge = getFastTrackBadgeLabel(location.search);
  const fastTrackDescription = getFastTrackDescription(location.search);
  const fastTrackParams = getFastTrackExtraParams(location.search);

  const intakeEntryPath = buildTrackedPath("/operational/tutor/intake", location.search, {
    returnTo: landingReturnTo,
    ...fastTrackParams,
  });

  const loginEntryPath = buildTrackedPath("/operational/signup", location.search, {
    role: "tutor",
    mode: "login",
    lock: "login",
    returnTo: landingReturnTo,
    ...fastTrackParams,
  });

  const directSignupPath = buildTrackedPath("/operational/signup", location.search, {
    role: "tutor",
    mode: "signup",
    returnTo: landingReturnTo,
    ...fastTrackParams,
  });

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
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-center px-3 sm:h-20 sm:justify-between sm:px-6 md:px-12">
          <div className="hidden sm:block sm:w-[120px]" aria-hidden="true" />

          <div className="flex-shrink-0 scale-90 origin-center sm:origin-center">
            <ResponseIntegrityLogo size="lg" variant="integrity" />
          </div>

          <div className="hidden sm:block sm:w-[120px]" aria-hidden="true" />
        </div>
      </header>

      <div className="h-16 sm:h-20" />

      <main>
        <section className="mx-auto max-w-7xl px-4 pb-12 pt-6 sm:px-6 md:px-12 md:pb-16 md:pt-10">
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_330px]">
            <div className="overflow-hidden rounded-[34px] border border-[#E7CEC4] bg-[#FFF1E8] shadow-sm">
              <div className="p-6 sm:p-7 lg:p-9 xl:p-10">
                <h1 className="mt-5 max-w-4xl text-4xl font-bold leading-[0.95] tracking-[-0.05em] text-[#171311] sm:text-5xl lg:text-[4.1rem] xl:text-[4.55rem]">
                  Become the kind of tutor
                  <span className="mt-2 block max-w-3xl text-[#E63946]">who stays calm, clear,</span>
                  <span className="mt-2 block max-w-3xl text-[#E63946]">and sharp when pressure rises.</span>
                </h1>
                <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_240px] lg:items-start">
                  <div className="max-w-2xl space-y-3 text-base leading-7 text-[#534A43] sm:text-[17px]">
                    <p>Response Integrity is looking for disciplined young people who are strong in math, coachable under pressure, and serious about building real skill.</p>
                    <p>Tutor entry happens through two certification cycles tied to the student intake rhythm. Existing tutors use the login path directly. New tutors first check the current tutor window.</p>
                  </div>
                  <div className="rounded-[24px] border border-[#E0CCBE] bg-white/58 p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8A4B35]">Role core</p>
                    <p className="mt-3 text-base font-semibold leading-7 text-[#171311]">
                      Learn fast.
                      <br />
                      Stay structured.
                      <br />
                      Hold standard.
                    </p>
                  </div>
                </div>

                <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                  <Button
                    size="lg"
                    className="rounded-full px-8 shadow-sm"
                    style={{ backgroundColor: "#E63946" }}
                    onClick={() => navigate(intakeEntryPath)}
                  >
                    Check Current Tutor Window
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    className="rounded-full border-[#D7C0AF] bg-white/70 px-8 text-[#171311] hover:bg-white"
                    onClick={() => navigate(loginEntryPath)}
                  >
                    Existing Tutor Login
                  </Button>
                </div>
              </div>
            </div>

            <div className="grid gap-4 xl:content-start">
              <Card className="rounded-[28px] border border-[#2A211D] bg-[#1F1814] p-5 text-white shadow-[0_18px_50px_rgba(25,19,16,0.18)]">
                <div className="flex items-start justify-between gap-4">
                  <span className="text-sm font-bold uppercase tracking-tight text-[#E63946]">WHAT RESPONSE INTEGRITY CARES ABOUT</span>
                  <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-white/75">
                    Response Integrity lane
                  </span>
                </div>
                <div className="mt-7 space-y-3 text-sm text-white/82">
                  <div>Clear thinking</div>
                  <div>Structured skill</div>
                  <div>Trust is earned through evidence</div>
                </div>
              </Card>

              <Card className="rounded-[28px] border border-[#E5D3C5] bg-white/82 p-5 shadow-sm">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8A4B35]">Simple truth</p>
                  <p className="mt-3 text-2xl font-bold tracking-tight text-[#171311]">Subject strength</p>
                  <p className="text-2xl font-bold tracking-tight text-[#171311]">is not enough on its own.</p>
                  <p className="mt-3 text-sm leading-6 text-[#5D5550]">Response Integrity opens responsibility in stages because real tutoring trust should be earned, not assumed.</p>
                </div>
              </Card>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 pb-14 sm:px-6 md:px-12">
          <div className="rounded-[30px] border border-[#E5D3C5] bg-white/86 p-7 shadow-sm sm:p-8">
            <div className="max-w-3xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8A4B35]">Tutor windows</p>
              <h2 className="mt-1 text-3xl font-bold tracking-tight text-[#171311]">Two certification cycles. Two deployment moments.</h2>
              <p className="mt-3 text-sm leading-7 text-[#4F4742] sm:text-base">
                Tutor intake follows the same disciplined rhythm as student entry. Applications open inside defined windows, conditioning happens by deadline, and only certified live tutors become deployable.
              </p>
            </div>

            <div className="mt-7 grid gap-4 lg:grid-cols-2">
              {operatorCycles.map((cycle) => (
                <Card key={cycle.title} className="rounded-[26px] border border-[#EEDFD3] bg-[#FFF8F3] p-6 shadow-none">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#E63946]">{cycle.support}</p>
                  <h3 className="mt-3 text-2xl font-bold tracking-tight text-[#171311]">{cycle.title}</h3>
                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.18em] text-[#8A4B35]">Application window</p>
                      <p className="mt-2 text-sm font-semibold leading-6 text-[#171311]">{cycle.applicationWindow}</p>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.18em] text-[#8A4B35]">Conditioning window</p>
                      <p className="mt-2 text-sm font-semibold leading-6 text-[#171311]">{cycle.conditioningWindow}</p>
                    </div>
                    <div className="sm:col-span-2">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-[#8A4B35]">Deployment begins</p>
                      <p className="mt-2 text-sm font-semibold leading-6 text-[#171311]">{cycle.deploymentBegins}</p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section id="conditioning-path" className="mx-auto max-w-7xl px-4 pb-14 sm:px-6 md:px-12">
          <div className="rounded-[30px] border border-[#E5D3C5] bg-white/86 p-7 shadow-sm sm:p-8">
            <div className="max-w-3xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8A4B35]">Conditioning path</p>
              <h2 className="mt-1 text-3xl font-bold tracking-tight text-[#171311]">How Response Integrity grows a tutor into trust</h2>
              <p className="mt-3 text-sm leading-7 text-[#4F4742] sm:text-base">
                You do not have to arrive fully formed. You do have to be coachable, disciplined, and able to keep improving. Response Integrity opens more trust as your standard gets stronger.
              </p>
            </div>

            <div className="mt-7 grid gap-4 lg:grid-cols-5">
              {conditioningModes.map((item, index) => (
                <div key={item.title} className="rounded-[24px] border border-[#EEDFD3] bg-[#FFF8F3] p-5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#E63946]">
                    {String(index + 1).padStart(2, "0")}
                  </p>
                  <h3 className="mt-3 text-lg font-bold tracking-tight text-[#171311]">{item.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-[#4F4742]">{item.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 pb-14 sm:px-6 md:px-12">
          <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
            <Card className="rounded-[30px] border border-[#E5D3C5] bg-white/86 p-7 shadow-sm sm:p-8">
              <div>
                <h2 className="text-3xl font-bold tracking-tight text-[#171311]">Who this is for</h2>
              </div>
              <div className="mt-7 space-y-4">
                {fitSignals.map((item) => (
                  <div key={item} className="rounded-[22px] border border-[#EEDFD3] bg-[#FFF8F3] p-5">
                    <div className="flex items-start gap-3">
                      <Check className="mt-1 h-4 w-4 flex-shrink-0 text-[#E63946]" />
                      <p className="text-sm leading-7 text-[#4F4742]">{item}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="rounded-[30px] border border-[#2F2621] bg-[#201916] p-7 text-white shadow-sm sm:p-8">
              <h2 className="mt-2 text-3xl font-bold tracking-tight">When this role may feel less natural</h2>
              <div className="mt-7 space-y-4">
                {nonFitSignals.map((item) => (
                  <div key={item} className="rounded-[22px] border border-white/10 bg-white/5 p-5">
                    <p className="text-sm leading-7 text-white/82">{item}</p>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 pb-14 sm:px-6 md:px-12">
          <div className="grid gap-4 sm:grid-cols-2">
            {roleBlocks.map((item) => (
              <Card key={item.title} className="rounded-[26px] border border-[#E4D2C4] bg-white p-6 shadow-sm">
                <h3 className="text-xl font-bold tracking-tight text-[#171311]">{item.title}</h3>
                <p className="mt-3 text-sm leading-7 text-[#574F49]">{item.body}</p>
              </Card>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6 md:px-12 md:py-20">
          <div className="rounded-[32px] border border-[#E5D3C5] bg-white/82 px-6 py-10 text-center shadow-sm sm:px-10 sm:py-12">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8A4B35]">Entry point</p>
            <h2 className="mt-4 text-3xl font-bold leading-tight text-[#171311] sm:text-4xl">
              Want to become a response-training specialist?
              <span className="block text-[#E63946]">Check the current tutor window first.</span>
            </h2>
            <p className="mx-auto mt-6 max-w-3xl text-base leading-8 text-[#57504B] sm:text-lg">
                New applicants begin through the intake-aware tutor gate. Existing tutors use the login button to open directly on the tutor login side.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Button
                size="lg"
                className="rounded-full px-8 shadow-sm"
                style={{ backgroundColor: "#E63946" }}
                onClick={() => navigate(intakeEntryPath)}
              >
                Check Current Tutor Window
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="rounded-full border-[#D7C0AF] bg-white/70 px-8 text-[#171311] hover:bg-white"
                onClick={() => navigate(loginEntryPath)}
              >
                Existing Tutor Login
              </Button>
            </div>
          </div>
        </section>

        {fastTrackEnabled ? (
          <section className="mx-auto max-w-5xl px-4 pb-16 sm:px-6 md:px-12">
            <div className="rounded-[32px] border border-dashed border-[#D9B8AA] bg-[#FFF8F4] px-6 py-10 shadow-sm sm:px-10 sm:py-12">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8A4B35]">{fastTrackBadge}</p>
              <h2 className="mt-4 text-3xl font-bold leading-tight text-[#171311] sm:text-4xl">
                Direct tutor signup is unlocked.
              </h2>
              <p className="mt-6 max-w-3xl text-base leading-8 text-[#57504B] sm:text-lg">
                {fastTrackDescription}
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button
                  size="lg"
                  className="rounded-full px-8 shadow-sm"
                  style={{ backgroundColor: "#171311", color: "white" }}
                  onClick={() => navigate(directSignupPath)}
                >
                  Direct Tutor Signup
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          </section>
        ) : null}
      </main>

      <footer className="border-t border-black/5 py-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 sm:px-6 md:flex-row md:px-12">
          <ResponseIntegrityLogo size="md" variant="integrity" />
          <p className="text-center text-xs text-[#5A5A5A] md:text-right">
            Copyright {new Date().getFullYear()} Response Integrity (Pty) Ltd
            <br />
            Tutor Gateway
          </p>
        </div>
      </footer>
    </div>
  );
}
