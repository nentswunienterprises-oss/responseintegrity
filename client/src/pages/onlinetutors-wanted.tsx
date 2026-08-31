import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ResponseIntegrityLogo } from "@/components/ResponseIntegrityLogo";
import { RISymbolLogo } from "@/components/RISymbolLogo";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Check } from "lucide-react";

export default function OnlineTutorsWanted() {
  const navigate = useNavigate();

  const tutorLandingPath = "/operational/specialist/landing";

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#FFF5ED" }}>
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md" style={{ backgroundColor: "rgba(255, 245, 237, 0.95)" }}>
        <div className="max-w-7xl mx-auto px-3 sm:px-6 md:px-12 h-16 sm:h-20 flex items-center justify-between relative">
          <RISymbolLogo size="xl" className="shrink-0" />

          <div className="absolute right-4 top-2 md:absolute md:right-12 md:top-4">
            <Button
              className="text-sm sm:text-base font-semibold px-4 sm:px-6 py-2 sm:py-3 rounded-full border-0 shadow-md"
              style={{ backgroundColor: "#E63946", color: "white" }}
              onClick={() => navigate(tutorLandingPath)}
              aria-label="Start application"
            >
              Start <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      </header>

      <div className="h-16 sm:h-20" />

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 md:px-12 pt-8 sm:pt-12 md:pt-20 pb-8 sm:pb-12">
        <div className="text-center mb-6 sm:mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full" style={{ backgroundColor: "#FFF0F0" }}>
            <span className="text-sm font-medium" style={{ color: "#E63946" }}>
              Response Integrity (Pty) Ltd
            </span>
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold leading-tight mt-6" style={{ color: "#1A1A1A" }}>
            ONLINE MATH TUTOR
            <div className="text-lg sm:text-xl font-semibold mt-2" style={{ color: "#5A5A5A" }}>
              Part-time &middot; Remote &middot; Performance-based
            </div>
          </h1>

          <p className="max-w-2xl mx-auto text-base sm:text-lg mt-6" style={{ color: "#5A5A5A" }}>
            We run a structured online response-conditioning operation and we're selecting a small number of disciplined, matric-completed tutor candidates to train as <strong>tutors</strong> - not casual tutors - with real accountability and earning potential.
          </p>


        </div>

        {/* Role Card */}
        <div className="grid md:grid-cols-2 gap-6 items-start">
          <Card className="p-6 max-w-xl mx-auto" style={{ backgroundColor: "white" }}>
            <h2 className="text-xl font-bold mb-4" style={{ color: "#1A1A1A" }}>WHO WE ARE</h2>
            <p className="text-sm sm:text-base" style={{ color: "#5A5A5A" }}>
              Response Integrity is a premium online response-conditioning company. We don't do chaotic tutoring. We don't improvise. We don't babysit.
              We build calm, confident, high-performing math students through a structured, system-driven approach.
              If you believe great results come from clear processes, high standards, and consistency, you'll fit in here.
            </p>

            <div className="mt-6">
              <h3 className="font-semibold">THE ROLE</h3>
              <p className="text-sm mt-2" style={{ color: "#5A5A5A" }}>
                As a Response Integrity Online Math Tutor, you are responsible for delivering structured, high-quality 1-on-1 math sessions to students in Grades 6-9.
                This is not casual tutoring. You will be trained to follow a clear operating system that prioritizes:
              </p>

              <ul className="mt-3 space-y-2 text-sm" style={{ color: "#5A5A5A" }}>
                <li> Clarity over speed</li>
                <li> Precision over personality</li>
                <li> Consistency over creativity</li>
              </ul>

              <p className="mt-3 text-sm" style={{ color: "#5A5A5A" }}>
                Your job is to execute the system accurately, every session.
              </p>
            </div>
          </Card>

          <Card className="p-6 max-w-xl mx-auto" style={{ backgroundColor: "white" }}>
            <h3 className="text-lg font-bold mb-3">WHAT YOU'LL DO</h3>

            <ul className="space-y-3 text-sm" style={{ color: "#5A5A5A" }}>
              <li> Deliver live online math sessions (1-on-1)</li>
              <li> Use phase-appropriate explanation, modeling, and correction</li>
              <li> Help students stay calm and focused when problems get difficult</li>
              <li> Correct mistakes precisely, without guessing or shortcuts</li>
              <li> Prepare students for tests and exams through disciplined, phase-appropriate practice</li>
              <li> Maintain professional session standards at all times</li>
            </ul>
          </Card>
        </div>

        {/* Who For / Not For */}
        <div className="grid md:grid-cols-2 gap-6 mt-6 items-start">
          <Card className="p-6" style={{ backgroundColor: "white" }}>
            <h3 className="text-lg font-bold mb-3">FOR APPLICANTS WHO:</h3>
            <ul className="space-y-3 text-sm" style={{ color: "#5A5A5A" }}>
              <li> Are strong in Grades 6-9 Mathematics</li>
              <li> Can explain concepts clearly when the phase calls for it</li>
              <li> Are comfortable following a structured system</li>
              <li> Take feedback seriously and apply it quickly</li>
              <li> Have completed matric or are a young adult ready for structured tutor training</li>
              <li> Want real teaching skill development (not just pocket money)</li>
              <li> Are disciplined, reliable, and coachable</li>
            </ul>
          </Card>

          <Card className="p-6 max-w-xl mx-auto" style={{ backgroundColor: "white" }}>
            <h3 className="text-lg font-bold mb-3">NOT FOR THOSE WHO:</h3>
            <ul className="space-y-3 text-sm" style={{ color: "#5A5A5A" }}>
              <li> Prefer improvising or "teaching their own way"</li>
              <li> Dislike structure or feedback</li>
              <li> Avoid difficult students or challenging moments</li>
              <li> Want a casual side hustle without accountability</li>
            </ul>
          </Card>
        </div>

        {/* Training, Compensation, Apply */}
        <div className="grid md:grid-cols-3 gap-6 mt-6 items-start">
          <Card className="p-6" style={{ backgroundColor: "white" }}>
            <h4 className="font-semibold mb-2">TRAINING & SUPPORT</h4>
            <ul className="text-sm" style={{ color: "#5A5A5A" }}>
              <li> Structured onboarding and system training</li>
              <li> Ongoing coaching and performance feedback</li>
              <li> Clear expectations and progression pathway</li>
              <li> Opportunity to grow into leadership roles over time</li>
            </ul>
          </Card>

          <Card className="p-6 max-w-sm mx-auto" style={{ backgroundColor: "white" }}>
            <h4 className="font-semibold mb-2">COMPENSATION</h4>
            <p className="text-sm" style={{ color: "#5A5A5A" }}>
              Performance-based pay. Earnings increase with student load and consistency. Strong tutors grow quickly.
            </p>
          </Card>

          <Card className="p-6" style={{ backgroundColor: "white" }}>
            <h4 className="font-semibold mb-2">HOW TO APPLY</h4>
            <p className="text-sm mb-4 break-words whitespace-normal" style={{ color: "#5A5A5A" }}>
              Apply <button type="button" aria-label="Apply at Response Integrity tutor landing page" className="text-blue-600 hover:underline inline p-0 m-0" onClick={() => navigate(tutorLandingPath)}>here</button> to review the tutor path and continue into account access.
            </p>
            <p className="text-sm" style={{ color: "#5A5A5A" }}>
              Shortlisted applicants will be invited to a screening process and training cohort.
            </p>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 sm:py-12" style={{ backgroundColor: "#FFF5ED" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-12">
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-6 sm:gap-8 pb-6 sm:pb-8 mb-6 sm:mb-8 border-b" style={{ borderColor: "#E5E5E5" }}>
            <div className="space-y-3 sm:space-y-4">
              <h4 className="font-semibold text-sm sm:text-base" style={{ color: "#1A1A1A" }}>About Response Integrity</h4>
              <p className="text-xs sm:text-sm" style={{ color: "#5A5A5A" }}>
                Response Integrity is a performance-first response-conditioning system built on clarity, repetition, and standards.
              </p>
            </div>
            <div className="space-y-3 sm:space-y-4">
              <h4 className="font-semibold text-sm sm:text-base" style={{ color: "#1A1A1A" }}>Get Involved</h4>
              <div className="space-y-2">
                <button onClick={() => navigate("/operational/landing")} className="text-xs sm:text-sm block hover:underline" style={{ color: "#5A5A5A" }}>
                  Become a Tutor
                </button>
                <button onClick={() => navigate("/affiliate/landing")} className="text-xs sm:text-sm block hover:underline" style={{ color: "#5A5A5A" }}>
                  Affiliate Program
                </button>
              </div>
            </div>
            <div className="space-y-3 sm:space-y-4 sm:col-span-2 md:col-span-1">
              <h4 className="font-semibold text-sm sm:text-base" style={{ color: "#1A1A1A" }}>Contact</h4>
              <a href="/faq" className="text-xs sm:text-sm block text-blue-600 hover:underline" style={{ color: "#2563eb" }}>
                Questions? We're here to help.
              </a>
            </div>
          </div>

          <div className="flex flex-col md:flex-row md:justify-between items-center gap-4 sm:gap-6">
            <div className="ml-16 md:ml-0">
              <ResponseIntegrityLogo size="md" variant="integrity" />
            </div>
            <p className="text-center md:text-right text-xs sm:text-sm" style={{ color: "#5A5A5A" }}>
              &copy; {new Date().getFullYear()} Response Integrity (Pty) Ltd
              <br />
              <span className="text-xs sm:text-sm">Confidence, made inevitable.</span>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

