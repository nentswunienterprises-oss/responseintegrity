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
import { ArrowRight, Check, Instagram } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

const whyWeExistResponsePatterns = [
  "Some freeze.",
  "Some rush.",
  "Some guess.",
  "Some avoid difficult questions.",
  "Some leave blanks.",
  "Some understand slowly, but lose structure under pressure.",
];

const responseIntegrityDifferentiators = [
  {
    label: "Attention",
    title: "Individual Attention At The Learner's Pace",
    paragraphs: [
      "In class, a learner can easily get hidden inside the speed of the group.",
      "With Response Integrity, the learner gets direct attention on how they think, where they pause, where they rush, where they lose structure, and what needs to be repeated.",
      "The session moves according to how the learner is actually responding, not the pace of the classroom.",
    ],
  },
  {
    label: "Safety",
    title: "A Safe Space To Make Mistakes",
    paragraphs: [
      "Many learners are afraid to ask questions in class because they do not want to look slow, be laughed at, or feel embarrassed.",
      "But learning requires mistakes.",
      "Response Integrity creates a private, judgment-free space where mistakes become training data, not shame.",
      "The learner can ask, try, fail, repeat, and grow without classroom social pressure.",
    ],
  },
  {
    label: "Observation",
    title: "Good Pressure Through Observation",
    paragraphs: [
      "When a learner practises alone, it is easy to skip hard questions, leave blanks, avoid discomfort, or only practise what feels familiar.",
      "With a Response Integrity tutor watching each rep, the learner cannot hide from the work.",
      "The tutor sees where the learner freezes, rushes, guesses, skips steps, avoids difficulty, or loses structure.",
      "That creates good pressure.",
      "Not shame.",
      "Not panic.",
      "Good pressure means the learner is observed closely enough for their real response pattern to become visible and trainable.",
    ],
  },
  {
    label: "Execution",
    title: "Execution Under Difficulty",
    paragraphs: [
      "Response Integrity is not only about helping learners understand mathematics.",
      "It trains them to stay calm, structured, and operational when mathematics becomes difficult.",
      "The goal is not blind speed.",
      "The goal is stable execution.",
      "We train learners to keep thinking, keep attempting, and keep structure when pressure rises.",
    ],
  },
  {
    label: "Preparation",
    title: "Preparation Before Pressure",
    paragraphs: [
      "Most academic support begins too late - when the test is close, the marks have dropped, or the parent is already worried.",
      "Response Integrity prepares the learner before pressure arrives.",
      "Through rhythm, repetition, exposure, correction, and structured practice, learners build confidence through evidence.",
      "They do not just hope they will cope in the exam.",
      "They train their response before the exam.",
    ],
  },
  {
    label: "System",
    title: "A Structured Method",
    paragraphs: [
      "Ordinary tutoring often depends on the tutor's personality, mood, teaching style, or natural ability.",
      "Response Integrity is different.",
      "Our tutors work through a structured operating model shaped by what the learner is working on and how much support or challenge they need in that moment.",
      "That means each session is not random.",
      "The learner receives the type of support, challenge, observation, and correction required for where they are in their development.",
    ],
  },
];

const khanyaParentTestimonial = {
  quote:
    "It is probably rare for a parent to share feedback before getting a report from school, but I can see the change already. Khanya has always been a child who did not like maths and school in general. Ever since she started with the sessions, her confidence has improved. She likes school now and enjoys Mathematics unlike before. Before, she never cared what mark she got for maths, but now she pushes harder because she believes she has the potential to get a level 7.",
  attribution: "Khanya's mom | Kempton Park, South Africa",
};

function PortalLanding() {
  const navigate = useNavigate();
  const location = useLocation();
  const landingReturnTo = buildTrackedReturnTo(location.pathname, location.search);
  const fastTrackEnabled = isFastTrackAccessEnabled(location.search);
  const fastTrackBadge = getFastTrackBadgeLabel(location.search);
  const fastTrackDescription = getFastTrackDescription(location.search);
  const fastTrackParams = getFastTrackExtraParams(location.search);

  const buildParentIntakeUrl = () =>
    buildTrackedPath("/client/intake", location.search, {
      returnTo: landingReturnTo,
      ...fastTrackParams,
    });

  const buildLoginUrl = () =>
    buildTrackedPath("/client/signup", location.search, {
      mode: "login",
      lock: "login",
      returnTo: landingReturnTo,
      ...fastTrackParams,
    });

  const buildDirectSignupUrl = () =>
    buildTrackedPath("/client/signup", location.search, {
      mode: "signup",
      returnTo: landingReturnTo,
      ...fastTrackParams,
    });

  const privacyPolicyUrl = buildTrackedPath("/privacy-policy", location.search, {
    returnTo: landingReturnTo,
  });

  const termsOfUseUrl = buildTrackedPath("/terms-of-use", location.search, {
    returnTo: landingReturnTo,
  });

  const aboutUrl = buildTrackedPath("/about", location.search, {
    returnTo: landingReturnTo,
  });

  const wallpaperSvg = "";
  const svgEncoded = encodeURIComponent(wallpaperSvg);
  const wallpaperCss = `
.math-wallpaper {
  background-image: url("data:image/svg+xml;utf8,${svgEncoded}");
  background-repeat: repeat;
  background-size: 160px 160px;
}
@media (min-width: 768px) {
  .math-wallpaper { background-size: 240px 240px; }
}
`;

  return (
    <div className="min-h-screen overflow-x-hidden" style={{ backgroundColor: "#FFF5ED" }}>
      <style dangerouslySetInnerHTML={{ __html: wallpaperCss }} />

      <header className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md" style={{ backgroundColor: "rgba(255, 245, 237, 0.95)" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-12 h-16 sm:h-20 flex items-center justify-center sm:justify-between">
          <div className="flex-shrink-0 scale-90 origin-center sm:origin-left">
            <ResponseIntegrityLogo size="lg" variant="integrity" />
          </div>

          <div className="hidden md:block">
            <span className="text-2xl lg:text-4xl font-bold tracking-tight" style={{ color: "#1A1A1A" }}>
              RESPONSE TRAINING
            </span>
          </div>

          <div className="hidden sm:flex items-center gap-2 sm:gap-4">
            <Button
              variant="ghost"
              className="text-sm sm:text-base font-medium hover:bg-transparent px-2 sm:px-4"
              style={{ color: "#1A1A1A" }}
              onClick={() => navigate(buildLoginUrl())}
            >
              Log In
            </Button>
            <Button
              className="text-sm sm:text-base font-semibold px-4 sm:px-6 py-2 sm:py-5 rounded-full border-0 shadow-lg hover:shadow-xl transition-all"
              style={{ backgroundColor: "#E63946", color: "white" }}
              onClick={() => navigate(buildParentIntakeUrl())}
            >
              <span className="hidden sm:inline">Check Intake</span>
              <span className="sm:hidden">Intake</span>
            </Button>
          </div>
        </div>
      </header>

      <div className="h-16 sm:h-20" />

      <section className="max-w-7xl mx-auto px-4 sm:px-6 md:px-12 pt-4 sm:pt-8 md:pt-16 md:-mt-12 lg:-mt-14 xl:-mt-16 pb-12 sm:pb-20">
        <div className="md:hidden text-center mb-6">
          <span className="text-2xl font-bold tracking-tight" style={{ color: "#1A1A1A" }}>
            RESPONSE TRAINING
          </span>
        </div>

        <div className="grid lg:grid-cols-2 gap-8 lg:gap-16 items-center">
          <div className="space-y-5 sm:space-y-8 max-w-[calc(100vw-32px)]">
            <div className="mx-auto flex w-fit items-center gap-2 rounded-full px-3 py-1.5 sm:mx-0 sm:px-4 sm:py-2" style={{ backgroundColor: "#FFF0F0" }}>
              <span className="text-xs sm:text-sm font-medium" style={{ color: "#E63946" }}>
                For Parents of Grades 6-9 Students
              </span>
            </div>

            <h1 className="text-center sm:text-left text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold leading-tight tracking-tight" style={{ color: "#1A1A1A" }}>
              Calm Execution
              <br />
              <span style={{ color: "#E63946" }}>Under Pressure.</span>
            </h1>

            <p className="text-base sm:text-lg md:text-xl leading-relaxed" style={{ color: "#5A5A5A" }}>
              Some students do not struggle because they are bad at math or not intelligent.
              <br />
              They struggle because pressure disrupts the way they respond.
              <br />
              Response Integrity trains that response directly.
            </p>

            <div className="w-full pt-2 sm:pt-4">
              <Button
                size="lg"
                className="w-full text-base sm:text-lg font-semibold px-4 sm:px-8 py-4 sm:py-6 rounded-full shadow-lg hover:shadow-xl transition-all border-0 flex items-center justify-center gap-3 leading-tight"
                style={{ backgroundColor: "#E63946", color: "white" }}
                onClick={() => navigate(buildParentIntakeUrl())}
              >
                <span>Check Current Intake Window</span>
                <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
              </Button>
            </div>
          </div>

          <div className="relative overflow-visible w-full max-w-full">
            <div className="absolute inset-0 rounded-3xl hidden sm:block transform sm:rotate-3" style={{ backgroundColor: "#FFF0F0" }} />
            <img
              src="/images/Benefits-of-Online-Tutoring-1-1080x589.png"
              alt="Student training calm focus"
              className="relative rounded-3xl shadow-2xl w-full object-cover max-w-[calc(100vw-32px)]"
              style={{ aspectRatio: "4/3" }}
            />

            <div className="absolute -bottom-4 sm:-bottom-6 left-2 sm:left-2 md:-left-12 p-3 sm:p-4 md:p-6 rounded-xl sm:rounded-2xl shadow-xl" style={{ backgroundColor: "white" }}>
              <div className="flex items-center gap-2 sm:gap-3">
                <div>
                  <p className="font-bold text-sm sm:text-lg" style={{ color: "#1A1A1A" }}>Calm First</p>
                  <p className="text-xs sm:text-sm" style={{ color: "#5A5A5A" }}>Confidence follows</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="pb-12 sm:pb-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-12">
          <div className="rounded-[30px] border border-[#E5D3C5] bg-white/82 p-5 sm:p-6 md:p-8 shadow-sm">
            <div className="max-w-2xl">
              <h2 className="mt-2 text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight" style={{ color: "#1A1A1A" }}>
                Two annual intakes. One standard.
              </h2>
              <p className="mt-4 text-sm sm:text-base leading-7" style={{ color: "#5A5A5A" }}>
                Families enter through a defined intake and continue on a cadence that prepares response ahead of pressure.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="pb-12 sm:pb-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-12">
          <div className="relative overflow-hidden rounded-[38px] border border-[#2F2621] bg-[#1A1412] shadow-[0_24px_70px_rgba(26,20,18,0.18)]">
            <div className="absolute inset-0 opacity-100">
              <div className="absolute -top-16 right-0 h-44 w-44 rounded-full bg-[#E63946]/18 blur-3xl" />
              <div className="absolute bottom-0 left-0 h-52 w-52 rounded-full bg-[#F6C1A9]/14 blur-3xl" />
            </div>

            <div className="relative p-6 sm:p-8 md:p-10 lg:p-12">
              <div className="grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)] lg:items-start">
                <div className="space-y-6">
                  <div className="max-w-3xl">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em]" style={{ color: "#F3B39D" }}>
                      Why We Exist
                    </p>
                    <h2 className="mt-3 text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight leading-tight" style={{ color: "#FFF7F1" }}>
                      Response training for the gap between understanding and execution.
                    </h2>
                  </div>

                  <div className="max-w-2xl space-y-5 text-sm sm:text-base leading-7" style={{ color: "#D9C8BD" }}>
                    <p>Most students do not only struggle because they "do not understand."</p>
                    <p>Many students know more than they can show when mathematics becomes difficult, unfamiliar, timed, or uncomfortable.</p>
                    <p className="text-base sm:text-lg font-semibold leading-8" style={{ color: "#FFF7F1" }}>
                      That is the gap Response Integrity exists to train.
                    </p>
                    <p>
                      The classroom is built to move the group forward. A teacher may care deeply, but one teacher cannot condition 30 individual learner
                      responses at once. They must continue the curriculum, manage the class, and keep the group progressing.
                    </p>
                    <p>But every child has their own response pattern.</p>
                  </div>

                  <div className="rounded-[28px] border border-[#59433A] bg-[#241B18] p-5 sm:p-6 shadow-sm">
                    <p className="text-sm sm:text-base leading-7" style={{ color: "#F3DDD1" }}>
                      Response Integrity gives the learner a private, one-on-one online training environment where their individual response can be observed,
                      corrected, repeated, and strengthened.
                    </p>
                  </div>

                  <div className="flex justify-center">
                    <img
                      src="/images/student-online-school-homeschool-laptop-classes-1.webp"
                      alt="Student learning online with a laptop"
                      className="w-full max-w-[460px]"
                      style={{ height: "auto" }}
                      loading="lazy"
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:gap-5">
                  <Card className="rounded-[28px] border-[#E5C6B6] bg-[#FFF4EC] p-5 sm:p-6 md:p-7 shadow-none">
                    <div className="space-y-4">
                      <h3 className="text-lg sm:text-xl font-bold" style={{ color: "#1A1A1A" }}>
                        Common learner reactions under difficulty
                      </h3>
                      <div className="grid gap-3">
                        {whyWeExistResponsePatterns.map((item) => (
                          <div key={item} className="flex gap-3 sm:gap-4 rounded-2xl border border-[#4A3A33] bg-[#241B18] px-4 py-3">
                            <div className="mt-0.5 h-7 w-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "#F7E7E2" }}>
                              <Check className="w-3.5 h-3.5" style={{ color: "#E63946" }} />
                            </div>
                            <p className="text-sm sm:text-base leading-6" style={{ color: "#F3DDD1" }}>
                              {item}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </Card>

                  <Card className="rounded-[28px] border-[#44201F] bg-[#A8323B] p-5 sm:p-6 md:p-7 shadow-none">
                    <div className="space-y-4">
                      <p className="text-sm sm:text-base leading-7" style={{ color: "#FFE9EB" }}>
                        We exist to train what the classroom cannot always slow down long enough to condition: the individual learner's response under
                        difficulty.
                      </p>
                    </div>
                  </Card>

                  <Card className="rounded-[28px] border-[#59433A] bg-[#241B18] p-5 sm:p-6 md:p-7 shadow-none">
                    <div className="space-y-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em]" style={{ color: "#F3B39D" }}>
                        Parent feedback
                      </p>
                      <blockquote className="text-sm sm:text-base leading-7" style={{ color: "#FFF7F1" }}>
                        &ldquo;{khanyaParentTestimonial.quote}&rdquo;
                      </blockquote>
                      <p className="text-sm font-semibold" style={{ color: "#F3B39D" }}>
                        {khanyaParentTestimonial.attribution}
                      </p>
                    </div>
                  </Card>

                  <div className="hidden lg:block max-w-[26rem] pl-1 pt-8">
                    <p className="text-sm sm:text-base leading-7" style={{ color: "#D9C8BD" }}>
                      The learner is watched closely enough, challenged carefully enough, and repeated consistently enough for stability to become
                      trainable.
                    </p>
                  </div>

                </div>
              </div>

              <div className="mt-8 rounded-[30px] border border-[#E8D2C3] bg-[#FFF8F3] p-6 sm:p-7 md:p-8 shadow-sm lg:hidden">
                <div className="grid gap-5">
                  <p className="text-sm sm:text-base leading-7" style={{ color: "#5A5A5A" }}>
                    The learner is watched closely enough, challenged carefully enough, and repeated consistently
                    enough for stability to become trainable.
                  </p>
                </div>
              </div>

              <div className="mt-6 grid gap-4 sm:gap-5 lg:grid-cols-2">
                {responseIntegrityDifferentiators.map((item, index) => {
                  const isDark = index === 2 || index === 5;
                  const isRose = index === 1 || index === 4;

                  const cardStyle = isDark
                    ? { borderColor: "#4A3A33", backgroundColor: "#241B18" }
                    : isRose
                      ? { borderColor: "#E7C8BF", backgroundColor: "#F7E7E2" }
                      : { borderColor: "#E9D8CC", backgroundColor: "#FFFCF8" };

                  const labelStyle = isDark
                    ? { borderColor: "#5A443A", backgroundColor: "rgba(255,255,255,0.06)", color: "#F3B39D" }
                    : isRose
                      ? { borderColor: "#E5C1B6", backgroundColor: "rgba(255,255,255,0.56)", color: "#9D3C2D" }
                      : { borderColor: "#E7D3C7", backgroundColor: "#FFF4EE", color: "#A04736" };

                  const headingColor = isDark ? "#FFF7F1" : "#1A1A1A";
                  const bodyColor = isDark ? "#E4D4CA" : "#4E4E4E";

                  return (
                    <Card key={item.title} className="rounded-[28px] p-5 sm:p-6 md:p-7 shadow-none" style={cardStyle}>
                      <div className="space-y-4">
                        <div
                          className="inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]"
                          style={labelStyle}
                        >
                          {item.label}
                        </div>
                        <h4 className="text-lg sm:text-xl font-bold leading-tight" style={{ color: headingColor }}>
                          {item.title}
                        </h4>
                        <div className="space-y-3 text-sm sm:text-base leading-7" style={{ color: bodyColor }}>
                          {item.paragraphs.map((paragraph) => (
                            <p key={paragraph}>{paragraph}</p>
                          ))}
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

      {fastTrackEnabled ? (
        <section className="pb-12 sm:pb-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-12">
            <div className="rounded-[30px] border border-dashed border-[#D9B8AA] bg-[#FFF8F4] p-5 sm:p-6 md:p-8 shadow-sm">
              <div className="max-w-2xl">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em]" style={{ color: "#8A4B35" }}>
                  {fastTrackBadge}
                </p>
                <h2 className="mt-2 text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight" style={{ color: "#1A1A1A" }}>
                  Direct parent signup is unlocked.
                </h2>
                <p className="mt-4 text-sm sm:text-base leading-7" style={{ color: "#5A5A5A" }}>
                  {fastTrackDescription}
                </p>
                <div className="mt-6">
                  <Button
                    className="text-sm sm:text-base font-semibold px-4 sm:px-6 py-2 sm:py-5 rounded-full border-0 shadow-lg hover:shadow-xl transition-all"
                    style={{ backgroundColor: "#1A1A1A", color: "white" }}
                    onClick={() => navigate(buildDirectSignupUrl())}
                  >
                    Direct Parent Signup
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <section className="py-12 sm:py-20" style={{ backgroundColor: "#1A1A1A" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-12">
          <div className="text-center max-w-3xl mx-auto mb-10 sm:mb-16">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4 sm:mb-6" style={{ color: "white" }}>
              How It Works
            </h2>
            <p className="text-base sm:text-lg" style={{ color: "#A0A0A0" }}>
              A conditioning system that builds stable response through cadence, repetition, and preparation before pressure peaks, not casual last-minute tutoring.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6 md:gap-8">
            {[
              {
                number: "1",
                title: "Preparation Starts Early",
                description: "Students begin building response patterns before tests, exams, and classroom urgency take over.",
              },
              {
                number: "2",
                title: "Patterns Get Repeated",
                description: "Through consistent weekly exposure, structure becomes familiar and calm execution stops depending on mood or confidence.",
              },
              {
                number: "3",
                title: "Pressure Feels Familiar",
                description: "Controlled difficulty is introduced gradually, so your child learns to stay unshaken when uncertainty and time pressure appear.",
              },
            ].map((item) => (
              <div key={item.number} className="p-5 sm:p-6 md:p-8 rounded-xl sm:rounded-2xl" style={{ backgroundColor: "#2A2A2A" }}>
                <div
                  className="w-11 h-11 sm:w-14 sm:h-14 rounded-full flex items-center justify-center mb-4 sm:mb-6"
                  style={{ backgroundColor: "#E63946", color: "white", fontSize: "1.75rem", fontWeight: 800, letterSpacing: "-0.02em" }}
                >
                  {item.number}
                </div>
                <h3 className="text-lg sm:text-xl font-bold mb-2 sm:mb-3" style={{ color: "white" }}>
                  {item.title}
                </h3>
                <p className="text-sm sm:text-base" style={{ color: "#A0A0A0" }}>
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-12 sm:py-20 math-wallpaper" style={{ backgroundColor: "#FFF0F0" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-12">
          <div className="text-center max-w-3xl mx-auto mb-10 sm:mb-16">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4 sm:mb-6" style={{ color: "#1A1A1A" }}>
              What This Conditioning Builds
            </h2>
            <p className="text-base sm:text-lg" style={{ color: "#5A5A5A" }}>
              These changes come from repeated exposure, structured progression, and preparation before pressure peaks.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-4 sm:gap-6 md:gap-8 max-w-5xl mx-auto">
            <Card className="p-5 sm:p-6 md:p-8 border-0 shadow-lg" style={{ backgroundColor: "#FFF5ED" }}>
              <div className="space-y-4 sm:space-y-6">
                {[
                  { title: "Someone Who Does Not Freeze", desc: "When the question breaks expectation, they stay calm and execute their trained response." },
                  { title: "Someone Parents Trust", desc: "Parents are able to step back from constant oversight. Their ability to handle pressure becomes more predictable." },
                  { title: "Someone Built Through Structure", desc: "Part of a system that values consistency, clarity, and structured preparation." },
                ].map((item) => (
                  <div key={item.title} className="flex gap-3 sm:gap-4">
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "#FFF0F0" }}>
                      <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4" style={{ color: "#E63946" }} />
                    </div>
                    <div>
                      <h4 className="font-semibold text-sm sm:text-base mb-0.5 sm:mb-1" style={{ color: "#1A1A1A" }}>{item.title}</h4>
                      <p className="text-xs sm:text-sm" style={{ color: "#5A5A5A" }}>{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-5 sm:p-6 md:p-8 border-0 shadow-lg" style={{ backgroundColor: "#FFF5ED" }}>
              <div className="space-y-4 sm:space-y-6">
                {[
                  { title: "Someone Less Thrown by Exams", desc: "Pressure feels familiar. Performance stays stable across terms." },
                  { title: "Someone Less Defined by Setbacks", desc: "Instead of being defined by difficulty, they learn how to respond when it gets hard." },
                  { title: "Someone Ready For What Is Next", desc: "Academic pressure becomes more manageable. The future feels less uncertain." },
                ].map((item) => (
                  <div key={item.title} className="flex gap-3 sm:gap-4">
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "#FFF0F0" }}>
                      <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4" style={{ color: "#E63946" }} />
                    </div>
                    <div>
                      <h4 className="font-semibold text-sm sm:text-base mb-0.5 sm:mb-1" style={{ color: "#1A1A1A" }}>{item.title}</h4>
                      <p className="text-xs sm:text-sm" style={{ color: "#5A5A5A" }}>{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <div className="mt-8 sm:mt-10 grid gap-4 max-w-5xl mx-auto md:grid-cols-2">
            <Card className="border-[#EEDFD3] bg-white/84 p-5 sm:p-6 shadow-sm xl:h-full">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: "#E63946" }}>
                Full-Year Conditioning Intake
              </p>
              <p className="mt-3 text-sm leading-7" style={{ color: "#5A5A5A" }}>
                Built for families preparing before the academic year becomes urgent.
              </p>
            </Card>

            <Card className="border-[#EEDFD3] bg-white/84 p-5 sm:p-6 shadow-sm xl:h-full">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: "#E63946" }}>
                Mid-Year Conditioning Intake
              </p>
              <p className="mt-3 text-sm leading-7" style={{ color: "#5A5A5A" }}>
                Built for families who still have serious runway before final-year pressure peaks.
              </p>
            </Card>
          </div>
        </div>
      </section>

      <section className="py-12 sm:py-20" style={{ backgroundColor: "#1A1A1A" }}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 md:px-12 text-center">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4 sm:mb-6" style={{ color: "white" }}>
            Ready to Start With Intention?
          </h2>
          <p className="text-base sm:text-lg mb-8 sm:mb-10" style={{ color: "#A0A0A0" }}>
            Response Integrity works best when preparation begins early and continues through stable weekly cadence.
          </p>
          <div className="w-full">
            <Button
              size="lg"
              className="w-full text-base sm:text-lg font-semibold px-4 sm:px-10 py-4 sm:py-6 rounded-full border-0 outline-none flex items-center justify-center gap-3 leading-tight"
              style={{ backgroundColor: "#E63946", color: "white" }}
              onClick={() => navigate(buildParentIntakeUrl())}
            >
              <span>Check Current Intake Window</span>
              <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
            </Button>
          </div>
        </div>
      </section>

      <footer className="py-8 sm:py-12" style={{ backgroundColor: "#FFF5ED" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-12">
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-6 sm:gap-8 pb-6 sm:pb-8 mb-6 sm:mb-8 border-b" style={{ borderColor: "#E5E5E5" }}>
            <div className="space-y-3 sm:space-y-4">
              <h4 className="font-semibold text-sm sm:text-base" style={{ color: "#1A1A1A" }}>About Response Integrity</h4>
              <p className="text-xs sm:text-sm" style={{ color: "#5A5A5A" }}>
                Response Integrity is built for families who believe in preparation before pressure arrives. Our system values cadence, consistency, and early conditioning. For this reason, enrollment happens through defined conditioning windows, and students are expected to maintain the training rhythm required for stable response development.
              </p>
              <div className="space-y-2 pt-2">
                <a href={privacyPolicyUrl} className="text-xs sm:text-sm block hover:underline" style={{ color: "#5A5A5A" }}>
                  Privacy Policy
                </a>
                <a href={termsOfUseUrl} className="text-xs sm:text-sm block hover:underline" style={{ color: "#5A5A5A" }}>
                  Terms of Use
                </a>
                <a href={aboutUrl} className="text-xs sm:text-sm block hover:underline" style={{ color: "#5A5A5A" }}>
                  More About Us
                </a>
              </div>
            </div>

            <div className="space-y-3 sm:space-y-4 sm:col-span-2 md:col-span-1">
              <h4 className="font-semibold text-sm sm:text-base" style={{ color: "#1A1A1A" }}>FAQ</h4>
              <a href="/faq" className="text-xs sm:text-sm block text-blue-600 hover:underline" style={{ color: "#2563eb" }}>
                Have a question?
              </a>
            </div>
          </div>

          <div className="flex flex-col md:flex-row md:justify-between items-center gap-4 sm:gap-6">
            <div className="flex flex-col md:flex-row items-center gap-3 sm:gap-4">
              <div>
                <ResponseIntegrityLogo size="md" variant="integrity" />
              </div>
              <a
                href="https://www.instagram.com/responseintegritysa?utm_source=ig_web_button_share_sheet&igsh=ZDNlZDc0MzIxNw=="
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Response Integrity on Instagram"
                className="inline-flex items-center justify-center w-10 h-10 rounded-full transition-opacity hover:opacity-80 md:ml-[8.75rem]"
                style={{ backgroundColor: "#FFF0F0", color: "#E63946" }}
              >
                <Instagram className="w-5 h-5" />
              </a>
            </div>
            <p className="text-center md:text-right text-xs sm:text-sm" style={{ color: "#5A5A5A" }}>
              © {new Date().getFullYear()} Response Integrity (Pty) Ltd
              <br />
              <span className="text-xs sm:text-sm">Math Pressure Response-Training.</span>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default PortalLanding;
