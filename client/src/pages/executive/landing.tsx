import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Building2, Users, TrendingUp, Check, ArrowRight, ArrowLeft, Shield, Cpu, Megaphone } from "lucide-react";
import { useEffect } from "react";

export default function ExecutiveLanding() {
  const navigate = useNavigate();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  const roles = [
    {
      id: "coo",
      title: "Chief Operating Officer",
      shortTitle: "COO",
      description: "Lead Response Integrity operations across pods, tutor deployment, and system execution quality",
      icon: Building2,
      features: [
        "Pod Management & Assignments",
        "Tutor Performance Tracking",
        "Broadcast Communications",
        "Operations Dashboard",
        "Quality Control & Verification",
      ],
    },
    {
      id: "hr",
      title: "Head of Human Resources",
      shortTitle: "HR",
      description: "Own recruitment, people performance, role health, and staffing continuity across the company",
      icon: Users,
      features: [
        "Staff Management",
        "Traffic & Enrollment Metrics",
        "Personnel Updates",
        "HR Analytics",
        "Team Performance Reports",
      ],
    },
    {
      id: "ceo",
      title: "Chief Executive Officer",
      shortTitle: "CEO",
      description: "Steer strategic direction with full-system visibility across growth, operations, and outcomes",
      icon: TrendingUp,
      features: [
        "Executive Dashboard",
        "Strategic Insights",
        "Business Intelligence",
        "Growth Metrics",
        "Company-Wide Analytics",
      ],
    },
    {
      id: "cto",
      title: "Chief Technology Officer",
      shortTitle: "CTO",
      description: "Track system execution, app delivery, infrastructure health, and technical proof of implementation",
      icon: Cpu,
      features: [
        "Command Rhythm Dashboard",
        "Technical Task Tracking",
        "Proof-Backed Delivery",
        "Infrastructure Visibility",
        "System Documentation",
      ],
    },
    {
      id: "cmo",
      title: "Chief Marketing Officer",
      shortTitle: "CMO",
      description: "Own campaigns, content output, outreach proof, and brand execution with visible accountability",
      icon: Megaphone,
      features: [
        "Command Rhythm Dashboard",
        "Campaign Task Tracking",
        "Proof Archive",
        "Growth Experiment Visibility",
        "Weekly Marketing Records",
      ],
    },
  ];

  const handleRoleSelect = (role: string) => {
    navigate(`/executive/signup?role=${role}`);
  };

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
              EXECUTIVE PORTAL
            </span>
          </div>
          
          <Button
            className="text-sm sm:text-base font-semibold px-4 sm:px-6 py-2 sm:py-5 rounded-full"
            style={{ backgroundColor: "#E63946", color: "white" }}
            onClick={() => navigate("/executive/signup")}
          >
            Enter Gateway
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
            EXECUTIVE PORTAL
          </span>
        </div>
        
        <div className="text-center max-w-3xl mx-auto space-y-5 sm:space-y-8">
          <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full" style={{ backgroundColor: "#FFF0F0" }}>
            <span className="text-xs sm:text-sm font-medium" style={{ color: "#E63946" }}>
              Response Integrity Leadership System
            </span>
          </div>
          
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold leading-tight tracking-tight" style={{ color: "#1A1A1A" }}>
            Lead 
            <br />
            <span style={{ color: "#E63946" }}>Execution.</span>
          </h1>
          
          <p className="text-base sm:text-lg md:text-xl leading-relaxed" style={{ color: "#5A5A5A" }}>
            Enter the executive gateway, verify seat authority, and run the Response Integrity operating system through appointed command roles.
          </p>

          <Button
            size="lg"
            className="text-base sm:text-lg font-semibold px-6 sm:px-8 py-4 sm:py-6 rounded-full shadow-lg hover:shadow-xl transition-all"
            style={{ backgroundColor: "#E63946", color: "white" }}
            onClick={() => navigate("/executive/signup")}
          >
            Enter Executive Gateway
            <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 ml-2" />
          </Button>
        </div>
      </section>

      {/* Role Selection */}
      <section className="py-12 sm:py-20" style={{ backgroundColor: "#1A1A1A" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-12">
          <div className="text-center max-w-3xl mx-auto mb-8 sm:mb-16">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4 sm:mb-6" style={{ color: "white" }}>
              Select Executive Access
            </h2>
            <p className="text-sm sm:text-lg" style={{ color: "#A0A0A0" }}>
              Create or access your executive identity. Only CEO-appointed seats enter live command.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 xl:grid-cols-5 gap-4 sm:gap-8 max-w-screen-2xl mx-auto">
            {roles.map((role) => {
              const Icon = role.icon;
              return (
                <Card 
                  key={role.id} 
                  className="p-4 sm:p-8 border-0 shadow-lg hover:shadow-xl transition-all cursor-pointer group flex flex-col h-full min-w-0"
                  style={{ backgroundColor: "white" }}
                  onClick={() => handleRoleSelect(role.id)}
                >
                  <div 
                    className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center mb-4 sm:mb-6 group-hover:scale-110 transition-transform"
                    style={{ backgroundColor: "#FFF0F0" }}
                  >
                    <Icon className="w-6 h-6 sm:w-8 sm:h-8" style={{ color: "#E63946" }} />
                  </div>
                  <h3 className="text-base sm:text-xl font-bold mb-1 sm:mb-2" style={{ color: "#1A1A1A" }}>
                    {role.title}
                  </h3>
                  <p className="text-xs sm:text-sm mb-4 sm:mb-6" style={{ color: "#5A5A5A" }}>
                    {role.description}
                  </p>
                  
                  <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wide mb-2 sm:mb-4" style={{ color: "#E63946" }}>
                    Your Dashboard Includes
                  </p>
                  <ul className="space-y-1.5 sm:space-y-2 mb-4 sm:mb-6">
                    {role.features.map((feature, idx) => (
                      <li key={idx} className="flex items-center gap-2 text-xs sm:text-sm" style={{ color: "#5A5A5A" }}>
                        <Check className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" style={{ color: "#E63946" }} />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  
                  <Button 
                    className="w-full px-4 sm:px-6 rounded-full py-2.5 sm:py-3.5 mt-auto font-semibold text-sm sm:text-base text-center box-border"
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
            <div className="flex items-center gap-2 text-center md:text-right" style={{ color: "#5A5A5A" }}>
              <Shield className="w-4 h-4 hidden sm:block" />
              <span className="text-xs sm:text-sm">Executive command environment secured with role-based access control</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
