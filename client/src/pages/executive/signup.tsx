import { useEffect, useState } from "react";
import { ExecutiveAuthForm } from "@/components/auth/executive-auth-form";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Building2, Users, TrendingUp, ArrowLeft, ArrowRight, Check, Cpu, Megaphone } from "lucide-react";

type Role = "coo" | "hr" | "ceo" | "cto" | "cmo";

const roleData = {
  coo: {
    title: "Chief Operating Officer",
    shortTitle: "COO",
    description: "Manage day-to-day operations, pods, tutor assignments, and communications",
    icon: Building2,
    features: ["Pod Management", "Tutor Assignments", "Broadcast System", "Performance Analytics"],
  },
  hr: {
    title: "Head of Human Resources",
    shortTitle: "HR",
    description: "Oversee staffing, metrics, personnel updates, and HR analytics",
    icon: Users,
    features: ["Staff Management", "Enrollment Metrics", "Personnel Updates", "Team Analytics"],
  },
  ceo: {
    title: "Chief Executive Officer",
    shortTitle: "CEO",
    description: "View executive dashboard, strategic insights, and business intelligence",
    icon: TrendingUp,
    features: ["Executive Dashboard", "Strategic Insights", "Growth Metrics", "Company Analytics"],
  },
  cto: {
    title: "Chief Technology Officer",
    shortTitle: "CTO",
    description: "Track system execution, proof-backed delivery, and technical operating truth",
    icon: Cpu,
    features: ["Command Dashboard", "Technical Tasks", "Proof Archive", "Delivery Visibility"],
  },
  cmo: {
    title: "Chief Marketing Officer",
    shortTitle: "CMO",
    description: "Track campaigns, content output, growth experiments, and proof of market work",
    icon: Megaphone,
    features: ["Command Dashboard", "Campaign Tasks", "Proof Archive", "Weekly Records"],
  },
};

export default function ExecutiveSignup() {
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [mode, setMode] = useState<"signup" | "login">("login");
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const requestedRole = searchParams.get("role");
    if (requestedRole && requestedRole in roleData) {
      setSelectedRole(requestedRole as Role);
    }
  }, [searchParams]);

  if (!selectedRole) {
    return (
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#FFF5ED" }}>
        {/* Header */}
        <header className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md" style={{ backgroundColor: "rgba(255, 245, 237, 0.95)" }}>
          <div className="max-w-7xl mx-auto px-3 sm:px-6 md:px-12 h-16 sm:h-20 flex items-center justify-between">
            <Button
              variant="ghost"
              className="text-sm sm:text-base font-medium hover:bg-transparent flex items-center gap-1 sm:gap-2 px-2 sm:px-4"
              style={{ color: "#1A1A1A" }}
              onClick={() => navigate("/executive/landing")}
            >
              <ArrowLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              Back
            </Button>
            
            <span className="text-base sm:text-xl lg:text-2xl font-bold tracking-tight" style={{ color: "#1A1A1A" }}>
              EXECUTIVE PORTAL
            </span>
            
            <div className="w-12 sm:w-20" /> {/* Spacer for centering */}
          </div>
        </header>

        {/* Spacer for fixed header */}
        <div className="h-16 sm:h-20" />

        {/* Role Selection */}
        <div className="flex-1 flex items-center justify-center px-4 sm:px-6 py-6 sm:py-12">
          <div className="w-full max-w-screen-2xl space-y-6 sm:space-y-10">
            <div className="text-center space-y-3 sm:space-y-4">
              <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full" style={{ backgroundColor: "#FFF0F0" }}>
                <span className="text-xs sm:text-sm font-medium" style={{ color: "#E63946" }}>
                  Select Your Role
                </span>
              </div>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold" style={{ color: "#1A1A1A" }}>
                Access Your <span style={{ color: "#E63946" }}>Executive Gateway</span>
              </h2>
              <p className="text-sm sm:text-base" style={{ color: "#5A5A5A" }}>
                Choose your role to access the appropriate gateway and command tools
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 sm:gap-6">
              {(Object.keys(roleData) as Role[]).map((roleKey) => {
                const role = roleData[roleKey];
                const Icon = role.icon;
                return (
                  <Card 
                    key={roleKey}
                    className="p-4 sm:p-6 border-0 shadow-lg hover:shadow-xl transition-all cursor-pointer group flex flex-col h-full min-w-0"
                    style={{ backgroundColor: "white" }}
                    onClick={() => setSelectedRole(roleKey)}
                  >
                    <div 
                      className="w-10 h-10 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center mb-3 sm:mb-5 group-hover:scale-110 transition-transform"
                      style={{ backgroundColor: "#FFF0F0" }}
                    >
                      <Icon className="w-5 h-5 sm:w-7 sm:h-7" style={{ color: "#E63946" }} />
                    </div>
                    <h3 className="text-sm sm:text-lg font-bold mb-1 sm:mb-2" style={{ color: "#1A1A1A" }}>
                      {role.title}
                    </h3>
                    <p className="text-xs sm:text-sm mb-3 sm:mb-4" style={{ color: "#5A5A5A" }}>
                      {role.description}
                    </p>
                    
                    <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wide mb-2 sm:mb-3" style={{ color: "#E63946" }}>
                      Access Includes
                    </p>
                    <ul className="space-y-1.5 sm:space-y-2 mb-3 sm:mb-5">
                      {role.features.map((feature, idx) => (
                        <li key={idx} className="flex items-center gap-2 text-xs sm:text-sm" style={{ color: "#5A5A5A" }}>
                          <Check className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" style={{ color: "#E63946" }} />
                          {feature}
                        </li>
                      ))}
                    </ul>
                    
                        <Button 
                          className="w-full flex items-center justify-center gap-2 px-4 sm:px-6 rounded-full py-2.5 sm:py-3.5 mt-auto font-semibold text-sm sm:text-base text-center box-border"
                      style={{ backgroundColor: "#E63946", color: "white" }}
                    >
                      Continue as {role.shortTitle}
                      <ArrowRight className="w-3 h-3 sm:w-4 sm:h-4 ml-2" />
                    </Button>
                  </Card>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const currentRole = roleData[selectedRole];
  const Icon = currentRole.icon;

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#FFF5ED" }}>
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md" style={{ backgroundColor: "rgba(255, 245, 237, 0.95)" }}>
        <div className="max-w-7xl mx-auto px-3 sm:px-6 md:px-12 h-16 sm:h-20 flex items-center justify-between">
          <Button
            variant="ghost"
            className="text-sm sm:text-base font-medium hover:bg-transparent flex items-center gap-1 sm:gap-2 px-2 sm:px-4"
            style={{ color: "#1A1A1A" }}
            onClick={() => setSelectedRole(null)}
          >
            <ArrowLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Back to Roles</span>
            <span className="sm:hidden">Back</span>
          </Button>
          
          <span className="text-base sm:text-xl lg:text-2xl font-bold tracking-tight" style={{ color: "#1A1A1A" }}>
            {currentRole.shortTitle}
          </span>
          
          <div className="w-16 sm:w-28" /> {/* Spacer for centering */}
        </div>
      </header>

      {/* Spacer for fixed header */}
      <div className="h-16 sm:h-20" />

      {/* Auth Form */}
      <div className="flex-1 flex items-center justify-center px-4 sm:px-6 py-6 sm:py-12">
        <div className="w-full max-w-md space-y-5 sm:space-y-8">
          {/* Hero Section */}
          <div className="text-center space-y-3 sm:space-y-4">
            <div 
              className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center mx-auto"
              style={{ backgroundColor: "#FFF0F0" }}
            >
              <Icon className="w-6 h-6 sm:w-8 sm:h-8" style={{ color: "#E63946" }} />
            </div>
            <h2 className="text-xl sm:text-3xl font-bold" style={{ color: "#1A1A1A" }}>
              {currentRole.title}
            </h2>
            <p className="text-sm sm:text-base" style={{ color: "#5A5A5A" }}>
              {currentRole.description}
            </p>
          </div>

          {/* Mode Toggle */}
          <div className="flex gap-2 justify-center p-1 rounded-full" style={{ backgroundColor: "#FFF0F0" }}>
            <button
              className={`flex-1 py-2 sm:py-3 px-4 sm:px-6 rounded-full font-semibold text-sm sm:text-base transition-all ${
                mode === "login" ? "shadow-md" : ""
              }`}
              style={{ 
                backgroundColor: mode === "login" ? "#E63946" : "transparent",
                color: mode === "login" ? "white" : "#5A5A5A"
              }}
              onClick={() => setMode("login")}
            >
              Login
            </button>
            <button
              className={`flex-1 py-2 sm:py-3 px-4 sm:px-6 rounded-full font-semibold text-sm sm:text-base transition-all ${
                mode === "signup" ? "shadow-md" : ""
              }`}
              style={{ 
                backgroundColor: mode === "signup" ? "#E63946" : "transparent",
                color: mode === "signup" ? "white" : "#5A5A5A"
              }}
              onClick={() => setMode("signup")}
            >
              Sign Up
            </button>
          </div>

          {/* Auth Form Container */}
          <Card className="p-4 sm:p-8 border-0 shadow-lg" style={{ backgroundColor: "white" }}>
            <ExecutiveAuthForm role={selectedRole as Role} mode={mode} setMode={setMode} />
          </Card>

          {/* Footer Info */}
          <p className="text-xs text-center mt-4" style={{ color: "#5A5A5A" }}>
            Executive identity does not equal command authority. CEO appointment activates the Core 5 seat.
          </p>

          <p className="text-xs text-center" style={{ color: "#5A5A5A" }}>
            By signing up, you agree to our{" "}
            <a href="/terms-of-use" target="_blank" className="underline hover:text-[#E63946]" style={{ color: "#1A1A1A" }}>
              Terms of Use
            </a>,{" "}
            <a href="/privacy-policy" target="_blank" className="underline hover:text-[#E63946]" style={{ color: "#1A1A1A" }}>
              Privacy Policy
            </a>, and{" "}
            <a href="/executive/recruitment-privacy" target="_blank" className="underline hover:text-[#E63946]" style={{ color: "#1A1A1A" }}>
              Recruitment & Employee Privacy Notice
            </a>.
          </p>
        </div>
      </div>
    </div>
  );
}
