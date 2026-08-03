
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { Check, ArrowRight, ArrowLeft, Brain, Crown, Heart } from "lucide-react";
import { useEffect } from "react";
import { ResponseIntegrityLogo } from "@/components/ResponseIntegrityLogo";

export default function OperationalLanding() {
  const navigate = useNavigate();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#FFF5ED" }}>
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md" style={{ backgroundColor: "rgba(255, 245, 237, 0.95)" }}>
        <div className="max-w-7xl mx-auto px-3 sm:px-6 md:px-12 h-16 sm:h-20 flex items-center justify-between">
          <Button
            variant="ghost"
            className="text-sm sm:text-base font-medium hover:bg-transparent flex items-center gap-1 sm:gap-2 px-2 sm:px-4"
            style={{ color: "#1A1A1A" }}
            onClick={() => navigate("/")}
          >
            <ArrowLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            Back
          </Button>
          
          <div className="hidden md:block">
            <span className="text-2xl lg:text-3xl font-bold tracking-tight" style={{ color: "#1A1A1A" }}>
              RESPONSE AUDITORS WANTED
            </span>
          </div>
          
          <Button
            className="text-sm sm:text-base font-semibold px-4 sm:px-6 py-2 sm:py-5 rounded-full border-0 shadow-lg hover:shadow-xl transition-all"
            style={{ backgroundColor: "#E63946", color: "white" }}
            onClick={() => navigate("/operational/td/signup")}
          >
            Sign In
          </Button>
        </div>
      </header>

      {/* Spacer for fixed header */}
      <div className="h-16 sm:h-20" />

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 md:px-12 pt-8 sm:pt-12 md:pt-20 pb-12 sm:pb-20">
        {/* Mobile Title */}
        <div className="md:hidden text-center mb-6">
          <span className="text-xl font-bold tracking-tight" style={{ color: "#1A1A1A" }}>
            RESPONSE AUDITORS WANTED
          </span>
        </div>
        
        <div className="text-center max-w-3xl mx-auto space-y-5 sm:space-y-8">
          <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full" style={{ backgroundColor: "#FFF0F0" }}>
            <span className="text-xs sm:text-sm font-medium" style={{ color: "#E63946" }}>
              Founding Team Response Auditors
            </span>
          </div>
          
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold leading-tight tracking-tight" style={{ color: "#1A1A1A" }}>
            Train How Students
            <br />
            <span style={{ color: "#E63946" }}>Respond Under Pressure.</span>
          </h1>
          
          <p className="text-base sm:text-lg md:text-xl leading-relaxed" style={{ color: "#5A5A5A" }}>
            Join a founding team building response integrity into every student. The work is built on discipline, clarity, and repeatability. Selection is careful and role-specific.
          </p>

          <Button
            size="lg"
            className="text-base sm:text-lg font-semibold px-6 sm:px-8 py-4 sm:py-6 rounded-full shadow-lg hover:shadow-xl transition-all border-0"
            style={{ backgroundColor: "#E63946", color: "white" }}
            onClick={() => navigate("/operational/td/landing")}
          >
            Apply to Join
            <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 ml-2" />
          </Button>
        </div>
      </section>

      {/* Role Selection */}
      <section className="py-20" style={{ backgroundColor: "#1A1A1A" }}>
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-6" style={{ color: "white" }}>
              Choose Your Role
            </h2>
            <p className="text-lg" style={{ color: "#A0A0A0" }}>
              Select the path that matches your goals
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {/* Tutor Role */}
            <Card 
              className="p-8 border-0 shadow-lg hover:shadow-xl transition-all cursor-pointer group flex flex-col h-full min-w-0"
              style={{ backgroundColor: "white" }}
              onClick={() => navigate("/operational/tutor/landing")}
            >
              <div 
                className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform"
                style={{ backgroundColor: "#E63946" }}
              >
                <div className="w-8 h-8 rounded-full" style={{ backgroundColor: "white" }} />
              </div>
              <h3 className="text-2xl font-bold mb-3" style={{ color: "#1A1A1A" }}>
                Tutor
              </h3>
              <p className="mb-6" style={{ color: "#5A5A5A" }}>
                Lead student Response Pods and train execution
              </p>
              
              <p className="text-xs font-semibold uppercase tracking-wide mb-4" style={{ color: "#E63946" }}>
                Your Dashboard Includes
              </p>
              <ul className="space-y-3 mb-8">
                {["Student Rosters & Profiles", "Weekly Check-In Forms", "Progress Tracking & Reflections", "Feedback & Coaching Notes", "Growth Metrics Dashboard"].map((item, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <Check className="w-5 h-5 flex-shrink-0" style={{ color: "#E63946" }} />
                    <span style={{ color: "#5A5A5A" }}>{item}</span>
                  </li>
                ))}
              </ul>
              
              <Button 
                className="w-full px-4 sm:px-6 rounded-full py-2.5 sm:py-3.5 mt-auto font-semibold border-0 text-center box-border"
                style={{ backgroundColor: "#E63946", color: "white" }}
              >
                Continue as Tutor
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Card>

            {/* Territory Director Role */}
            <Card 
              className="p-8 border-0 shadow-lg hover:shadow-xl transition-all cursor-pointer group flex flex-col h-full min-w-0"
              style={{ backgroundColor: "white" }}
              onClick={() => navigate("/operational/td/landing")}
            >
              <div 
                className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform"
                style={{ backgroundColor: "#E63946" }}
              >
                <div className="w-8 h-8 rounded-full" style={{ backgroundColor: "white" }} />
              </div>
              <h3 className="text-2xl font-bold mb-3" style={{ color: "#1A1A1A" }}>
                Territory Director
              </h3>
              <p className="mb-6" style={{ color: "#5A5A5A" }}>
                Oversee multiple pods, tutors, and ensure quality consistency
              </p>
              
              <p className="text-xs font-semibold uppercase tracking-wide mb-4" style={{ color: "#E63946" }}>
                Your Dashboard Includes
              </p>
              <ul className="space-y-3 mb-8">
                {["Tutor Performance Reports", "All Student Check-Ins (Territory-wide)", "Territory Analytics & KPIs", "Tutor Coaching & Feedback Management", "Enrollment & Retention Tracking"].map((item, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <Check className="w-5 h-5 flex-shrink-0" style={{ color: "#E63946" }} />
                    <span style={{ color: "#5A5A5A" }}>{item}</span>
                  </li>
                ))}
              </ul>
              
              <Button 
                className="w-full px-4 sm:px-6 rounded-full py-2.5 sm:py-3.5 mt-auto font-semibold border-0 text-center box-border"
                style={{ backgroundColor: "#E63946", color: "white" }}
              >
                Continue as Territory Director
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Card>
          </div>
        </div>
      </section>

      {/* What We're Looking For */}
      <section className="py-20" style={{ backgroundColor: "#FFF5ED" }}>
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-6" style={{ color: "#1A1A1A" }}>
              What We're Looking For
            </h2>
            <p className="text-lg" style={{ color: "#5A5A5A" }}>
              The qualities that make great Tutors and Territory Directors
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {/* Tutors */}
            <Card 
              className="p-8 border-0 shadow-lg"
              style={{ backgroundColor: "white" }}
            >
              <div className="flex items-center gap-3 mb-6">
                <div 
                  className="w-12 h-12 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: "#FFF0F0" }}
                >
                  <Brain className="w-6 h-6" style={{ color: "#E63946" }} />
                </div>
                <h3 className="text-xl font-bold" style={{ color: "#1A1A1A" }}>Tutors</h3>
              </div>
              <div className="space-y-4">
                {[
                  "Strong math background (high school level minimum)",
                  "Natural mentoring ability and student empathy",
                  "Commitment to student confidence (not just grades)",
                  "Reliability and consistent presence",
                  "Openness to feedback and continuous learning"
                ].map((item, i) => (
                  <div key={i} className="flex gap-3">
                    <Check className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: "#E63946" }} />
                    <span className="text-sm" style={{ color: "#5A5A5A" }}>{item}</span>
                  </div>
                ))}
              </div>
            </Card>

            {/* Territory Directors */}
            <Card 
              className="p-8 border-0 shadow-lg"
              style={{ backgroundColor: "white" }}
            >
              <div className="flex items-center gap-3 mb-6">
                <div 
                  className="w-12 h-12 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: "#FFF0F0" }}
                >
                  <Crown className="w-6 h-6" style={{ color: "#E63946" }} />
                </div>
                <h3 className="text-xl font-bold" style={{ color: "#1A1A1A" }}>Territory Directors</h3>
              </div>
              <div className="space-y-4">
                {[
                  "Leadership experience managing teams",
                  "Strategic thinking and operational excellence",
                  "Community relationships (school/parent networks)",
                  "Data-driven decision making",
                  "Passion for educational impact"
                ].map((item, i) => (
                  <div key={i} className="flex gap-3">
                    <Check className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: "#E63946" }} />
                    <span className="text-sm" style={{ color: "#5A5A5A" }}>{item}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20" style={{ backgroundColor: "#E63946" }}>
        <div className="max-w-4xl mx-auto px-6 md:px-12 text-center">
          <div className="flex justify-center mb-6">
            <div 
              className="w-16 h-16 rounded-full flex items-center justify-center"
              style={{ backgroundColor: "rgba(255,255,255,0.2)" }}
            >
              <Heart className="w-8 h-8 text-white fill-current" />
            </div>
          </div>
          <p className="text-sm uppercase tracking-wide mb-4 text-white/60 font-medium">
            We're Selective About Who Joins
          </p>
          <h2 className="text-3xl md:text-4xl font-bold mb-6 text-white">
            Ready to Make a Difference?
          </h2>
          <p className="text-lg mb-10 text-white/80">
            Join our founding team of response-conditioning operators and help prove that disciplined transformation is teachable.
          </p>
          <Button
            size="lg"
            className="text-lg font-semibold px-10 py-6 rounded-full border-0"
            style={{ backgroundColor: "white", color: "#E63946" }}
            onClick={() => navigate("/operational/td/landing")}
          >
            Apply to Join
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12" style={{ backgroundColor: "#FFF5ED" }}>
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-2">
              <ResponseIntegrityLogo size="md" variant="integrity" />
            </div>
            <p className="text-center md:text-right" style={{ color: "#5A5A5A" }}>
              &copy; {new Date().getFullYear()} Response Integrity (Pty) Ltd
              <br />
              <span className="text-sm">
                Manufacturing Confidence & Financial Independence in South African Youth.
              </span>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

