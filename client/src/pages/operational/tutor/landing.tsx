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
import { getTutorCycleDefinitions } from "@/lib/intakeWindows";
import { buildTrackedPath, buildTrackedReturnTo } from "@/lib/publicTracking";

const specialistCycles = getTutorCycleDefinitions();

const developmentStages = [
  { title: "Application", body: "Submit your application and required documents. We review your eligibility, mathematical capability, and readiness for the programme." },
  { title: "Training", body: "Learn the Response Integrity method: how sessions are structured, what to observe, how to support the student, and how to document delivery." },
  { title: "Sandbox practice", body: "Practise using the platform and running sessions before working with real families. Use feedback to identify mistakes and improve your execution." },
  { title: "Trial", body: "Work with two families and complete nine qualifying sessions with each. Session evidence, reports, family feedback, and outcome reviews are assessed." },
  { title: "Certification", body: "Your complete Trial evidence is reviewed. Certification requires every evidence gate and explicit COO approval; completing the training period alone is not enough." },
] as const;

const craftCapabilities = [
  { title: "Observe the response", body: "Notice when a student loses their next step, rushes an attempt, stops, or begins relying on prompts." },
  { title: "Guide structured practice", body: "Follow the session method so that every activity has a defined purpose and the student does the required thinking." },
  { title: "Support without taking over", body: "Learn when to explain, when to prompt, and when to give the student space to attempt the next step." },
  { title: "Keep accurate records", body: "Document what the student did, where support was needed, and what the session evidence actually shows." },
] as const;

const fitSignals = [
  "You have completed Matric and can provide the required certified certificate.",
  "You are strong in mathematics and want to learn how to work responsibly with students.",
  "You are willing to prepare, follow a structured method, and keep accurate records.",
  "You can use feedback to improve how you deliver the next session.",
] as const;

const roleRequirements = [
  "Prepare properly and follow through on scheduled commitments.",
  "Use the defined session method instead of inventing a different approach for each student.",
  "Record delivery honestly so that decisions are supported by evidence.",
  "Adjust your execution when review or feedback identifies a problem.",
] as const;

export default function TutorLanding() {
  const navigate = useNavigate();
  const location = useLocation();
  const landingReturnTo = buildTrackedReturnTo(location.pathname, location.search);
  const fastTrackEnabled = isFastTrackAccessEnabled(location.search);
  const fastTrackBadge = getFastTrackBadgeLabel(location.search);
  const fastTrackDescription = getFastTrackDescription(location.search);
  const fastTrackParams = getFastTrackExtraParams(location.search);

  const intakeEntryPath = buildTrackedPath("/operational/specialist/intake", location.search, {
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

  const scrollToPathway = () => {
    document.getElementById("development-pathway")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#FFF5ED] text-[#171311]">
      <div
        className="fixed inset-0 -z-10"
        style={{
          background: "radial-gradient(circle at 10% 12%, rgba(214,62,45,0.10) 0%, rgba(214,62,45,0) 28%), radial-gradient(circle at 88% 8%, rgba(28,43,56,0.10) 0%, rgba(28,43,56,0) 25%), linear-gradient(180deg, #FFF8F2 0%, #FFF5ED 46%, #FFF0F0 100%)",
        }}
      />

      <header className="fixed inset-x-0 top-0 z-50 border-b border-[#E5D6C9] backdrop-blur-md" style={{ backgroundColor: "rgba(255, 245, 237, 0.95)" }}>
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-center px-3 sm:h-20 sm:justify-between sm:px-6 md:px-12">
          <div className="hidden sm:block sm:w-[120px]" aria-hidden="true" />
          <div className="flex-shrink-0 scale-90 origin-center"><ResponseIntegrityLogo size="lg" variant="integrity" /></div>
          <div className="hidden sm:block sm:w-[120px]" aria-hidden="true" />
        </div>
      </header>

      <div className="h-16 sm:h-20" />

      <main>
        <section className="mx-auto max-w-7xl px-4 pb-12 pt-6 sm:px-6 md:px-12 md:pb-16 md:pt-10">
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_330px]">
            <div className="overflow-hidden rounded-[34px] border border-[#E7CEC4] bg-[#FFF1E8] shadow-sm">
              <div className="p-6 sm:p-7 lg:p-9 xl:p-10">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8A4B35]">Specialist development pathway</p>
                <h1 className="mt-5 max-w-4xl text-4xl font-bold leading-[0.98] tracking-[-0.05em] text-[#171311] sm:text-5xl lg:text-[4.1rem] xl:text-[4.55rem]">
                  Learn to help students move forward
                  <span className="mt-2 block max-w-3xl text-[#E63946]">when maths gets difficult.</span>
                </h1>
                <div className="mt-6 max-w-3xl space-y-3 text-base leading-7 text-[#534A43] sm:text-[17px]">
                  <p>Train as a <strong className="font-semibold text-[#171311]">Response Conditioning Specialist</strong>. Learn to guide structured practice, recognise how a student responds when they get stuck, and help them take a clear next step.</p>
                  <p>You bring mathematical ability and a willingness to learn. The pathway takes you through the method, practice, and real student sessions before certification.</p>
                </div>
                <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                  <Button size="lg" className="rounded-full px-8 shadow-sm" style={{ backgroundColor: "#E63946" }} onClick={() => navigate(intakeEntryPath)}>
                    View Application Dates<ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                  <Button size="lg" variant="outline" className="rounded-full border-[#D7C0AF] bg-white/70 px-8 text-[#171311] hover:bg-white" onClick={scrollToPathway}>
                    Explore the Pathway
                  </Button>
                  <button type="button" className="px-2 text-sm font-semibold text-[#8A4B35] underline-offset-4 hover:underline" onClick={() => navigate(loginEntryPath)}>
                    Already a specialist? Log in
                  </button>
                </div>
              </div>
            </div>

            <div className="grid gap-4 xl:content-start">
              <Card className="rounded-[28px] border border-[#2A211D] bg-[#1F1814] p-5 text-white shadow-[0_18px_50px_rgba(25,19,16,0.18)]">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#E63946]">The student problem</p>
                <h2 className="mt-4 text-2xl font-bold tracking-tight">Knowing the maths is not always enough.</h2>
                <p className="mt-4 text-sm leading-7 text-white/78">When a student gets stuck, they may rush, guess, stop, or wait for someone to take over. Your work is to help them practise a better response.</p>
              </Card>
              <Card className="rounded-[28px] border border-[#E5D3C5] bg-white/82 p-5 shadow-sm">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8A4B35]">A skill you can develop</p>
                <h2 className="mt-3 text-2xl font-bold tracking-tight text-[#171311]">Knowing the maths is the starting point.</h2>
                <p className="mt-3 text-sm leading-6 text-[#5D5550]">Observation, clear communication, structured practice, and knowing when to step in are part of the craft you will learn.</p>
              </Card>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 pb-14 sm:px-6 md:px-12">
          <div className="rounded-[30px] border border-[#E5D3C5] bg-white/86 p-7 shadow-sm sm:p-8">
            <div className="max-w-3xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8A4B35]">The work</p>
              <h2 className="mt-1 text-3xl font-bold tracking-tight text-[#171311]">What happens after a student gets stuck?</h2>
              <p className="mt-3 text-sm leading-7 text-[#4F4742] sm:text-base">You learn to notice the student&apos;s response and guide what happens next. The aim is not simply to get them through one question. It is to help them practise approaching difficulty with greater clarity and independence.</p>
              <p className="mt-3 text-sm leading-7 text-[#4F4742] sm:text-base">You work within a defined method, use the platform to guide delivery, and record what actually happened during the session.</p>
            </div>
            <div className="mt-7 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {craftCapabilities.map((item) => (
                <Card key={item.title} className="rounded-[24px] border border-[#EEDFD3] bg-[#FFF8F3] p-5 shadow-none">
                  <h3 className="text-lg font-bold tracking-tight text-[#171311]">{item.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-[#4F4742]">{item.body}</p>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section id="development-pathway" className="scroll-mt-24 mx-auto max-w-7xl px-4 pb-14 sm:px-6 md:px-12">
          <div className="rounded-[30px] border border-[#E5D3C5] bg-white/86 p-7 shadow-sm sm:p-8">
            <div className="max-w-3xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8A4B35]">Your development pathway</p>
              <h2 className="mt-1 text-3xl font-bold tracking-tight text-[#171311]">Learn the method. Practise it. Demonstrate readiness.</h2>
              <p className="mt-3 text-sm leading-7 text-[#4F4742] sm:text-base">You are not expected to arrive as a finished specialist. You are expected to take the learning seriously, practise consistently, and use feedback to improve.</p>
            </div>
            <div className="mt-7 grid gap-4 lg:grid-cols-5">
              {developmentStages.map((item, index) => (
                <div key={item.title} className="rounded-[24px] border border-[#EEDFD3] bg-[#FFF8F3] p-5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#E63946]">{String(index + 1).padStart(2, "0")}</p>
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
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8A4B35]">Who should apply</p>
              <h2 className="mt-2 text-3xl font-bold tracking-tight text-[#171311]">Strong in maths. Willing to learn the craft.</h2>
              <p className="mt-3 text-sm leading-7 text-[#4F4742]">This pathway is for people who want to develop the ability to work responsibly with students - not simply explain answers.</p>
              <div className="mt-7 space-y-4">
                {fitSignals.map((item) => (
                  <div key={item} className="rounded-[22px] border border-[#EEDFD3] bg-[#FFF8F3] p-5">
                    <div className="flex items-start gap-3"><Check className="mt-1 h-4 w-4 flex-shrink-0 text-[#E63946]" /><p className="text-sm leading-7 text-[#4F4742]">{item}</p></div>
                  </div>
                ))}
              </div>
              <p className="mt-6 text-sm leading-7 text-[#4F4742]">Applicants must be 18 or older, unless they completed Matric early and can provide the required certified certificate.</p>
            </Card>

            <Card className="rounded-[30px] border border-[#2F2621] bg-[#201916] p-7 text-white shadow-sm sm:p-8">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#E63946]">What the role requires</p>
              <h2 className="mt-2 text-3xl font-bold tracking-tight">The structure is part of the responsibility.</h2>
              <p className="mt-3 text-sm leading-7 text-white/78">This is not an informal homework-help arrangement. Sessions follow a defined method, delivery must be documented accurately, and your work will be reviewed.</p>
              <div className="mt-7 space-y-4">
                {roleRequirements.map((item) => <div key={item} className="rounded-[22px] border border-white/10 bg-white/5 p-5"><p className="text-sm leading-7 text-white/82">{item}</p></div>)}
              </div>
            </Card>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 pb-14 sm:px-6 md:px-12">
          <div className="rounded-[30px] border border-[#E5D3C5] bg-white/86 p-7 shadow-sm sm:p-8">
            <div className="max-w-3xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8A4B35]">Before you apply</p>
              <h2 className="mt-1 text-3xl font-bold tracking-tight text-[#171311]">Understand the commitment and the earning pathway.</h2>
              <p className="mt-3 text-sm leading-7 text-[#4F4742] sm:text-base">These are part of the opportunity, not fine print. Read them before deciding whether the pathway is right for you.</p>
            </div>
            <div className="mt-7 grid gap-4 lg:grid-cols-3">
              <Card className="rounded-[24px] border border-[#EEDFD3] bg-[#FFF8F3] p-5 shadow-none">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#E63946]">Development window</p>
                <h3 className="mt-3 text-xl font-bold tracking-tight text-[#171311]">75 active days is the standard window.</h3>
                <p className="mt-3 text-sm leading-7 text-[#4F4742]">Progression depends on meeting each required standard. Reaching the final day does not create certification.</p>
              </Card>
              <Card className="rounded-[24px] border border-[#EEDFD3] bg-[#FFF8F3] p-5 shadow-none">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#E63946]">Certification phase</p>
                <h3 className="mt-3 text-xl font-bold tracking-tight text-[#171311]">The certification phase is unpaid.</h3>
                <p className="mt-3 text-sm leading-7 text-[#4F4742]">Successful certification may lead to paid delivery, but it does not guarantee employment, student assignments, or income.</p>
              </Card>
              <Card className="rounded-[24px] border border-[#EEDFD3] bg-[#FFF8F3] p-5 shadow-none">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#E63946]">Paid delivery</p>
                <h3 className="mt-3 text-xl font-bold tracking-tight text-[#171311]">Evidence supports every earning claim.</h3>
                <p className="mt-3 text-sm leading-7 text-[#4F4742]">After deployment, earnings accrue per qualifying, evidence-backed session. Payouts follow the relevant package-completion schedule.</p>
              </Card>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 pb-14 sm:px-6 md:px-12">
          <div className="rounded-[30px] border border-[#E5D3C5] bg-white/86 p-7 shadow-sm sm:p-8">
            <div className="max-w-3xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8A4B35]">Application dates</p>
              <h2 className="mt-1 text-3xl font-bold tracking-tight text-[#171311]">Find your next opportunity to apply.</h2>
              <p className="mt-3 text-sm leading-7 text-[#4F4742] sm:text-base">Applications open during scheduled intake periods. Check the current status before you begin - the full pathway starts after entry and follows its own evidence-gated 75-day window.</p>
            </div>
            <div className="mt-7 grid gap-4 lg:grid-cols-2">
              {specialistCycles.map((cycle) => (
                <Card key={cycle.key} className="rounded-[26px] border border-[#EEDFD3] bg-[#FFF8F3] p-6 shadow-none">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#E63946]">{cycle.supportsLabel}</p>
                  <h3 className="mt-3 text-2xl font-bold tracking-tight text-[#171311]">{cycle.label.replace("Operator", "Specialist")}</h3>
                  <div className="mt-5">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-[#8A4B35]">Application window</p>
                    <p className="mt-2 text-sm font-semibold leading-6 text-[#171311]">{cycle.applicationWindowLabel}</p>
                  </div>
                </Card>
              ))}
            </div>
            <Button size="lg" className="mt-7 rounded-full px-8 shadow-sm" style={{ backgroundColor: "#E63946" }} onClick={() => navigate(intakeEntryPath)}>
              View Current Application Status<ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6 md:px-12 md:py-20">
          <div className="rounded-[32px] border border-[#E5D3C5] bg-white/82 px-6 py-10 text-center shadow-sm sm:px-10 sm:py-12">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8A4B35]">Your next step</p>
            <h2 className="mt-4 text-3xl font-bold leading-tight text-[#171311] sm:text-4xl">Ready to develop the skill?<span className="block text-[#E63946]">Understand the commitment, then apply.</span></h2>
            <p className="mx-auto mt-6 max-w-3xl text-base leading-8 text-[#57504B] sm:text-lg">Check whether applications are open and review the current intake before beginning your application.</p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Button size="lg" className="rounded-full px-8 shadow-sm" style={{ backgroundColor: "#E63946" }} onClick={() => navigate(intakeEntryPath)}>View Application Dates</Button>
              <Button size="lg" variant="outline" className="rounded-full border-[#D7C0AF] bg-white/70 px-8 text-[#171311] hover:bg-white" onClick={() => navigate(loginEntryPath)}>Specialist Login</Button>
            </div>
          </div>
        </section>

        {fastTrackEnabled ? (
          <section className="mx-auto max-w-5xl px-4 pb-16 sm:px-6 md:px-12">
            <div className="rounded-[32px] border border-dashed border-[#D9B8AA] bg-[#FFF8F4] px-6 py-10 shadow-sm sm:px-10 sm:py-12">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8A4B35]">{fastTrackBadge}</p>
              <h2 className="mt-4 text-3xl font-bold leading-tight text-[#171311] sm:text-4xl">Private specialist access is available.</h2>
              <p className="mt-6 max-w-3xl text-base leading-8 text-[#57504B] sm:text-lg">{fastTrackDescription}</p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button size="lg" className="rounded-full px-8 shadow-sm" style={{ backgroundColor: "#171311", color: "white" }} onClick={() => navigate(directSignupPath)}>
                  Private Specialist Access<ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          </section>
        ) : null}
      </main>

      <footer className="border-t border-black/5 py-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 sm:px-6 md:flex-row md:px-12">
          <ResponseIntegrityLogo size="md" variant="integrity" />
          <p className="text-center text-xs text-[#5A5A5A] md:text-right">Copyright {new Date().getFullYear()} Response Integrity (Pty) Ltd<br />Specialist Gateway</p>
        </div>
      </footer>
    </div>
  );
}
