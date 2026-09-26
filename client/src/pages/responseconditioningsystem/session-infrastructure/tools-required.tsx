import { useNavigate } from "react-router-dom";
import { ArrowLeft, Laptop, Smartphone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const compulsoryTools = [
  "Smartphone",
  "Mini ring light",
  "Earphones or headset",
];

const requiredWorkspace = [
  {
    title: "Laptop or computer",
    body: "Runs the Response Integrity drill and records observations while the phone stays on the live student call.",
  },
  {
    title: "Stable hands-free phone position",
    body: "A gooseneck holder is the standard reference. Any equivalent setup must keep the phone stable, leave the cameras and ring light unobstructed, and support both required orientations.",
  },
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
  "The smartphone is the live session camera and display. Its orientation changes with the active drill condition.",
  "The mini ring light protects visibility. In Modelling it lights the Specialist's work; in Observation it supports a clear live interaction view.",
  "Earphones or a headset keep two-way audio clear enough for instructions and student responses to be observed reliably.",
  "The laptop or computer is the Response Integrity operating surface for running the drill and logging concrete observations as they happen.",
];

const setupPrinciples = [
  "Response Integrity uses the same phone across two distinct camera modes rather than one permanent teaching angle.",
  "Clarity Modelling is Specialist-led demonstration: the camera and light face the work so the student can see the method being executed.",
  "After Clarity, the phone moves to Observation mode: the student executes while the Specialist observes the response and logs evidence on the laptop.",
  "Camera position is part of the drill condition. It is not a cosmetic preference.",
];

const deliveryModes = [
  {
    title: "Modelling",
    camera: "Camera and light facing work",
    used: "Used in Clarity phase Modelling set to show and explain.",
    description:
      "The Specialist positions the smartphone on a stable holder and teaches from a top-down view. The rear camera and attached ring light face the notebook and hands while the Specialist demonstrates execution and explains the method live.",
    bullets: [
      "Easy for students to follow because it mirrors the learner's point of view.",
      "The student sees the work from the same perspective they would have if they were physically sitting with the Specialist.",
      "Fast and efficient for live problem-solving without a digital whiteboard.",
      "Builds a stronger student-Specialist connection through visible, practical work.",
    ],
  },
  {
    title: "Observation",
    camera: "Camera in selfie mode",
    used: "Used in all phases after Clarity to observe the student and log observations.",
    description:
      "The Specialist positions the smartphone vertically in selfie mode and keeps the student visible during the live session. The phone maintains the student-Specialist connection while the laptop is used to run the drill and record the student's observable responses as they happen.",
    bullets: [
      "Keeps the Specialist's attention on how the student responds, not on demonstrating the work.",
      "Allows concrete behaviours to be captured during each rep without interrupting execution.",
      "Helps preserve clean evidence by separating student interaction on the phone from observation logging on the laptop.",
      "Supports conditioning by letting the student execute while the Specialist observes, records, and intervenes only when the drill requires it.",
    ],
  },
];

const preflightChecks = [
  "Confirm the current drill condition before positioning the phone.",
  "For Modelling, confirm the rear camera and ring light both face the notebook and hands, the full working area is visible, and neither the holder nor the light blocks the camera.",
  "For Observation, confirm the phone is vertical in selfie mode, the live student remains visible and audible on the phone, and the Specialist can stay present without demonstrating the work.",
  "Open the Response Integrity drill on the laptop or computer and make sure observation fields are ready before the first rep.",
  "Confirm two-way audio, phone stability, lighting, focus, and required written materials before evidence collection begins.",
];

const gooseneckBenefits = [
  "Keeps the phone hands-free and stable for the whole session.",
  "Makes the switch between downward Modelling and upright Observation deliberate and repeatable.",
  "Reduces arm fatigue and prevents the Specialist from holding the camera while also writing or logging.",
  "Can preserve the required angle without blocking the phone cameras or the attached mini ring light.",
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
              Response Integrity uses one live student call across two camera modes. The tools are simple,
              but the Specialist must be able to control visibility, audio, phone position, and live
              observation logging without improvising during a rep.
            </p>
          </div>

          <div className="grid sm:grid-cols-3 gap-3">
            {compulsoryTools.map((tool) => (
              <div key={tool} className="rounded-xl border bg-card p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Compulsory delivery kit</p>
                <p className="mt-2 text-lg font-semibold">{tool}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {requiredWorkspace.map((item) => (
              <div key={item.title} className="rounded-xl border bg-muted/20 p-4">
                <div className="flex items-center gap-2">
                  <Laptop className="w-4 h-4 text-primary" />
                  <p className="font-semibold">{item.title}</p>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{item.body}</p>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5 space-y-3">
            <h3 className="text-xl font-semibold">Non-negotiable standard</h3>
            <p className="font-medium">
              Smartphone + mini ring light + earphones or headset are compulsory. The Specialist must also
              have the Response Integrity platform open on a laptop or computer and a stable phone position
              that can support the active camera mode.
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
                  className={"overflow-hidden rounded-2xl border bg-muted/20 shadow-sm " + image.className}
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
              These references show the physical kit. The phone is not kept in one fixed angle for every
              drill. The active RI condition decides the camera orientation.
            </p>
          </div>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">Why this setup exists</h2>
          <p className="text-muted-foreground">
            Response Integrity separates Specialist demonstration from student execution. The same simple
            physical stack supports both, but the camera must be positioned for the condition the student
            is actually in.
          </p>
          <ul className="space-y-1 pl-5 list-disc text-muted-foreground">
            {setupPrinciples.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </Card>

        <Card className="p-6 space-y-5">
          <div className="space-y-2">
            <h2 className="text-2xl font-bold">The two operating modes</h2>
            <p className="text-muted-foreground">
              The distinction is functional. Modelling lets the student watch the Specialist execute.
              Observation lets the student execute while the Specialist watches the response.
            </p>
          </div>

          <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
            <img
              src="/images/responseconditioning/tools-required/modelling-vs-observation-locked.webp"
              alt="Response Integrity locked reference showing Modelling with the camera and light facing work, and Observation with the camera in selfie mode"
              className="w-full h-auto object-contain"
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {deliveryModes.map((mode) => (
              <div key={mode.title} className="rounded-2xl border bg-card p-5 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Smartphone className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm uppercase tracking-wide text-muted-foreground">{mode.title}</p>
                    <h3 className="text-xl font-semibold">{mode.camera}</h3>
                  </div>
                </div>
                <p className="font-medium">{mode.used}</p>
                <p className="text-sm text-muted-foreground">{mode.description}</p>
                <ul className="space-y-1 pl-5 list-disc text-sm text-muted-foreground">
                  {mode.bullets.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
            <p className="text-sm uppercase tracking-wide text-muted-foreground">Operational distinction</p>
            <p className="mt-1 font-semibold">
              Modelling: watch me execute. Observation: you execute; I observe the response.
            </p>
          </div>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">Pre-session mode check</h2>
          <p className="text-muted-foreground">
            The Specialist verifies the condition before the first rep. A technically connected call is not
            enough if the wrong thing is visible or the logging surface is not ready.
          </p>
          <ul className="space-y-1 pl-5 list-disc text-muted-foreground">
            {preflightChecks.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <div className="rounded-xl border bg-muted/30 p-4">
            <p className="font-semibold">If the condition becomes unobservable, stop.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Restore the required camera, lighting, audio, or logging condition before treating another rep
              as usable evidence. Do not infer missing behaviour and do not reconstruct observations later.
            </p>
          </div>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="text-2xl font-bold">The Gooseneck Phone Holder</h2>
          <p className="font-medium">Standard reference, not brand locked.</p>
          <p className="text-muted-foreground">
            A gooseneck holder is the recommended reference because it keeps the phone hands-free and makes
            both RI orientations repeatable. The named product is not the requirement. Any equivalent setup
            must preserve the same stability and must not block the camera or ring light.
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
              Choose an accessible holder or equivalent stable setup that can keep the phone in portrait
              orientation, pitch the phone and attached ring light down toward the work for Modelling, return
              the phone upright for Observation, and leave the phone cameras unobstructed.
            </p>
          </div>
        </Card>

        <Card className="p-6 border-l-4 border-l-primary space-y-4">
          <h2 className="text-2xl font-bold">What Response Integrity is optimizing for</h2>
          <p className="text-muted-foreground">
            The purpose is not to look technical. The purpose is to preserve the correct live condition with
            the least possible friction.
          </p>
          <p className="font-semibold">
            In Clarity Modelling, the student must be able to see the Specialist's real execution clearly.
            After Clarity, the student must be the one executing while the Specialist stays connected,
            observes concrete behaviour, and records it on the Response Integrity platform.
          </p>
        </Card>
      </div>
    </div>
  );
}
