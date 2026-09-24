import { useNavigate } from "react-router-dom";
import { ArrowLeft, Smartphone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const compulsoryTools = [
  "Smartphone",
  "Mini ring light",
  "Earphones",
];

const kitImages = [
  {
    src: "/images/responseconditioning/tools-required/kit-01.jpg",
    alt: "Smartphone and mini ring light laid out together",
    className: "sm:col-span-2 sm:row-span-2",
  },
  {
    src: "/images/responseconditioning/tools-required/kit-02.webp",
    alt: "Specialist setup component close-up",
    className: "",
  },
  {
    src: "/images/responseconditioning/tools-required/kit-03.webp",
    alt: "Mini ring light and accessory detail",
    className: "",
  },
  {
    src: "/images/responseconditioning/tools-required/kit-04.webp",
    alt: "Additional Specialist equipment view",
    className: "",
  },
];

const whyTheyMatter = [
  "Lighting quality must stay clear enough for the student to see the page properly.",
  "The ring light reduces pen-in-hand shadows that interfere with visibility.",
  "The smartphone camera is the main delivery tool for the top-down teaching view.",
  "Earphones help keep Specialist audio clear and reduce distraction during live explanation.",
];

const gooseneckBenefits = [
  "Prevents arm fatigue from holding the phone for the whole session.",
  "Creates a stable top-down camera angle.",
  "Makes the teaching setup more flexible and easier to repeat every session.",
  "Supports the hands-on Response Integrity method without adding complicated software.",
];

const methodAdvantages = [
  "Easy for students to follow because it mirrors the learner's point of view.",
  "No expensive software or specialist gadgets are required.",
  "Fast and efficient for live problem-solving.",
  "Builds a stronger student-Specialist connection through visible, practical work.",
];

const setupPrinciples = [
  "Response Integrity does not rely on digital whiteboards as the main teaching environment.",
  "The Specialist uses a phone camera to show real written work from above.",
  "The student watches the solving process as if sitting beside the Specialist.",
  "The setup should reduce friction, not add technical overhead.",
];

export default function ResponseConditioningToolsRequired() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
          <Button
            variant="ghost"
            className="mb-4 -ml-2"
            onClick={() => navigate("/responseconditioningsystem")}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Response Conditioning System
          </Button>

          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Smartphone className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-sm uppercase tracking-wide text-muted-foreground font-medium">
                Response Integrity-OS Deep Dive
              </p>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight mt-1">
                Tools Required
              </h1>
              <p className="text-muted-foreground mt-1">under Session Infrastructure</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-8">
        <Card className="p-6 md:p-8 border-2 border-primary/20 space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="bg-primary/10 text-primary hover:bg-primary/10">Session Setup</Badge>
            <Badge variant="outline">Specialist equipment</Badge>
            <Badge variant="outline">Execution standard</Badge>
          </div>

          <div className="space-y-3">
            <h2 className="text-2xl font-bold">What the Specialist must have</h2>
            <p className="text-muted-foreground">
              Response Integrity uses a practical top-down teaching setup. The tools are simple, but they are not
              optional if the Specialist wants a clean session environment.
            </p>
          </div>

          <div className="grid sm:grid-cols-3 gap-3">
            {compulsoryTools.map((tool) => (
              <div key={tool} className="rounded-xl border bg-card p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Compulsory</p>
                <p className="mt-2 text-lg font-semibold">{tool}</p>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5 space-y-3">
            <h3 className="text-xl font-semibold">Non-negotiable standard</h3>
            <p className="font-medium">
              Smartphone + mini ring light + earphones are compulsory.
            </p>
            <ul className="space-y-1 pl-5 list-disc text-muted-foreground">
              {whyTheyMatter.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>

          <div className="space-y-3">
            <p className="text-sm uppercase tracking-wide text-muted-foreground font-medium">
              Actual setup reference
            </p>
            <div className="grid gap-4 sm:grid-cols-4 auto-rows-[150px] sm:auto-rows-[120px]">
              {kitImages.map((image) => (
                <div
                  key={image.src}
                  className={`overflow-hidden rounded-2xl border bg-muted/20 shadow-sm ${image.className}`}
                >
                  <img
                    src={image.src}
                    alt={image.alt}
                    className="h-full w-full object-cover"
                  />
                </div>
              ))}
            </div>
            <p className="text-sm text-muted-foreground">
              The compulsory-kit visuals are shown in a clean grid to keep the setup references easy
              to scan.
            </p>
          </div>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">Why this setup exists</h2>
          <p className="text-muted-foreground">
            Response Integrity is designed around visible handwritten work, not around complex screen-sharing
            workflows. The setup exists to make the page clear, the method visible, and the session
            easy to follow.
          </p>
          <ul className="space-y-1 pl-5 list-disc text-muted-foreground">
            {setupPrinciples.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">The Gooseneck Phone Holder</h2>
          <p className="font-medium">Optional, but highly recommended.</p>
          <p className="text-muted-foreground">
            It is not compulsory, but it solves a real operational problem: Specialists should not spend
            the whole session holding the camera by hand.
          </p>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
              <img
                src="/images/responseconditioning/tools-required/gooseneck-demo.webp"
                alt="Gooseneck phone holder used for overhead recording"
                className="h-full w-full object-cover"
              />
            </div>
            <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
              <img
                src="/images/responseconditioning/tools-required/gooseneck-product.webp"
                alt="Gooseneck phone holder product reference"
                className="h-full w-full object-cover"
              />
            </div>
          </div>
          <ul className="space-y-1 pl-5 list-disc text-muted-foreground">
            {gooseneckBenefits.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <div className="rounded-xl border bg-muted/30 p-4 space-y-2">
            <p className="text-sm uppercase tracking-wide text-muted-foreground">Procurement boundary</p>
            <p className="text-sm text-muted-foreground">
              Choose an accessible gooseneck holder that keeps the phone stable, supports the required overhead angle, and does not obstruct the working area. The holder is optional; the compulsory delivery kit remains smartphone, mini ring light, and earphones.
            </p>
          </div>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">How the method works in practice</h2>
          <p className="text-muted-foreground">
            The Specialist positions the smartphone on a gooseneck holder and teaches from a top-down
            view. That makes the student see the work from the same perspective they would have if
            they were physically sitting with the Specialist.
          </p>
          <ul className="space-y-1 pl-5 list-disc text-muted-foreground">
            {methodAdvantages.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </Card>

        <Card className="p-6 border-l-4 border-l-primary space-y-4">
          <h2 className="text-2xl font-bold">What Response Integrity is optimizing for</h2>
          <p className="text-muted-foreground">
            Unlike traditional online tutoring that depends on digital whiteboards and multiple
            software layers, Response Integrity uses a simpler physical teaching stack.
          </p>
          <p className="font-semibold">
            The purpose is not to look technical. The purpose is to make the student's view clear,
            stable, and easy to follow while the Specialist demonstrates real mathematical execution.
          </p>
        </Card>
      </div>
    </div>
  );
}
