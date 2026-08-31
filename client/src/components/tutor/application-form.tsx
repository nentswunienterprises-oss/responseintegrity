import { useState, useEffect, useRef } from "react";
import { useForm, useWatch } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2 } from "lucide-react";

const ageSchema = z
  .string()
  .trim()
  .min(1, "Age is required")
  .regex(/^\d+$/, "Age must be a number")
  .refine((value) => {
    const age = Number(value);
    return Number.isInteger(age) && age >= 16 && age <= 100;
  }, "Age must be between 16 and 100");

// Per-section schemas for step validation
const sectionSchemas = [
  z.object({ // Section 1
    fullName: z.string().min(2, "Full name is required"),
    age: ageSchema,
    phone: z.string().min(10, "Valid phone number required"),
    email: z.string().email(),
    city: z.string().min(2, "City/Area is required"),
  }),
  z.object({ // Section 2
    completedMatric: z.enum(["yes", "currently", "no"]),
    matricYear: z.string().optional(),
    mathLevel: z.enum(["core", "literacy"]),
    mathResult: z.string().optional(),
    otherSubjects: z.string().optional(),
  }),
  z.object({ // Section 3
    currentSituation: z.enum(["gap_year", "waiting_uni", "studying", "working", "other"]),
    currentSituationOther: z.string().optional(),
    interestReason: z.string().min(10, "Please share your reason"),
  }),
  z.object({ // Section 4
    helpedBefore: z.enum(["yes", "no"]),
    helpExplanation: z.string().optional(),
    studentDontGet: z.string().min(10, "Please share your approach"),
  }),
  z.object({ // Section 5
    pressureStory: z.string().min(10, "Please share your story"),
    pressureResponse: z.array(z.enum(["rush", "freeze", "second_guess", "calm", "depends"])),
    panicCause: z.string().min(10, "Please share your thoughts"),
  }),
  z.object({ // Section 6
    disciplineReason: z.string().min(10, "Please share your reason"),
    repeatMistakeResponse: z.string().min(10, "Please share your response"),
  }),
  z.object({ // Section 7
    ttMeaning: z.string().min(10, "Please share your interpretation"),
    structurePreference: z.enum(["structure", "flexibility"]),
  }),
  z.object({ // Section 8
    hoursPerWeek: z.string().min(1, "Please specify hours"),
    availableAfternoon: z.enum(["yes", "no", "sometimes"]),
  }),
  z.object({ // Section 9
    finalReason: z.string().min(10, "Please share your reason"),
  }),
  z.object({ // Section 10
    commitment: z.enum(["yes", "no"]),
  }),
];

// Full schema for submit
const applicationSchema = z.object({
  fullName: z.string().min(2, "Full name is required"),
  age: ageSchema,
  phone: z.string().min(10, "Valid phone number required"),
  email: z.string().email(),
  city: z.string().min(2, "City/Area is required"),
  completedMatric: z.enum(["yes", "currently", "no"]),
  matricYear: z.string().optional(),
  mathLevel: z.enum(["core", "literacy"]),
  mathResult: z.string().optional(),
  otherSubjects: z.string().optional(),
  currentSituation: z.enum(["gap_year", "waiting_uni", "studying", "working", "other"]),
  currentSituationOther: z.string().optional(),
  interestReason: z.string().min(10, "Please share your reason"),
  helpedBefore: z.enum(["yes", "no"]),
  helpExplanation: z.string().optional(),
  studentDontGet: z.string().min(10, "Please share your approach"),
  pressureStory: z.string().min(10, "Please share your story"),
  pressureResponse: z.array(z.enum(["rush", "freeze", "second_guess", "calm", "depends"])),
  panicCause: z.string().min(10, "Please share your thoughts"),
  disciplineReason: z.string().min(10, "Please share your reason"),
  repeatMistakeResponse: z.string().min(10, "Please share your response"),
  ttMeaning: z.string().min(10, "Please share your interpretation"),
  structurePreference: z.enum(["structure", "flexibility"]),
  hoursPerWeek: z.string().min(1, "Please specify hours"),
  availableAfternoon: z.enum(["yes", "no", "sometimes"]),
  finalReason: z.string().min(10, "Please share your reason"),
  commitment: z.enum(["yes", "no"]),
});

type ApplicationFormData = {
  fullName: string;
  age: string;
  phone: string;
  email: string;
  city: string;
  completedMatric: "yes" | "currently" | "no";
  matricYear?: string;
  mathLevel: "core" | "literacy";
  mathResult?: string;
  otherSubjects?: string;
  currentSituation: "gap_year" | "waiting_uni" | "studying" | "working" | "other";
  currentSituationOther?: string;
  interestReason: string;
  helpedBefore: "yes" | "no";
  helpExplanation?: string;
  studentDontGet: string;
  pressureStory: string;
  pressureResponse: Array<"rush" | "freeze" | "second_guess" | "calm" | "depends">;
  panicCause: string;
  disciplineReason: string;
  repeatMistakeResponse: string;
  ttMeaning: string;
  structurePreference: "structure" | "flexibility";
  hoursPerWeek: string;
  availableAfternoon: "yes" | "no" | "sometimes";
  finalReason: string;
  commitment: "yes" | "no";
};

type ApplicationFormProps = {
  onSuccess?: () => void;
  onCancel?: () => void;
};

const stepFieldNames: Record<number, Array<keyof ApplicationFormData>> = {
  1: ["fullName", "age", "phone", "email", "city"],
  2: ["completedMatric", "matricYear", "mathLevel", "mathResult", "otherSubjects"],
  3: ["currentSituation", "currentSituationOther", "interestReason"],
  4: ["helpedBefore", "helpExplanation", "studentDontGet"],
  5: ["pressureStory", "pressureResponse", "panicCause"],
  6: ["disciplineReason", "repeatMistakeResponse"],
  7: ["ttMeaning", "structurePreference"],
  8: ["hoursPerWeek", "availableAfternoon"],
  9: ["finalReason"],
  10: ["commitment"],
};

export function ApplicationForm({ onSuccess, onCancel }: ApplicationFormProps) {
  const STORAGE_KEY = "tt_application_draft";
  const AUTOSAVE_DELAY_MS = 400;
  const [showResumePrompt, setShowResumePrompt] = useState(false);
  const [resumeDraft, setResumeDraft] = useState<string | null>(null);
  const progressRef = useRef<HTMLDivElement | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const submitAbortRef = useRef<AbortController | null>(null);
  const submitIntentRef = useRef(false);
  const isMountedRef = useRef(true);
  const totalSteps = 10;
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const form = useForm<ApplicationFormData>({
    resolver: zodResolver(applicationSchema),
    defaultValues: {
      fullName: "",
      age: "",
      phone: "",
      email: "",
      city: "",
      completedMatric: "yes",
      matricYear: "",
      mathLevel: "core",
      mathResult: "",
      otherSubjects: "",
      currentSituation: "gap_year",
      currentSituationOther: "",
      interestReason: "",
      helpedBefore: "no",
      helpExplanation: "",
      studentDontGet: "",
      pressureStory: "",
      pressureResponse: [],
      panicCause: "",
      disciplineReason: "",
      repeatMistakeResponse: "",
      ttMeaning: "",
      structurePreference: "structure",
      hoursPerWeek: "",
      availableAfternoon: "yes",
      finalReason: "",
      commitment: "yes",
    },
  });
  const completedMatric = useWatch({ control: form.control, name: "completedMatric" });
  const mathLevel = useWatch({ control: form.control, name: "mathLevel" });
  const currentSituation = useWatch({ control: form.control, name: "currentSituation" });
  const helpedBefore = useWatch({ control: form.control, name: "helpedBefore" });
  const pressureResponse = useWatch({ control: form.control, name: "pressureResponse" });
  const structurePreference = useWatch({ control: form.control, name: "structurePreference" });
  const availableAfternoon = useWatch({ control: form.control, name: "availableAfternoon" });
  const commitment = useWatch({ control: form.control, name: "commitment" });
  const watchedCurrentStepFields = useWatch({
    control: form.control,
    name: stepFieldNames[currentStep] as any,
  });
  // Autofill email if available
  useEffect(() => {
    if (typeof window !== "undefined" && window.localStorage) {
      const email = window.localStorage.getItem("user_email");
      if (email && !form.getValues("email")) {
        form.setValue("email", email);
      }
    }
  }, []);

  // Resume draft prompt
  useEffect(() => {
    if (typeof window !== "undefined" && window.localStorage) {
      const draft = window.localStorage.getItem(STORAGE_KEY);
      if (draft) {
        setResumeDraft(draft);
        setShowResumePrompt(true);
      }
    }
  }, []);

  // Restore form data if user accepts resume
  const handleResumeDraft = () => {
    if (resumeDraft) {
      try {
        const parsed = JSON.parse(resumeDraft);
        const safeDraft = applicationSchema.partial().safeParse(parsed);
        if (safeDraft.success) {
          form.reset({ ...form.getValues(), ...safeDraft.data });
        } else if (typeof window !== "undefined" && window.localStorage) {
          window.localStorage.removeItem(STORAGE_KEY);
        }
      } catch {
        if (typeof window !== "undefined" && window.localStorage) {
          window.localStorage.removeItem(STORAGE_KEY);
        }
      }
    }
    setShowResumePrompt(false);
  };
  const handleDiscardDraft = () => {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.removeItem(STORAGE_KEY);
    }
    setShowResumePrompt(false);
  };

  // Save form data on change
  useEffect(() => {
    const subscription = form.watch((values) => {
      if (typeof window !== "undefined" && window.localStorage) {
        if (saveTimeoutRef.current) {
          clearTimeout(saveTimeoutRef.current);
        }
        saveTimeoutRef.current = setTimeout(() => {
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(values));
        }, AUTOSAVE_DELAY_MS);
      }
    });
    return () => {
      subscription.unsubscribe();
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
    };
  }, [form]);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      if (submitAbortRef.current) {
        submitAbortRef.current.abort();
      }
    };
  }, []);

  // Accessibility: focus first input on step change
  useEffect(() => {
    if (progressRef.current) {
      const input = progressRef.current.querySelector("input,textarea,select") as HTMLElement | null;
      if (input) input.focus();
    }
  }, [currentStep]);

  const onSubmit = async (data: ApplicationFormData) => {
    if (!submitIntentRef.current) {
      return;
    }
    setSubmitError(null);
    setIsSubmitting(true);
    submitAbortRef.current?.abort();
    const controller = new AbortController();
    submitAbortRef.current = controller;

    try {
      const parsedAge = Number(data.age);
      if (!Number.isInteger(parsedAge)) {
        throw new Error("Age must be a valid whole number.");
      }

      await apiRequest("POST", "/api/tutor/application", { ...data, age: parsedAge });

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/tutor/applications"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/tutor/application-status"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/tutor/gateway-session"] }),
      ]);

      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.removeItem(STORAGE_KEY);
      }
      onSuccess && onSuccess();
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
      const message = error instanceof Error ? error.message : "Something went wrong while submitting. Please try again.";
      setSubmitError(message);
    } finally {
      submitIntentRef.current = false;
      if (isMountedRef.current) {
        setIsSubmitting(false);
      }
    }
  };

  const togglePressureResponse = (option: ApplicationFormData["pressureResponse"][number], checked: boolean) => {
    const arr = form.getValues("pressureResponse") || [];
    if (checked) {
      form.setValue("pressureResponse", Array.from(new Set([...arr, option])));
      return;
    }
    form.setValue("pressureResponse", arr.filter((v) => v !== option));
  };

  // Per-section validation
  const isSectionValid = () => {
    // Re-run validation whenever active-step fields change.
    void watchedCurrentStepFields;
    const values = form.getValues();
    const schema = sectionSchemas[currentStep - 1];
    const result = schema.safeParse(values);
    // Special logic for conditional fields:
    if (currentStep === 2) {
      if (values.completedMatric === "yes") {
        if (!values.matricYear || !values.mathResult) return false;
      }
    }
    if (currentStep === 3) {
      if (values.currentSituation === "other" && !values.currentSituationOther) return false;
    }
    if (currentStep === 4) {
      if (values.helpedBefore === "yes" && !values.helpExplanation) return false;
    }
    if (currentStep === 5) {
      // Require at least one checkbox in pressureResponse
      if (!values.pressureStory || values.pressureStory.length < 10) return false;
      if (!values.panicCause || values.panicCause.length < 10) return false;
      if (!Array.isArray(values.pressureResponse) || values.pressureResponse.length === 0) return false;
    }
    if (currentStep === 6) {
      if (!values.disciplineReason || values.disciplineReason.length < 10) return false;
      if (!values.repeatMistakeResponse || values.repeatMistakeResponse.length < 10) return false;
    }
    return result.success;
  };

  const nextStep = () => setCurrentStep((s) => Math.min(s + 1, totalSteps));
  const prevStep = () => setCurrentStep((s) => Math.max(s - 1, 1));

  // Render sections according to user copy
  return (
    <div className="max-w-2xl mx-auto">
      {/* Resume draft prompt */}
      {showResumePrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-sm w-full text-center">
            <div className="mb-4 font-semibold">Resume previous application?</div>
            <div className="mb-6 text-sm text-gray-600">You have a saved draft. Would you like to continue where you left off?</div>
            <div className="flex gap-4 justify-center">
              <Button onClick={handleResumeDraft} aria-label="Resume previous application">Resume</Button>
              <Button variant="outline" onClick={handleDiscardDraft} aria-label="Discard draft">Discard</Button>
            </div>
          </div>
        </div>
      )}
      {/* Progress bar */}
      <div className="w-full h-2 bg-gray-200 rounded-full my-4" aria-label="Progress bar">
        <div
          className="h-2 bg-red-500 rounded-full transition-all"
          style={{ width: `${(currentStep / totalSteps) * 100}%` }}
          aria-valuenow={currentStep}
          aria-valuemax={totalSteps}
        />
      </div>
      <form onSubmit={form.handleSubmit(onSubmit)} aria-label="Application form" autoComplete="on">
        {submitError && (
          <div className="mb-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
            {submitError}
          </div>
        )}
        {currentStep === 1 && (
          <Card>
            <CardHeader>
              <CardTitle>Section 1 - Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Label htmlFor="fullName">Full Name</Label>
              <Input id="fullName" {...form.register("fullName")} />
              <Label htmlFor="age">Age</Label>
              <Input id="age" type="number" min={16} max={100} inputMode="numeric" {...form.register("age")} />
              <Label htmlFor="phone">Phone Number (WhatsApp preferred)</Label>
              <Input id="phone" {...form.register("phone")} />
              <Label htmlFor="email">Email Address</Label>
              <Input id="email" {...form.register("email")} />
              <Label htmlFor="city">City/Area</Label>
              <Input id="city" {...form.register("city")} />
            </CardContent>
          </Card>
        )}
        {currentStep === 2 && (
          <Card ref={progressRef}>
            <CardHeader>
              <CardTitle>Section 2 - Academic Background</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Label>Did you complete matric?</Label>
              <RadioGroup
                value={completedMatric}
                onValueChange={(v) => form.setValue("completedMatric", v as ApplicationFormData["completedMatric"])}
              >
                <div className="flex flex-col gap-2 mt-2">
                  <div className="flex items-center gap-2 bg-gray-50 rounded px-3 py-2 border border-gray-200">
                    <RadioGroupItem value="yes" id="matric_yes" />
                    <Label htmlFor="matric_yes" className="font-medium">Yes</Label>
                  </div>
                  <div className="flex items-center gap-2 bg-gray-50 rounded px-3 py-2 border border-gray-200">
                    <RadioGroupItem value="currently" id="matric_currently" />
                    <Label htmlFor="matric_currently" className="font-medium">Currently completing</Label>
                  </div>
                  <div className="flex items-center gap-2 bg-gray-50 rounded px-3 py-2 border border-gray-200">
                    <RadioGroupItem value="no" id="matric_no" />
                    <Label htmlFor="matric_no" className="font-medium">No</Label>
                  </div>
                </div>
              </RadioGroup>
              <div style={{ height: 16 }} />
              <Label>Mathematics Level</Label>
              <RadioGroup
                value={mathLevel}
                onValueChange={(v) => form.setValue("mathLevel", v as ApplicationFormData["mathLevel"])}
              >
                <div className="flex flex-col gap-2 mt-2">
                  <div className="flex items-center gap-2 bg-gray-50 rounded px-3 py-2 border border-gray-200">
                    <RadioGroupItem value="core" id="math_core" />
                    <Label htmlFor="math_core" className="font-medium">Pure Mathematics</Label>
                  </div>
                  <div className="flex items-center gap-2 bg-gray-50 rounded px-3 py-2 border border-gray-200">
                    <RadioGroupItem value="literacy" id="math_lit" />
                    <Label htmlFor="math_lit" className="font-medium">Mathematical Literacy</Label>
                  </div>
                </div>
              </RadioGroup>
              {(completedMatric === "yes" || completedMatric === "currently") && (
                <>
                  <Label htmlFor="matricYear">Year of matric completion</Label>
                  <Input
                    id="matricYear"
                    {...form.register("matricYear")}
                    disabled={completedMatric === "currently"}
                    placeholder={completedMatric === "currently" ? "Not applicable" : ""}
                  />
                  <Label htmlFor="mathResult">Final Mathematics Result (%)</Label>
                  <Input id="mathResult" {...form.register("mathResult")} />
                </>
              )}
              <Label htmlFor="otherSubjects">Other strong subjects (if any)</Label>
              <Input id="otherSubjects" {...form.register("otherSubjects")} />
            </CardContent>
          </Card>
        )}
        {currentStep === 3 && (
          <Card ref={progressRef}>
            <CardHeader>
              <CardTitle>Section 3 - Current Situation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Label>What are you currently doing?</Label>
              <RadioGroup
                value={currentSituation}
                onValueChange={(v) => form.setValue("currentSituation", v as ApplicationFormData["currentSituation"])}
              >
                <div className="flex flex-col gap-2 mt-2">
                  <div className="flex items-center gap-2 bg-gray-50 rounded px-3 py-2 border border-gray-200">
                    <RadioGroupItem value="gap_year" id="gap_year" />
                    <Label htmlFor="gap_year" className="font-medium">Gap year</Label>
                  </div>
                  <div className="flex items-center gap-2 bg-gray-50 rounded px-3 py-2 border border-gray-200">
                    <RadioGroupItem value="waiting_uni" id="waiting_uni" />
                    <Label htmlFor="waiting_uni" className="font-medium">Waiting for university</Label>
                  </div>
                  <div className="flex items-center gap-2 bg-gray-50 rounded px-3 py-2 border border-gray-200">
                    <RadioGroupItem value="studying" id="studying" />
                    <Label htmlFor="studying" className="font-medium">Studying part-time</Label>
                  </div>
                  <div className="flex items-center gap-2 bg-gray-50 rounded px-3 py-2 border border-gray-200">
                    <RadioGroupItem value="working" id="working" />
                    <Label htmlFor="working" className="font-medium">Working</Label>
                  </div>
                  <div className="flex items-center gap-2 bg-gray-50 rounded px-3 py-2 border border-gray-200">
                    <RadioGroupItem value="other" id="other" />
                    <Label htmlFor="other" className="font-medium">Other</Label>
                  </div>
                </div>
              </RadioGroup>
              {currentSituation === "other" && (
                <Input id="currentSituationOther" placeholder="Other: ______" {...form.register("currentSituationOther")} />
              )}
              <Label htmlFor="interestReason">Why are you interested in this opportunity?</Label>
              <Textarea id="interestReason" {...form.register("interestReason")} />
            </CardContent>
          </Card>
        )}
        {currentStep === 4 && (
          <Card>
            <CardHeader>
              <CardTitle>Section 4 - Teaching & Communication</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Label>Have you ever helped someone understand schoolwork before?</Label>
              <RadioGroup
                value={helpedBefore}
                onValueChange={(v) => form.setValue("helpedBefore", v as ApplicationFormData["helpedBefore"])}
              >
                <div className="flex flex-col gap-2 mt-2">
                  <div className="flex items-center gap-2 bg-gray-50 rounded px-3 py-2 border border-gray-200">
                    <RadioGroupItem value="yes" id="helped_yes" />
                    <Label htmlFor="helped_yes" className="font-medium">Yes</Label>
                  </div>
                  <div className="flex items-center gap-2 bg-gray-50 rounded px-3 py-2 border border-gray-200">
                    <RadioGroupItem value="no" id="helped_no" />
                    <Label htmlFor="helped_no" className="font-medium">No</Label>
                  </div>
                </div>
              </RadioGroup>
              {helpedBefore === "yes" && (
                <Textarea id="helpExplanation" placeholder="If yes, briefly explain the situation." {...form.register("helpExplanation")} />
              )}
              <Label htmlFor="studentDontGet">A student says: “I don’t get this at all.” What would you do first?</Label>
              <Textarea id="studentDontGet" {...form.register("studentDontGet")} />
            </CardContent>
          </Card>
        )}
        {currentStep === 5 && (
          <Card>
            <CardHeader>
              <CardTitle>Section 5 - Response Under Pressure</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Label htmlFor="pressureStory">Think about a time you struggled with a difficult question in a test. What happened in your mind?</Label>
              <Textarea id="pressureStory" {...form.register("pressureStory")} />
              <Label>When work becomes difficult, which of these do you relate to most? (Select all that apply)</Label>
              <div className="space-y-2">
                <Checkbox checked={pressureResponse?.includes("rush")} onCheckedChange={checked => {
                  togglePressureResponse("rush", Boolean(checked));
                }} /> <Label>I rush to finish quickly</Label><br />
                <Checkbox checked={pressureResponse?.includes("freeze")} onCheckedChange={checked => {
                  togglePressureResponse("freeze", Boolean(checked));
                }} /> <Label>I freeze and don’t know where to start</Label><br />
                <Checkbox checked={pressureResponse?.includes("second_guess")} onCheckedChange={checked => {
                  togglePressureResponse("second_guess", Boolean(checked));
                }} /> <Label>I second-guess myself</Label><br />
                <Checkbox checked={pressureResponse?.includes("calm")} onCheckedChange={checked => {
                  togglePressureResponse("calm", Boolean(checked));
                }} /> <Label>I stay calm and work step-by-step</Label><br />
                <Checkbox checked={pressureResponse?.includes("depends")} onCheckedChange={checked => {
                  togglePressureResponse("depends", Boolean(checked));
                }} /> <Label>It depends on the situation</Label>
              </div>
              <Label htmlFor="panicCause">What do you think causes students to panic during tests?</Label>
              <Textarea id="panicCause" {...form.register("panicCause")} />
            </CardContent>
          </Card>
        )}
        {currentStep === 6 && (
          <Card>
            <CardHeader>
              <CardTitle>Section 6 - Discipline & Responsibility</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Label htmlFor="disciplineReason">This role requires consistency, preparation, and calm behaviour under pressure. Why do you believe you can handle that responsibility?</Label>
              <Textarea id="disciplineReason" {...form.register("disciplineReason")} />
              <Label htmlFor="repeatMistakeResponse">How would you respond if a student keeps making the same mistake repeatedly?</Label>
              <Textarea id="repeatMistakeResponse" {...form.register("repeatMistakeResponse")} />
            </CardContent>
          </Card>
        )}
        {currentStep === 7 && (
          <Card>
            <CardHeader>
              <CardTitle>Section 7 - Alignment With Response Integrity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Label htmlFor="ttMeaning">Read this carefully:<br />“Most schools teach the work. Very few systems train how students respond when the work becomes difficult.”<br />What do you think this means?</Label>
              <Textarea id="ttMeaning" {...form.register("ttMeaning")} />
              <Label>Which of the following best describes you?</Label>
              <RadioGroup
                value={structurePreference}
                onValueChange={(v) => form.setValue("structurePreference", v as ApplicationFormData["structurePreference"])}
              >
                <div className="flex flex-col gap-2 mt-2">
                  <div className="flex items-center gap-2 bg-gray-50 rounded px-3 py-2 border border-gray-200">
                    <RadioGroupItem value="structure" id="structure" />
                    <Label htmlFor="structure" className="font-medium">I prefer structure and clear systems</Label>
                  </div>
                  <div className="flex items-center gap-2 bg-gray-50 rounded px-3 py-2 border border-gray-200">
                    <RadioGroupItem value="flexibility" id="flexibility" />
                    <Label htmlFor="flexibility" className="font-medium">I prefer flexibility and doing things my own way</Label>
                  </div>
                </div>
              </RadioGroup>
            </CardContent>
          </Card>
        )}
        {currentStep === 8 && (
          <Card>
            <CardHeader>
              <CardTitle>Section 8 - Availability</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Label htmlFor="hoursPerWeek">How many hours per week can you realistically commit?</Label>
              <Input id="hoursPerWeek" {...form.register("hoursPerWeek")} />
              <Label>Are you available for online sessions in the afternoon/evening?</Label>
              <RadioGroup
                value={availableAfternoon}
                onValueChange={(v) => form.setValue("availableAfternoon", v as ApplicationFormData["availableAfternoon"])}
              >
                <div className="flex flex-col gap-2 mt-2">
                  <div className="flex items-center gap-2 bg-gray-50 rounded px-3 py-2 border border-gray-200">
                    <RadioGroupItem value="yes" id="afternoon_yes" />
                    <Label htmlFor="afternoon_yes" className="font-medium">Yes</Label>
                  </div>
                  <div className="flex items-center gap-2 bg-gray-50 rounded px-3 py-2 border border-gray-200">
                    <RadioGroupItem value="no" id="afternoon_no" />
                    <Label htmlFor="afternoon_no" className="font-medium">No</Label>
                  </div>
                  <div className="flex items-center gap-2 bg-gray-50 rounded px-3 py-2 border border-gray-200">
                    <RadioGroupItem value="sometimes" id="afternoon_sometimes" />
                    <Label htmlFor="afternoon_sometimes" className="font-medium">Sometimes</Label>
                  </div>
                </div>
              </RadioGroup>
            </CardContent>
          </Card>
        )}
        {currentStep === 9 && (
          <Card>
            <CardHeader>
              <CardTitle>Section 9 - Final Filter</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Label htmlFor="finalReason">This is not a casual specialist role. It requires training, discipline, and adherence to a structured system.<br />Why should you be considered for the Founding Specialist Cohort?</Label>
              <Textarea id="finalReason" {...form.register("finalReason")} />
            </CardContent>
          </Card>
        )}
        {currentStep === 10 && (
          <Card>
            <CardHeader>
              <CardTitle>Section 10 - Commitment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Label>If selected, are you willing to:</Label>
              <ul className="pl-4 list-disc text-sm">
                <li>Complete structured Response Integrity training before tutoring</li>
                <li>Follow Response Integrity session protocols</li>
                <li>Be evaluated before working with students</li>
              </ul>
              <RadioGroup
                value={commitment}
                onValueChange={(v) => form.setValue("commitment", v as ApplicationFormData["commitment"])}
              >
                <div className="flex flex-col gap-2 mt-2">
                  <div className="flex items-center gap-2 bg-gray-50 rounded px-3 py-2 border border-gray-200">
                    <RadioGroupItem value="yes" id="commit_yes" />
                    <Label htmlFor="commit_yes" className="font-medium">Yes</Label>
                  </div>
                  <div className="flex items-center gap-2 bg-gray-50 rounded px-3 py-2 border border-gray-200">
                    <RadioGroupItem value="no" id="commit_no" />
                    <Label htmlFor="commit_no" className="font-medium">No</Label>
                  </div>
                </div>
              </RadioGroup>
              <div className="mt-4 text-xs text-center text-gray-600">
                Final Section - Instruction<br />Submit your application only if you are serious about being trained and held to a high standard.
              </div>
            </CardContent>
          </Card>
        )}
        <div className="flex justify-between gap-2 mt-4">
          {onCancel && (
            <Button type="button" variant="ghost" onClick={onCancel} disabled={isSubmitting} aria-label="Cancel application">Cancel</Button>
          )}
          {currentStep > 1 && (
            <Button type="button" variant="outline" onClick={prevStep} disabled={isSubmitting} aria-label="Previous section">Previous</Button>
          )}
          {currentStep < 10 ? (
            <Button type="button" onClick={nextStep} disabled={isSubmitting || !isSectionValid()} aria-label="Next section">Next</Button>
          ) : (
            <Button
              type="button"
              onClick={() => {
                submitIntentRef.current = true;
                void form.handleSubmit(onSubmit)();
              }}
              disabled={isSubmitting || !isSectionValid()}
              aria-label="Submit application"
              className="gap-2"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {isSubmitting ? "Submitting..." : "Submit Application"}
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
