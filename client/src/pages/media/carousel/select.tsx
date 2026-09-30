import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";

// Response Integrity Content Pillars
const PILLARS = [
  { id: "response-training", label: "Response Training", description: "How we condition execution under pressure" },
  { id: "pressure-environment", label: "Pressure Environment", description: "The area where response breaks down" },
  { id: "calm-execution", label: "Calm Execution", description: "The behavioral outcome we train" },
  { id: "structure", label: "Structure", description: "The system that removes panic" },
] as const;

// Situations (contexts for the message)
const SITUATIONS = [
  { id: "enrollment", label: "Enrollment", description: "Parent considering Response Integrity" },
  { id: "onboarding", label: "Onboarding", description: "New family joining" },
  { id: "progress", label: "Progress Update", description: "Mid-term status" },
  { id: "exam-prep", label: "Exam Preparation", description: "High-pressure period" },
  { id: "retention", label: "Retention", description: "Renewal or continued engagement" },
  { id: "referral", label: "Referral", description: "Existing family sharing Response Integrity" },
] as const;

// Audiences
const AUDIENCES = [
  { id: "parent", label: "Parent", description: "Decision maker, seeks relief" },
  { id: "student", label: "Student", description: "Performer, needs structure" },
  { id: "tutor", label: "Tutor", description: "Tutor, executes the system" },
] as const;

// Platforms
const PLATFORMS = [
  { id: "instagram", label: "Instagram", description: "Square or 4:5 format" },
  { id: "tiktok", label: "TikTok", description: "9:16 vertical format" },
] as const;

type Step = "pillar" | "situation" | "audience" | "platform";

export default function CarouselSelect() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState<Step>("pillar");
  const [selections, setSelections] = useState({
    pillar: "",
    situation: "",
    audience: "",
    platform: "",
  });

  const handleSelect = (step: Step, value: string) => {
    setSelections(prev => ({ ...prev, [step]: value }));
    
    // Auto-advance to next step
    if (step === "pillar") setCurrentStep("situation");
    else if (step === "situation") setCurrentStep("audience");
    else if (step === "audience") setCurrentStep("platform");
    else if (step === "platform") {
      // All selections made, proceed to editor
      const params = new URLSearchParams({
        pillar: selections.pillar,
        situation: selections.situation,
        audience: selections.audience,
        platform: value,
      });
      navigate(`/media/carousel/create?${params.toString()}`);
    }
  };

  const handleBack = () => {
    if (currentStep === "situation") setCurrentStep("pillar");
    else if (currentStep === "audience") setCurrentStep("situation");
    else if (currentStep === "platform") setCurrentStep("audience");
    else navigate("/media");
  };

  const getStepData = () => {
    switch (currentStep) {
      case "pillar":
        return { title: "Select Pillar", items: PILLARS };
      case "situation":
        return { title: "Select Situation", items: SITUATIONS };
      case "audience":
        return { title: "Select Audience", items: AUDIENCES };
      case "platform":
        return { title: "Select Platform", items: PLATFORMS };
    }
  };

  const stepData = getStepData();

  return (
    <div className="min-h-screen bg-[#FFF5ED]">
      {/* Header */}
      <div className="border-b border-[#1A1A1A]/10 bg-[#FFF5ED]">
        <div className="max-w-4xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <button
              onClick={handleBack}
              className="flex items-center gap-2 text-[#1A1A1A]/60 hover:text-[#1A1A1A] transition-colors"
              style={{ fontFamily: 'Inter, sans-serif' }}
            >
              <ChevronLeft className="w-5 h-5" />
              Back
            </button>
            <div className="text-sm text-[#1A1A1A]/40" style={{ fontFamily: 'Inter, sans-serif' }}>
              Step {["pillar", "situation", "audience", "platform"].indexOf(currentStep) + 1} of 4
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-6 py-12">
        {/* Title */}
        <div className="mb-12">
          <h1 
            className="text-5xl md:text-6xl tracking-tight text-[#1A1A1A] mb-2"
            style={{ fontFamily: 'Anton, sans-serif' }}
          >
            {stepData.title.toUpperCase()}
          </h1>
          <div className="h-1 w-16 bg-[#E63946]"></div>
        </div>

        {/* Breadcrumb */}
        <div className="mb-8 flex flex-wrap gap-2 text-sm" style={{ fontFamily: 'Inter, sans-serif' }}>
          {selections.pillar && (
            <span className="text-[#1A1A1A]/60">
              {PILLARS.find(p => p.id === selections.pillar)?.label}
            </span>
          )}
          {selections.situation && (
            <>
              <span className="text-[#1A1A1A]/40">/</span>
              <span className="text-[#1A1A1A]/60">
                {SITUATIONS.find(s => s.id === selections.situation)?.label}
              </span>
            </>
          )}
          {selections.audience && (
            <>
              <span className="text-[#1A1A1A]/40">/</span>
              <span className="text-[#1A1A1A]/60">
                {AUDIENCES.find(a => a.id === selections.audience)?.label}
              </span>
            </>
          )}
        </div>

        {/* Selection Grid */}
        <div className="grid gap-4">
          {stepData.items.map((item) => (
            <button
              key={item.id}
              onClick={() => handleSelect(currentStep, item.id)}
              className="group w-full p-6 bg-white border-2 border-[#1A1A1A]/10 hover:border-[#E63946] transition-all text-left"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div 
                    className="text-xl font-bold text-[#1A1A1A] mb-1 group-hover:text-[#E63946] transition-colors"
                    style={{ fontFamily: 'Inter, sans-serif' }}
                  >
                    {item.label}
                  </div>
                  <div 
                    className="text-sm text-[#1A1A1A]/60"
                    style={{ fontFamily: 'Inter, sans-serif' }}
                  >
                    {item.description}
                  </div>
                </div>
                <div className="w-6 h-6 border-2 border-[#1A1A1A]/20 group-hover:border-[#E63946] rounded-full flex items-center justify-center transition-colors">
                  <div className="w-3 h-3 bg-[#E63946] rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></div>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Footer Note */}
        <div className="mt-12 pt-8 border-t border-[#1A1A1A]/10">
          <p className="text-sm text-[#1A1A1A]/40" style={{ fontFamily: 'Inter, sans-serif' }}>
            No blank states. Only trained responses.
          </p>
        </div>
      </div>
    </div>
  );
}
