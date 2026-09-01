import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowRight, Check, ChevronDown, Eye, LockKeyhole, Repeat, ShieldCheck, Target, TimerReset, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ResponseIntegrityLogo } from "@/components/ResponseIntegrityLogo";
import { buildTrackedPath, buildTrackedReturnTo } from "@/lib/publicTracking";

const pathway = [
  {
    stage: "Application",
    proof: "Prove eligibility",
    detail:
      "We look for completed matric, strong mathematical capability, discipline, communication ability, and evidence that you can learn quickly.",
  },
  {
    stage: "Training",
    proof: "Prove understanding",
    detail:
      "You study the Response Integrity method, the student response problem, session execution, observation, documentation, and specialist standards.",
  },
  {
    stage: "Sandbox",
    proof: "Prove system competence",
    detail:
      "You practise the platform and session structure in a controlled environment before any real family responsibility opens.",
  },
  {
    stage: "Trials",
    proof: "Prove real-world execution",
    detail:
      "Trial-ready specialists work with two families, each receiving approximately nine Response Integrity sessions during the certification phase.",
  },
  {
    stage: "Certification",
    proof: "Prove readiness",
    detail:
      "Certification is earned only when the required evidence gates are satisfied. Day 75 does not certify anyone by itself.",
  },
] as const;

const foundingStandards = [
  {
    title: "Transfer the method without weakening it",
    body:
      "The first cohort establishes that the Response Integrity method can be executed by trained specialists while preserving the standard.",
  },
  {
    title: "Operate the system with process integrity",
    body:
      "Specialists are expected to follow the operating model, use the platform correctly, and keep the intervention from drifting into ordinary tutoring.",
  },
  {
    title: "Produce observable change with real students",
    body:
      "Trial delivery is used to show whether the specialist can create the intended student experience across different learners, families, and response patterns.",
  },
  {
    title: "Strengthen the operating system through delivery",
    body:
      "The first cohort gives Response Integrity live evidence about training, tools, session records, reporting, and quality control under real delivery conditions.",
  },
  {
    title: "Earn deployment through demonstrated capability",
    body:
      "The economic opportunity begins only after certification because responsibility must follow evidence, not confidence, charisma, or time spent in training.",
  },
] as const;

const specialistCraft = [
  {
    icon: Target,
    title: "Condition execution under difficulty",
    body:
      "The specialist is developed to do more than explain mathematics correctly. They learn to introduce difficulty deliberately, maintain structure when the learner struggles, and train the learner's response to difficulty. The capability being developed is execution conditioning.",
  },
  {
    icon: Repeat,
    title: "Prepare before pressure arrives",
    body:
      "A Response Conditioning Specialist is trained to think beyond the next homework question or upcoming test. They help the learner accumulate evidence that they can handle the work. The capability being developed is deliberate preparation.",
  },
  {
    icon: Eye,
    title: "Apply good pressure through observation",
    body:
      "A Response Conditioning Specialist is trained to see what happens between the question and the answer. They learn to ask what happened to the learner's response while they were trying to get there. The capability being developed is diagnostic observation.",
  },
  {
    icon: ShieldCheck,
    title: "Make mistakes usable",
    body:
      "A Response Conditioning Specialist must know how to make mistakes usable. They learn when to intervene and when to allow the learner to struggle productively. The capability being developed is psychological safety with learning discipline.",
  },
  {
    icon: UserCheck,
    title: "Give responsive individual attention",
    body:
      "A Response Conditioning Specialist is trained to work with the learner in front of them, not with an imaginary average student. They learn to adjust the session to the learner's actual response. The capability being developed is responsive attention.",
  },
  {
    icon: LockKeyhole,
    title: "Operate the system with integrity",
    body:
      "A Response Conditioning Specialist does not need to invent their own tutoring philosophy. They learn to operate the Response Integrity system with structure, discipline, responsibility, and consistent operational behaviour. The capability being developed is system execution.",
  },
] as const;

const fitSignals = [
  "You have completed matric and can reason confidently through mathematics.",
  "You can follow a system precisely without needing to improvise to feel useful.",
  "You stay composed when a student freezes, rushes, guesses, or becomes uncertain.",
  "You can accept correction, tighten execution, and take responsibility for your standard.",
] as const;

const evaluationAreas = [
  "Student experience",
  "Specialist execution",
  "Parent experience",
  "Process integrity",
  "Outcomes",
] as const;

export default function SpecialistLanding() {
  const navigate = useNavigate();
  const location = useLocation();
  const [selectedStage, setSelectedStage] = useState(0);
  const [openQuestion, setOpenQuestion] = useState(0);

  const returnTo = buildTrackedReturnTo(location.pathname, location.search);
  const applyPath = useMemo(
    () =>
      buildTrackedPath("/operational/specialist/intake", location.search, {
        returnTo,
      }),
    [location.search, returnTo],
  );
  const loginPath = useMemo(
    () =>
      buildTrackedPath("/operational/signup", location.search, {
        role: "tutor",
        mode: "login",
        lock: "login",
        returnTo,
      }),
    [location.search, returnTo],
  );

  return (
    <div className="min-h-screen overflow-x-hidden bg-[var(--ri-cream)] text-[var(--ri-charcoal)]">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-[var(--ri-warm-border)] bg-[rgba(var(--ri-cream-rgb),0.94)] backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:h-20 sm:px-6 md:px-12">
          <ResponseIntegrityLogo size="lg" variant="integrity" />
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              className="hidden text-sm font-semibold text-[var(--ri-charcoal)] hover:bg-transparent sm:inline-flex"
              onClick={() => navigate(loginPath)}
            >
              Log In
            </Button>
            <Button
              className="rounded-full bg-[var(--ri-red)] px-5 text-sm font-semibold text-white hover:bg-[var(--ri-red)]"
              onClick={() => navigate(applyPath)}
            >
              Apply
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="pt-16 sm:pt-20">
        <section className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 sm:py-14 md:px-12 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-center">
          <div className="max-w-4xl">
            <p className="inline-flex rounded-full border border-[var(--ri-warm-border)] bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--ri-red)]">
              12 places available
            </p>
            <h1 className="mt-6 text-4xl font-bold leading-[1.02] tracking-normal text-[var(--ri-charcoal)] sm:text-5xl lg:text-6xl">
              Become A Response Conditioning Specialist.
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-[var(--ri-muted)]">
              Learn the system. Prove you can execute it. Earn certification through evidence, real trials, and disciplined delivery with students.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button
                size="lg"
                className="rounded-full bg-[var(--ri-red)] px-8 text-white hover:bg-[var(--ri-red)]"
                onClick={() => navigate(applyPath)}
              >
                Apply for the Cohort
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="rounded-full border-[var(--ri-warm-border)] bg-white px-8 text-[var(--ri-charcoal)] hover:bg-white"
                onClick={() => document.getElementById("pathway")?.scrollIntoView({ behavior: "smooth" })}
              >
                See the Pathway
              </Button>
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-[var(--ri-warm-border)] bg-white shadow-sm">
            <img
              src="/images/founding-tutors-hero.webp"
              alt="Response Integrity specialist candidate preparing for online student delivery"
              className="h-60 w-full object-cover sm:h-72"
            />
            <div className="grid grid-cols-3 divide-x divide-[var(--ri-warm-border)]">
              <div className="p-4">
                <p className="text-2xl font-bold text-[var(--ri-red)]">75</p>
                <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--ri-muted)]">days</p>
              </div>
              <div className="p-4">
                <p className="text-2xl font-bold text-[var(--ri-red)]">18</p>
                <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--ri-muted)]">trial sessions</p>
              </div>
              <div className="p-4">
                <p className="text-2xl font-bold text-[var(--ri-red)]">2</p>
                <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--ri-muted)]">families</p>
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-[var(--ri-dark-border)] bg-[var(--ri-charcoal)] py-12 text-white sm:py-16">
          <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 md:px-12 lg:grid-cols-[0.9fr_1.1fr]">
            <div>
              <h2 className="mt-3 text-3xl font-bold tracking-normal sm:text-4xl">
                You are applying to learn a system for changing response under difficulty.
              </h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                { icon: Target, text: "Math is the area. Response is the skill." },
                { icon: ShieldCheck, text: "Trust opens only after evidence." },
                { icon: TimerReset, text: "Pressure is trained deliberately." },
                { icon: LockKeyhole, text: "Process integrity matters." },
              ].map(({ icon: Icon, text }) => (
                <div key={text} className="rounded-lg border border-white/10 bg-white/5 p-5">
                  <Icon className="h-5 w-5 text-[var(--ri-red)]" />
                  <p className="mt-4 text-sm leading-6 text-white/82">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 md:px-12">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--ri-red)]">The craft</p>
            <h2 className="mt-3 text-3xl font-bold tracking-normal sm:text-4xl">Develop the craft of making people better.</h2>
            <p className="mt-4 text-base leading-7 text-[var(--ri-muted)]">
              A Response Conditioning Specialist does not need to invent a tutoring philosophy. The platform provides the structure. The specialist learns to interpret the learner's state, use the tools correctly, apply the required intervention, and maintain session integrity.
            </p>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {specialistCraft.map(({ icon: Icon, title, body }) => (
              <div key={title} className="rounded-lg border border-[var(--ri-warm-border)] bg-white p-5 shadow-sm">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--ri-blush)]">
                  <Icon className="h-5 w-5 text-[var(--ri-red)]" />
                </div>
                <h3 className="mt-5 text-lg font-bold tracking-normal text-[var(--ri-charcoal)]">{title}</h3>
                <p className="mt-3 text-sm leading-7 text-[var(--ri-muted)]">{body}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="pathway" className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 md:px-12">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--ri-red)]">The path to certification</p>
            <h2 className="mt-3 text-3xl font-bold tracking-normal sm:text-4xl">75 days is the window. Evidence is the gate.</h2>
            <p className="mt-4 text-base leading-7 text-[var(--ri-muted)]">
              Day 1 to Day 75 is the opportunity to complete the required training, sandbox competency, Trial delivery, evidence requirements, and review standard. Certification happens only when those gates are satisfied.
            </p>
          </div>

          <div className="mt-8 grid gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
            <div className="grid gap-2">
              {pathway.map((item, index) => (
                <button
                  key={item.stage}
                  type="button"
                  className={`rounded-lg border p-4 text-left transition ${
                    selectedStage === index
                      ? "border-[var(--ri-red)] bg-white shadow-sm"
                      : "border-[var(--ri-warm-border)] bg-white/60 hover:bg-white"
                  }`}
                  onClick={() => setSelectedStage(index)}
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--ri-red)]">
                    {String(index + 1).padStart(2, "0")}
                  </p>
                  <p className="mt-2 font-bold text-[var(--ri-charcoal)]">{item.stage}</p>
                </button>
              ))}
            </div>

            <div className="rounded-lg border border-[var(--ri-warm-border)] bg-white p-6 shadow-sm sm:p-8">
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--ri-red)]">
                {pathway[selectedStage].proof}
              </p>
              <h3 className="mt-3 text-3xl font-bold tracking-normal text-[var(--ri-charcoal)]">
                {pathway[selectedStage].stage}
              </h3>
              <p className="mt-4 text-base leading-8 text-[var(--ri-muted)]">{pathway[selectedStage].detail}</p>
              <div className="mt-8 rounded-lg border border-[var(--ri-warm-border)] bg-[var(--ri-blush)] p-5">
                <p className="text-sm font-semibold text-[var(--ri-charcoal)]">Evidence before responsibility.</p>
                <p className="mt-2 text-sm leading-6 text-[var(--ri-muted)]">
                  Each stage asks whether you are ready for the next level of student and family trust. Time creates structure; evidence creates permission.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-white py-12 sm:py-16">
          <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 md:px-12 lg:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--ri-red)]">Who should apply</p>
              <h2 className="mt-3 text-3xl font-bold tracking-normal sm:text-4xl">Built for capable young people with real discipline.</h2>
              <div className="mt-7 grid gap-3">
                {fitSignals.map((signal) => (
                  <div key={signal} className="flex gap-3 rounded-lg border border-[var(--ri-warm-border)] bg-[var(--ri-cream)] p-4">
                    <Check className="mt-1 h-4 w-4 flex-shrink-0 text-[var(--ri-red)]" />
                    <p className="text-sm leading-6 text-[var(--ri-muted)]">{signal}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-[var(--ri-warm-border)] bg-[var(--ri-cream)] p-6 sm:p-8">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--ri-red)]">What we evaluate</p>
              <div className="mt-5 grid gap-3">
                {evaluationAreas.map((area) => (
                  <div key={area} className="flex items-center justify-between rounded-lg bg-white px-4 py-3">
                    <span className="text-sm font-semibold text-[var(--ri-charcoal)]">{area}</span>
                    <Check className="h-4 w-4 text-[var(--ri-red)]" />
                  </div>
                ))}
              </div>
              <p className="mt-6 text-sm leading-7 text-[var(--ri-muted)]">
                Positive outcomes across both families form part of the evidence considered for certification.
              </p>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 md:px-12">
          <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr]">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--ri-red)]">Founding cohort standard</p>
              <h2 className="mt-3 text-3xl font-bold tracking-normal sm:text-4xl">The first cohort establishes the specialist standard.</h2>
              <p className="mt-4 text-base leading-8 text-[var(--ri-muted)]">
                Later cohorts will inherit the standard this group helps make visible. Your execution, evidence, and feedback shape how Response Integrity trains specialists without losing the discipline of the system.
              </p>
            </div>

            <div className="divide-y divide-[var(--ri-warm-border)] rounded-lg border border-[var(--ri-warm-border)] bg-white shadow-sm">
              {foundingStandards.map((standard, index) => {
                const isOpen = openQuestion === index;

                return (
                  <button
                    key={standard.title}
                    type="button"
                    className="block w-full p-5 text-left"
                    onClick={() => setOpenQuestion(isOpen ? -1 : index)}
                  >
                    <span className="flex items-center justify-between gap-4">
                      <span className="text-sm font-semibold leading-6 text-[var(--ri-charcoal)]">{standard.title}</span>
                      <ChevronDown className={`h-4 w-4 flex-shrink-0 text-[var(--ri-red)] transition ${isOpen ? "rotate-180" : ""}`} />
                    </span>
                    {isOpen ? (
                      <span className="mt-3 block text-sm leading-7 text-[var(--ri-muted)]">
                        {standard.body}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        <section className="bg-[var(--ri-charcoal)] py-12 text-white sm:py-16">
          <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 md:px-12">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--ri-dark-copy)]">Pilot cohort</p>
            <h2 className="mt-3 text-3xl font-bold tracking-normal sm:text-4xl">Certification phase is unpaid. Deployment creates earning eligibility.</h2>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-8 text-white/72">
              Successful certification may lead to deployment into Response Integrity Pods and paid service delivery. This is not guaranteed employment or guaranteed income.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Button
                size="lg"
                className="rounded-full bg-[var(--ri-red)] px-8 text-white hover:bg-[var(--ri-red)]"
                onClick={() => navigate(applyPath)}
              >
                Become A Response Conditioning Specialist
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="rounded-full border-white/20 bg-transparent px-8 text-white hover:bg-white/10 hover:text-white"
                onClick={() => navigate(loginPath)}
              >
                Existing Specialist Login
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-[var(--ri-warm-border)] bg-[var(--ri-cream)] py-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 sm:px-6 md:flex-row md:px-12">
          <ResponseIntegrityLogo size="md" variant="integrity" />
          <p className="text-center text-xs leading-5 text-[var(--ri-muted)] md:text-right">
            Completed matric required.
            <br />
            Evidence before responsibility.
          </p>
        </div>
      </footer>
    </div>
  );
}
