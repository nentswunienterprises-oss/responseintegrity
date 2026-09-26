import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  GraduationCap,
  Users,
  Target,
  Heart,
  Sparkles,
  ArrowRight,
  Check,
  Star,
} from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: "#FFF5ED" }}>
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md" style={{ backgroundColor: "rgba(255, 245, 237, 0.95)" }}>
        <div className="max-w-7xl mx-auto px-3 sm:px-6 md:px-12 h-16 sm:h-20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img 
              src="/images/logo.png" 
              alt="Response Integrity" 
              className="h-8 sm:h-12 md:h-14 object-contain"
              onError={(e) => {
                // Fallback if image doesn't exist yet
                e.currentTarget.style.display = 'none';
                const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                if (fallback) fallback.classList.remove('hidden');
              }}
            />
            <div className="hidden">
              <span className="text-base sm:text-xl font-bold tracking-tight" style={{ color: "#1A1A1A" }}>
                RESPONSE INTEGRITY
              </span>
              <span className="text-base sm:text-xl font-bold" style={{ color: "#E63946" }}>+</span>
            </div>
          </div>
          
          {/* App Name - Center (hidden on mobile, shown in hero instead) */}
          <div className="hidden md:block">
            <span className="text-2xl lg:text-4xl font-bold tracking-tight uppercase">
              <span style={{ color: "#E63946" }}>Response</span>{" "}
              <span style={{ color: "#1A1A1A" }}>Integrity</span>
            </span>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-4">
            <Button
              variant="ghost"
              className="text-sm sm:text-base font-medium hover:bg-transparent px-2 sm:px-4"
              style={{ color: "#1A1A1A" }}
              onClick={() => window.location.href = "/auth?mode=login"}
            >
              Log In
            </Button>
            <Button
              className="text-sm sm:text-base font-semibold px-4 sm:px-6 py-2 sm:py-5 rounded-full border-0 shadow-lg hover:shadow-xl transition-all"
              style={{ backgroundColor: "#E63946", color: "white" }}
              onClick={() => window.location.href = "/auth?mode=signup"}
            >
              <span className="hidden sm:inline">Get Started</span>
              <span className="sm:hidden">Start</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Spacer for fixed header */}
      <div className="h-16 sm:h-20" />

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 md:px-12 pt-4 md:pt-8 pb-12 sm:pb-20">
        {/* Mobile App Title - shown only on mobile */}
        <div className="md:hidden text-center mb-6">
          <span className="text-2xl font-bold tracking-tight uppercase">
            <span style={{ color: "#E63946" }}>Response</span>{" "}
            <span style={{ color: "#1A1A1A" }}>Integrity</span>
          </span>
        </div>
        
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-16 items-center">
          {/* Left - Text Content */}
          <div className="space-y-5 sm:space-y-8">
            <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full" style={{ backgroundColor: "#FFF0F0" }}>
              <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4" style={{ color: "#E63946" }} />
              <span className="text-xs sm:text-sm font-medium" style={{ color: "#E63946" }}>
                Response Training for Grades 6-9
              </span>
            </div>
            
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold leading-tight tracking-tight" style={{ color: "#1A1A1A" }}>
              We Train Calm Execution.
              <br />
              <span style={{ color: "#E63946" }}>Under Pressure.</span>
            </h1>
            
            <p className="text-base sm:text-lg md:text-xl leading-relaxed" style={{ color: "#5A5A5A" }}>
              At Response Integrity, math is the training arena.
              Our tutors work with <span className="font-semibold" style={{ color: "#1A1A1A" }}>Grade 6–9 students</span> to 
              build calm, repeatable execution when work gets hard.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 pt-2 sm:pt-4">
              <Button
                size="lg"
                className="text-base sm:text-lg font-semibold px-6 sm:px-8 py-4 sm:py-6 rounded-full shadow-lg hover:shadow-xl transition-all border-0"
                style={{ backgroundColor: "#E63946", color: "white" }}
                onClick={() => window.location.href = "/auth?mode=signup"}
              >
                Start Your Journey
                <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 ml-2" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="text-base sm:text-lg font-medium px-6 sm:px-8 py-4 sm:py-6 rounded-full"
                style={{ borderColor: "#1A1A1A", borderWidth: "2px", color: "#1A1A1A", backgroundColor: "transparent" }}
                onClick={() => window.location.href = "/auth?mode=login"}
              >
                I'm Already a Member
              </Button>
            </div>

            {/* Trust indicators */}
            <div className="flex items-center gap-4 sm:gap-6 pt-2 sm:pt-4">
              <div className="flex -space-x-2">
                {[1, 2, 3, 4].map((i) => (
                  <div 
                    key={i} 
                    className="w-8 h-8 sm:w-10 sm:h-10 rounded-full border-2 flex items-center justify-center text-xs sm:text-sm font-medium"
                    style={{ 
                      backgroundColor: i % 2 === 0 ? "#FFF0F0" : "#E63946", 
                      borderColor: "#FFF5ED",
                      color: i % 2 === 0 ? "#E63946" : "white"
                    }}
                  >
                    {i % 2 === 0 ? "★" : "✓"}
                  </div>
                ))}
              </div>
              <div>
                <p className="text-sm sm:text-base font-semibold" style={{ color: "#1A1A1A" }}>Trusted by 500+ families</p>
                <p className="text-xs sm:text-sm" style={{ color: "#5A5A5A" }}>across South Africa</p>
              </div>
            </div>
          </div>

          {/* Right - Hero Image */}
          <div className="relative">
            <div 
              className="absolute inset-0 rounded-3xl transform rotate-3"
              style={{ backgroundColor: "#FFF0F0" }}
            />
            <img
              src="/images/ri-home-calm-precision.webp"
              alt="Student thinking with calm precision during online response training"
              className="relative rounded-3xl shadow-2xl w-full object-cover"
              style={{ aspectRatio: "4/3" }}
              onError={(e) => {
                // Fallback gradient if image doesn't exist
                e.currentTarget.style.display = 'none';
                const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                if (fallback) fallback.classList.remove('hidden');
              }}
            />
            <div 
              className="hidden relative rounded-3xl w-full flex items-center justify-center"
              style={{ aspectRatio: "4/3", backgroundColor: "#FFF0F0" }}
            >
              <div className="text-center p-8">
                <GraduationCap className="w-20 h-20 mx-auto mb-4" style={{ color: "#E63946" }} />
                <p className="text-lg font-medium" style={{ color: "#5A5A5A" }}>
                  Add hero-student.jpg to<br />client/public/images/
                </p>
              </div>
            </div>
            
            {/* Floating card */}
            <div 
              className="absolute -bottom-4 sm:-bottom-6 left-2 sm:-left-6 md:-left-12 p-3 sm:p-4 md:p-6 rounded-xl sm:rounded-2xl shadow-xl"
              style={{ backgroundColor: "white" }}
            >
              <div className="flex items-center gap-2 sm:gap-3">
                <div 
                  className="w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: "#FFF0F0" }}
                >
                  <Heart className="w-5 h-5 sm:w-6 sm:h-6 fill-current" style={{ color: "#E63946" }} />
                </div>
                <div>
                  <p className="font-bold text-sm sm:text-lg" style={{ color: "#1A1A1A" }}>Calm First</p>
                  <p className="text-xs sm:text-sm" style={{ color: "#5A5A5A" }}>Confidence follows</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Philosophy Section */}
      <section className="py-12 sm:py-20" style={{ backgroundColor: "#1A1A1A" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-12">
          <div className="text-center max-w-3xl mx-auto mb-10 sm:mb-16">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4 sm:mb-6" style={{ color: "white" }}>
              The Response Integrity Difference
            </h2>
            <p className="text-base sm:text-lg" style={{ color: "#A0A0A0" }}>
              We're not another tutoring company. We're a response-conditioning system for execution under pressure.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6 md:gap-8">
            {[
              {
                icon: Heart,
                title: "Response Blueprint",
                description: "Our proprietary method trains recognition, method, correction, and pressure tolerance before outcomes are chased."
              },
              {
                icon: Users,
                title: "Pod System",
                description: "Students train in small, structured Pods. Each Pod protects repetition, standards, and calm execution."
              },
              {
                icon: Sparkles,
                title: "Real Transformation",
                description: "We measure success in response stability: what students do when certainty drops, time tightens, or mistakes appear."
              }
            ].map((item, index) => (
              <div 
                key={index}
                className="p-5 sm:p-6 md:p-8 rounded-xl sm:rounded-2xl"
                style={{ backgroundColor: "#2A2A2A" }}
              >
                <div 
                  className="w-11 h-11 sm:w-14 sm:h-14 rounded-lg sm:rounded-xl flex items-center justify-center mb-4 sm:mb-6"
                  style={{ backgroundColor: "#E63946" }}
                >
                  <item.icon className="w-5 h-5 sm:w-7 sm:h-7 text-white" />
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

      {/* Stats Section */}
      <section className="py-10 sm:py-16" style={{ backgroundColor: "#E63946" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-8 text-center">
            {[
              { number: "500+", label: "Students Transformed" },
              { number: "50+", label: "Dedicated Tutors" },
              { number: "95%", label: "Parent Satisfaction" },
              { number: "4.9", label: "Average Rating" }
            ].map((stat, index) => (
              <div key={index}>
                <p className="text-2xl sm:text-4xl md:text-5xl font-bold text-white mb-1 sm:mb-2">
                  {stat.number}
                </p>
                <p className="text-white/80 text-xs sm:text-sm md:text-base">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonial Section */}
      <section className="py-12 sm:py-20" style={{ backgroundColor: "#FFF5ED" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-12">
          <div className="text-center max-w-3xl mx-auto mb-10 sm:mb-16">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4 sm:mb-6" style={{ color: "#1A1A1A" }}>
              Stories of Transformation
            </h2>
            <p className="text-base sm:text-lg" style={{ color: "#5A5A5A" }}>
              Real families, real results, real response change.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 md:gap-8">
            {[
              {
                quote: "My daughter went from hiding in the back of class to raising her hand every day. That's the real win.",
                name: "Nomsa M.",
                role: "Parent, Johannesburg"
              },
              {
                quote: "Response Integrity didn't just help me with maths. They helped me believe I could actually do it.",
                name: "Thabo K.",
                role: "Grade 9 Student"
              },
              {
                quote: "Being a Response Integrity tutor changed how I see education. It's not about information transfer-it's about transformation.",
                name: "Lerato P.",
                role: "Territorial Tutor"
              }
            ].map((testimonial, index) => (
              <Card 
                key={index}
                className="p-5 sm:p-6 md:p-8 border-0 shadow-lg"
                style={{ backgroundColor: "white" }}
              >
                <div className="flex gap-0.5 sm:gap-1 mb-3 sm:mb-4">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star key={star} className="w-4 h-4 sm:w-5 sm:h-5 fill-current" style={{ color: "#E63946" }} />
                  ))}
                </div>
                <p className="text-base sm:text-lg mb-4 sm:mb-6 leading-relaxed" style={{ color: "#1A1A1A" }}>
                  "{testimonial.quote}"
                </p>
                <div>
                  <p className="font-semibold text-sm sm:text-base" style={{ color: "#1A1A1A" }}>{testimonial.name}</p>
                  <p className="text-xs sm:text-sm" style={{ color: "#5A5A5A" }}>{testimonial.role}</p>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Role Selection Section */}
      <section className="py-12 sm:py-20" style={{ backgroundColor: "#FFF5ED" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-12">
          <div className="text-center max-w-3xl mx-auto mb-10 sm:mb-16">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4 sm:mb-6" style={{ color: "#1A1A1A" }}>
              Join the Movement
            </h2>
            <p className="text-base sm:text-lg" style={{ color: "#5A5A5A" }}>
              Whether you're a parent, a student, or want to become a tutor-there's a place for you.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6 md:gap-8">
            {/* Parent/Student */}
            <Card 
              className="p-5 sm:p-6 md:p-8 border-2 hover:border-[#E63946] cursor-pointer transition-all hover:shadow-xl group"
              style={{ borderColor: "#E5E5E5" }}
              onClick={() => window.location.href = "/"}
            >
              <div 
                className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl flex items-center justify-center mb-4 sm:mb-6 group-hover:scale-110 transition-transform"
                style={{ backgroundColor: "#FFF0F0" }}
              >
                <Heart className="w-6 h-6 sm:w-8 sm:h-8" style={{ color: "#E63946" }} />
              </div>
              <h3 className="text-xl sm:text-2xl font-bold mb-2 sm:mb-3" style={{ color: "#1A1A1A" }}>
                Parents & Students
              </h3>
              <p className="text-sm sm:text-base mb-4 sm:mb-6" style={{ color: "#5A5A5A" }}>
                Enroll your Grade 6–9 child in our response-conditioning programme.
              </p>
              <ul className="space-y-2 sm:space-y-3 mb-6 sm:mb-8">
                {["Access to trained tutors", "Track response stability", "Weekly progress updates", "Parent dashboard"].map((item, i) => (
                  <li key={i} className="flex items-center gap-2 sm:gap-3">
                    <Check className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" style={{ color: "#E63946" }} />
                    <span className="text-sm sm:text-base" style={{ color: "#5A5A5A" }}>{item}</span>
                  </li>
                ))}
              </ul>
              <Button 
                className="w-full rounded-full py-4 sm:py-6 font-semibold group-hover:shadow-lg transition-all text-sm sm:text-base border-0"
                style={{ backgroundColor: "#E63946", color: "white" }}
              >
                Get Started
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Card>

            {/* Tutor */}
            <Card 
              className="p-5 sm:p-6 md:p-8 border-2 hover:border-[#E63946] cursor-pointer transition-all hover:shadow-xl group"
              style={{ borderColor: "#E5E5E5" }}
              onClick={() => window.location.href = "/auth?mode=signup"}
            >
              <div 
                className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl flex items-center justify-center mb-4 sm:mb-6 group-hover:scale-110 transition-transform"
                style={{ backgroundColor: "#FFF0F0" }}
              >
                <GraduationCap className="w-6 h-6 sm:w-8 sm:h-8" style={{ color: "#E63946" }} />
              </div>
              <h3 className="text-xl sm:text-2xl font-bold mb-2 sm:mb-3" style={{ color: "#1A1A1A" }}>
                Become a Tutor
              </h3>
              <p className="text-sm sm:text-base mb-4 sm:mb-6" style={{ color: "#5A5A5A" }}>
                Join our team of response-conditioning operators and build real execution skill while earning.
              </p>
              <ul className="space-y-2 sm:space-y-3 mb-6 sm:mb-8">
                {["Flexible schedule", "Meaningful work", "Training provided", "Grow your income"].map((item, i) => (
                  <li key={i} className="flex items-center gap-2 sm:gap-3">
                    <Check className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" style={{ color: "#E63946" }} />
                    <span className="text-sm sm:text-base" style={{ color: "#5A5A5A" }}>{item}</span>
                  </li>
                ))}
              </ul>
              <Button 
                className="w-full rounded-full py-4 sm:py-6 font-semibold group-hover:shadow-lg transition-all text-sm sm:text-base border-0"
                style={{ backgroundColor: "#E63946", color: "white" }}
              >
                Apply Now
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Card>

            {/* Team */}
            <Card 
              className="p-5 sm:p-6 md:p-8 border-2 hover:border-[#E63946] cursor-pointer transition-all hover:shadow-xl group sm:col-span-2 md:col-span-1"
              style={{ borderColor: "#E5E5E5" }}
              onClick={() => window.location.href = "/auth?mode=login"}
            >
              <div 
                className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl flex items-center justify-center mb-4 sm:mb-6 group-hover:scale-110 transition-transform"
                style={{ backgroundColor: "#FFF0F0" }}
              >
                <Target className="w-6 h-6 sm:w-8 sm:h-8" style={{ color: "#E63946" }} />
              </div>
              <h3 className="text-xl sm:text-2xl font-bold mb-2 sm:mb-3" style={{ color: "#1A1A1A" }}>
                Team Login
              </h3>
              <p className="text-sm sm:text-base mb-4 sm:mb-6" style={{ color: "#5A5A5A" }}>
                For Territory Directors, Operations team, and existing tutors.
              </p>
              <ul className="space-y-2 sm:space-y-3 mb-6 sm:mb-8">
                {["Manage your pods", "Track student progress", "Access broadcasts", "View analytics"].map((item, i) => (
                  <li key={i} className="flex items-center gap-2 sm:gap-3">
                    <Check className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" style={{ color: "#E63946" }} />
                    <span className="text-sm sm:text-base" style={{ color: "#5A5A5A" }}>{item}</span>
                  </li>
                ))}
              </ul>
              <Button 
                variant="outline"
                className="w-full rounded-full py-4 sm:py-6 font-semibold border-2 group-hover:shadow-lg transition-all text-sm sm:text-base"
                style={{ borderColor: "#1A1A1A", color: "#1A1A1A" }}
              >
                Sign In
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-12 sm:py-20" style={{ backgroundColor: "#1A1A1A" }}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 md:px-12 text-center">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4 sm:mb-6" style={{ color: "white" }}>
            Ready to Train Calm Execution?
          </h2>
          <p className="text-base sm:text-lg mb-8 sm:mb-10" style={{ color: "#A0A0A0" }}>
            Join families across South Africa choosing structure, discipline, and response stability.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
            <Button
              size="lg"
              className="text-base sm:text-lg font-semibold px-6 sm:px-10 py-4 sm:py-6 rounded-full border-0 shadow-lg hover:shadow-xl transition-all"
              style={{ backgroundColor: "#E63946", color: "white" }}
              onClick={() => window.location.href = "/auth?mode=signup"}
            >
              Start Your Journey Today
              <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 ml-2" />
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 sm:py-12" style={{ backgroundColor: "#FFF5ED" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-12">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 sm:gap-6">
            <div className="flex items-center gap-2">
              <span className="text-base sm:text-xl font-bold tracking-tight" style={{ color: "#1A1A1A" }}>
                RESPONSE INTEGRITY
              </span>
              <span className="text-base sm:text-xl font-bold" style={{ color: "#E63946" }}>+</span>
            </div>
            <div className="text-center md:text-right">
              <p className="text-sm sm:text-base" style={{ color: "#5A5A5A" }}>
                © {new Date().getFullYear()} Response Integrity (Pty) Ltd
                <br />
                <span className="text-xs sm:text-sm">
                  Manufacturing Confidence & Financial Independence in South African Youth.
                </span>
              </p>
              <div className="flex gap-4 justify-center md:justify-end mt-2">
                <button onClick={() => window.location.href = "/privacy-policy"} className="text-xs hover:underline" style={{ color: "#5A5A5A" }}>
                  Privacy Policy
                </button>
                <button onClick={() => window.location.href = "/terms-of-use"} className="text-xs hover:underline" style={{ color: "#5A5A5A" }}>
                  Terms of Use
                </button>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
