import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ResponseIntegrityLogo } from "@/components/ResponseIntegrityLogo";
import { RISymbolLogo } from "@/components/RISymbolLogo";
import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { useEffect } from "react";

export default function OnlineTutorsWantedPlain() {
  const navigate = useNavigate();
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' }); }, []);

  const tutorLandingPath = "/operational/tutor/landing";

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#FFF5ED" }}>
      {/* Header (portal-landing style) */}
      <header className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md" style={{ backgroundColor: "rgba(255, 245, 237, 0.95)" }}>
        <div className="max-w-7xl mx-auto px-3 sm:px-6 md:px-12 h-16 sm:h-20 flex items-center justify-between">
          <RISymbolLogo size="xxl" className="shrink-0" />
          <div className="hidden md:block">
            <span className="text-2xl lg:text-4xl font-bold tracking-tight" style={{ color: "#1A1A1A" }}>
              RESPONSE-CONDITIONING
            </span>
          </div>

          <div className="flex items-center">
            <Button
              className="text-sm sm:text-base font-semibold px-4 sm:px-6 py-2 sm:py-5 rounded-full border-0 shadow-lg hover:shadow-xl transition-all"
              style={{ backgroundColor: "#E63946", color: "white" }}
              onClick={() => navigate(tutorLandingPath)}
            >
              Start <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      </header>

      <div className="h-16 sm:h-20" />

      {/* Hero */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 md:px-12 pt-8 sm:pt-12 md:pt-20 pb-8 sm:pb-12">
        <div className="text-center mb-6 sm:mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full" style={{ backgroundColor: "#FFF0F0" }}>
            <span className="text-sm font-medium" style={{ color: "#E63946" }}>
              Response Integrity (Pty) Ltd
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl md:text-5xl font-bold leading-tight mt-6" style={{ color: "#1A1A1A" }}>
            Become a Response Integrity Tutor
            <div className="text-base sm:text-xl font-semibold mt-2" style={{ color: "#5A5A5A" }}>
              Not everyone qualifies. That's the point.
            </div>
          </h1>

          <p className="max-w-2xl mx-auto text-base sm:text-lg mt-6 leading-relaxed" style={{ color: "#5A5A5A" }}>
            Earn R2 200 - R4 200 per month (tax-free) while building real teaching, leadership, and execution skills.
          </p>

          <div className="mt-6">
            <Button size="lg" className="w-full sm:w-auto px-6 py-3 rounded-full font-semibold" style={{ backgroundColor: "#E63946", color: "white" }} onClick={() => navigate(tutorLandingPath)}>
              Apply Now
            </Button>
          </div> 

          <p className="max-w-2xl mx-auto text-sm sm:text-base mt-4" style={{ color: "#5A5A5A" }}>
            Response Integrity is selecting a small number of matric-completed, disciplined tutor candidates to train inside our structured response-conditioning operation.
          </p>

          <div className="mt-6 space-y-2">
            <p className="font-semibold">This is not casual tutoring.</p>
            <p className="font-semibold">This is not "teach your own way."</p>
            <p className="font-semibold">This is a system.</p>
          </div>
        </div>

        {/* Content sections, exact copy preserved */}
        <Card className="p-6 mb-6" style={{ backgroundColor: "white" }}>
          <h2 className="text-lg font-bold mb-3">What You're Stepping Into</h2>
          <p style={{ color: "#5A5A5A" }}>
            Response Integrity runs a structured online response-conditioning programme for Grades 6-9.
          </p>
          <p>We rely on clear systems, repetition, and standards.</p>
          <p className="mt-2">As a tutor, your job is to run that system precisely - every session, every student.</p>
        </Card>

        <Card className="p-6 mb-6" style={{ backgroundColor: "white" }}>
          <h3 className="text-lg font-bold mb-3">What You'll Actually Do</h3>
          <div className="space-y-2" style={{ color: "#5A5A5A" }}>
            <p>Run online math response-conditioning sessions</p>
            <p>Follow a clear session structure and standards</p>
            <p>Help students stay calm when problems get difficult</p>
            <p>Correct mistakes using precise language and steps</p>
            <p>Apply feedback and improve consistently</p>

            <p className="mt-3 font-semibold">You won' be guessing.</p>
            <p className="font-semibold">You'll be trained.</p>
          </div>
        </Card>

        <Card className="p-6 mb-6" style={{ backgroundColor: "white" }}>
          <h3 className="text-lg font-bold mb-3">Who This Is For</h3>
          <p className="mb-3" style={{ color: "#5A5A5A" }}>This opportunity is for you if you:</p>
          <ul className="list-disc pl-5 space-y-2 text-sm sm:text-base" style={{ color: "#5A5A5A" }}>
            <li>Are strong in Grades 6-9 Mathematics</li>
            <li>Have completed matric or are a young adult ready for structured tutor training</li>
            <li>Follow structure well</li>
            <li>Take correction without ego</li>
            <li>Want real skill development, not quick cash</li>
            <li>Can be consistent week after week</li>
          </ul>
        </Card>

        {/* 'Who This Is Not For' section removed as requested */}

        <Card className="p-6 mb-6" style={{ backgroundColor: "white" }}>
          <h3 className="text-lg font-bold mb-3">Training & Selection</h3>
          <p style={{ color: "#5A5A5A" }}>Everyone starts in training.</p>
          <p className="mt-3" style={{ color: "#5A5A5A" }}>During this phase, you'll be assessed on:</p>
          <ul className="list-disc pl-5 mt-2 space-y-2 text-sm sm:text-base" style={{ color: "#5A5A5A" }}>
            <li>Phase-appropriate explanation</li>
            <li>Discipline in following structure</li>
            <li>Ability to handle pressure</li>
            <li>Willingness to improve</li>
          </ul>
          <p className="mt-3" style={{ color: "#5A5A5A" }}>Only those who meet our standards continue.</p>
          <p className="mt-2" style={{ color: "#5A5A5A" }}>No shortcuts. No guarantees.</p>
        </Card>

        <Card className="p-6 mb-6" style={{ backgroundColor: "white" }}>
          <h3 className="text-lg font-bold mb-3">Earnings</h3>
          <p style={{ color: "#5A5A5A" }}>R2 200 - R4 200 per month, tax-free (performance-based)</p>
          <p style={{ color: "#5A5A5A" }}>Earnings increase with consistency and student load</p>
          <p style={{ color: "#5A5A5A" }}>Top performers grow into leadership roles</p>
          <p style={{ color: "#5A5A5A" }}>You earn more by executing better - not by talking more.</p>
        </Card>

        <Card className="p-6 mb-6" style={{ backgroundColor: "white" }}>
          <h3 className="text-lg font-bold mb-3">Why This Opportunity Is Different</h3>
          <ul className="list-disc pl-5 space-y-2 text-sm sm:text-base" style={{ color: "#5A5A5A" }}>
            <li>You gain real teaching and communication skill</li>
            <li>You build discipline and confidence under pressure</li>
            <li>You learn to operate inside a professional system</li>
            <li>You earn while developing skills that transfer anywhere</li>
          </ul>
          <p className="mt-3" style={{ color: "#5A5A5A" }}>This isn' just income.
            It's training.
          </p>
        </Card>

        <Card className="p-6 mb-6" style={{ backgroundColor: "white" }}>
          <h3 className="text-lg font-bold mb-3">The Standard</h3>
          <p style={{ color: "#5A5A5A" }}>We don't motivate.</p>
          <p style={{ color: "#5A5A5A" }}>We don't babysit.</p>
          <p style={{ color: "#5A5A5A" }}>We don't lower expectations.</p>
          <p className="mt-3" style={{ color: "#5A5A5A" }}>If you execute the system, results follow - for you and your students.</p>
        </Card>

        <Card className="p-6 mb-6" style={{ backgroundColor: "white" }}>
          <h3 className="text-lg font-bold mb-3">Ready to Apply?</h3>
          <p style={{ color: "#5A5A5A" }}>If this sounds demanding, good.
            That means you're reading it correctly.
          </p>

          <p className="mt-4 text-sm" style={{ color: "#5A5A5A" }}>
            Apply <button type="button" aria-label="Apply at Response Integrity tutor landing page" className="text-blue-600 hover:underline inline p-0 m-0" onClick={() => navigate(tutorLandingPath)}>Here</button>
          </p>

          <p className="mt-4 font-semibold" style={{ color: "#5A5A5A" }}>Selection is limited.
            Execution is everything.
          </p>
        </Card>

      </section>

      {/* Mobile CTA at page end (non-sticky) */}
      <div className="block md:hidden mt-6 mb-8 px-4 sm:px-0">
        <div className="max-w-md mx-auto">
          <Button className="w-full py-4 font-semibold rounded-full shadow-lg" style={{ backgroundColor: "#E63946", color: "white" }} onClick={() => navigate(tutorLandingPath)}>
            Apply Now - Start Training
          </Button>
        </div>
      </div>

      {/* Footer (operational-landing style) */}
      <footer className="py-12" style={{ backgroundColor: "#FFF5ED" }}>
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-2">
              <ResponseIntegrityLogo size="md" variant="integrity" />
            </div>
            <p className="text-center md:text-right" style={{ color: "#5A5A5A" }}>
              &copy; {new Date().getFullYear()} Response Integrity (Pty) Ltd
              <br />
              <span className="text-sm">Manufacturing Confidence & Financial Independence in South African Youth.</span>
            </p>
          </div>
        </div>
      </footer>

    </div>
  );
}

