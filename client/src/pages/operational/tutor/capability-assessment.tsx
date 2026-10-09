import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  RotateCcw,
  XCircle,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import type { Pod, TutorAssignment } from "@shared/schema";

type CapabilityQuestionKind = "single_choice" | "multi_select" | "sequence";

type CapabilityQuestion = {
  key: string;
  prompt: string;
  kind: CapabilityQuestionKind;
  options: Array<{ key: string; label: string }>;
};

type CapabilityQuestionConfirmation = {
  questionKey: string;
  selectedOptionKeys: string[];
  correct: boolean;
  feedback: string;
  truth?: string;
  selectedCorrectOptionKeys?: string[];
  selectedWrongOptionKeys?: string[];
  missedCorrectOptionKeys?: string[];
  requiredSelectionCount?: number;
  confirmedAt: string;
};

type CapabilityForm = {
  key: string;
  deepDiveKey: string;
  title: string;
  evidenceKind: "mastery" | "retrieval" | "transfer";
  passThresholdPercent: number;
  totalQuestions: number;
  formId: string;
  bankVersion: number;
  attemptNumber: number;
  maxAttempts: number;
  interactionToken: string;
  questions: CapabilityQuestion[];
  confirmations?: CapabilityQuestionConfirmation[];
};

type CapabilityAttemptResult = {
  attemptId?: string;
  completedAt?: string;
  bankVersion: number;
  attemptNumber: number;
  formId: string;
  assessmentKey: string;
  evidenceKind: "mastery" | "retrieval" | "transfer";
  totalQuestions: number;
  correctQuestions: number;
  percent: number;
  passed: boolean;
  hasCriticalFail: boolean;
  sandboxReady?: boolean;
  operationalMode?: string | null;
  sandboxUnlocked?: boolean;
};

type ConfirmationResponse = {
  confirmation: CapabilityQuestionConfirmation;
  receipt: string;
};

type PodData = {
  assignment: TutorAssignment & { pod: Pod };
};

type ResponseMap = Record<string, string[]>;
type ConfirmationMap = Record<string, CapabilityQuestionConfirmation>;

function humanizeEvidenceKind(kind: CapabilityForm["evidenceKind"]) {
  if (kind === "retrieval") return "Delayed retrieval";
  if (kind === "transfer") return "Interleaved transfer";
  return "Mastery";
}

function friendlyLoadError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");
  if (message.startsWith("404:")) {
    return "This Capability Check is not available yet.";
  }
  if (message.startsWith("409:")) {
    if (message.includes("preceding Specialist Training evidence")) {
      return "This Capability Check is still locked behind the preceding Training evidence.";
    }
    if (message.includes("spacing interval")) {
      return "The Retention Check is still inside its required spacing interval.";
    }
    if (message.includes("attempt allowance") || message.includes("Maximum")) {
      return "No further attempts are currently available for this Capability Check.";
    }
    if (message.includes("already complete")) {
      return "This Capability evidence is already complete.";
    }
    return "The next attempt is not available yet.";
  }
  return "The capability check could not be loaded. Your existing training progress has not been changed.";
}

function orderedResponseComplete(question: CapabilityQuestion, selected: string[]) {
  if (question.kind === "sequence") return selected.length === question.options.length;
  return selected.length > 0;
}

function stripCapabilityAuthoringLeak(value: string) {
  let cleaned = value.replace(
    /\bAnd this also uses the distinction we just approved in Controlled Discomfort:\s*/i,
    "",
  );

  const trailingAuthoringMarkers = [
    /\s+The live drill [^.]+\.\s*$/i,
    /\s+Topic Conditioning:\s*45\/45 authored\..*$/i,
    /\s+That gives us\s+[^.]*\d+\/45[^.]*\.(?:.*)$/i,
    /\s+That is much tighter\.\s+I would replace the original.*$/i,
    /\s+And this caught a source problem too:.*$/i,
    /\s+That feels much closer to the actual condition.*$/i,
  ];

  for (const marker of trailingAuthoringMarkers) {
    cleaned = cleaned.replace(marker, "");
  }
  return cleaned;
}

function cleanCapabilityLearnerLanguage(value: string) {
  return value
    .replace(/\bdecision-eligible\b/gi, "evidence")
    .replace(/\bmodelingOnly\b/g, "teaching-only")
    .replace(/\bsupportLevel\s*:\s*none\b/gi, "no Specialist support")
    .replace(/\bchanged_form\b/gi, "changed form")
    .replace(/\bsame_form\b/gi, "same form")
    .replace(/\bCapability Blueprint\b/gi, "RI rules")
    .replace(/\bCapability Engine\b/gi, "RI")
    .replace(/\bstate engine\b/gi, "RI-OS")
    .replace(/\btransition engine\b/gi, "RI-OS")
    .replace(/\blive training registry\b/gi, "required Training sequence")
    .replace(/\blive drill registry\b/gi, "required Training sequence")
    .replace(/\bdrill registry\b/gi, "Training sequence")
    .replace(/\blive registry\b/gi, "required Training sequence")
    .replace(/\blive TPS evidence contract\b/gi, "TPS requirements")
    .replace(/\blive TPS contract\b/gi, "TPS requirements")
    .replace(/\bsupport contract\b/gi, "support requirement")
    .replace(/\bevidence contract\b/gi, "evidence requirements")
    .replace(/\blive training contract\b/gi, "Training requirements")
    .replace(/\bcontract\b/gi, "rule")
    .replace(/\bcanonical\b/gi, "")
    .replace(/\blineage\b/gi, "history")
    .replace(/\bruntime\b/gi, "session technology")
    .replace(/\bimplementation\b/gi, "design")
    .replace(/\bcertification specification\b/gi, "RI standard")
    .replace(/\bspecification\b/gi, "standard")
    .replace(/\bplatform\b/gi, "Response Integrity")
    .replace(/\barchitecture\b/gi, "structure")
    .replace(/\brunner\/preparation direction\b/gi, "prepared timing")
    .replace(/\bdrill runner\b/gi, "drill")
    .replace(/\brunner\b/gi, "session")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function cleanCapabilityCopy(value: string) {
  return cleanCapabilityLearnerLanguage(stripCapabilityAuthoringLeak(value))
    .replace(/\*\*\*([^*]+)\*\*\*/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*{2,}/g, "")
    .replace(/(^|\s)\*\s+/g, "$1")
    .replace(/\*([^*\r\n]+)\*/g, "$1")
    .replace(/__/g, "")
    .replace(/`/g, "")
    .replace(/^>\s*/g, "")
    .replace(/:\s*>\s*/g, ": ")
    .replace(/\s*(?:\u2192|\u2190|\u2194|\u21D2|\u27F6|->)\s*/g, ", ")
    .replace(/\u2014/g, " - ")
    .replace(/\s*---\s*$/g, "")
    .trim();
}

export default function SpecialistCapabilityAssessment() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { assessmentKey = "" } = useParams<{ assessmentKey: string }>();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [responses, setResponses] = useState<ResponseMap>({});
  const [confirmations, setConfirmations] = useState<ConfirmationMap>({});
  const [receipts, setReceipts] = useState<string[]>([]);
  const [hydratedFormId, setHydratedFormId] = useState("");
  const [result, setResult] = useState<CapabilityAttemptResult | null>(null);
  const [pendingResult, setPendingResult] = useState<CapabilityAttemptResult | null>(null);

  const [experienceRating, setExperienceRating] = useState<number | null>(null);
  const [experienceFeedback, setExperienceFeedback] = useState("");
  const [experienceFeedbackSubmitted, setExperienceFeedbackSubmitted] = useState(false);
  const [answerFeedbackOpen, setAnswerFeedbackOpen] = useState(false);
  const [answerFeedbackStage, setAnswerFeedbackStage] = useState<"feedback" | "truth">("feedback");

  const { data: podData, isLoading: podLoading, error: podError } = useQuery<PodData>({
    queryKey: ["/api/tutor/pod"],
    retry: false,
  });

  const tutorAssignmentId = String(podData?.assignment?.id || "");

  const formQuery = useQuery<CapabilityForm>({
    queryKey: [
      "capability-assessment-form",
      assessmentKey,
      tutorAssignmentId,
    ],
    enabled: Boolean(
      assessmentKey &&
        tutorAssignmentId &&
        !result &&
        !pendingResult,
    ),
    retry: false,
    staleTime: 0,
    queryFn: async () => {
      const res = await apiRequest(
        "GET",
        `/api/tutor/capability-assessments/${encodeURIComponent(assessmentKey)}?tutorAssignmentId=${encodeURIComponent(tutorAssignmentId)}`,
      );
      return (await res.json()) as CapabilityForm;
    },
  });

  const form = formQuery.data;

  useEffect(() => {
    if (!form || hydratedFormId === form.formId) return;

    const serverConfirmations = form.confirmations || [];
    const confirmationMap = Object.fromEntries(
      serverConfirmations.map((entry) => [entry.questionKey, entry]),
    ) as ConfirmationMap;
    const confirmedResponses = Object.fromEntries(
      serverConfirmations.map((entry) => [entry.questionKey, entry.selectedOptionKeys]),
    ) as ResponseMap;

    setConfirmations(confirmationMap);
    setResponses(confirmedResponses);

    const firstUnconfirmed = form.questions.findIndex(
      (question) => !confirmationMap[question.key],
    );
    setCurrentIndex(firstUnconfirmed >= 0 ? firstUnconfirmed : 0);
    setHydratedFormId(form.formId);
  }, [form, hydratedFormId]);

  useEffect(() => {
    if (!form?.formId) return;

    window.requestAnimationFrame(() => {
      window.scrollTo({
        top: 0,
        left: 0,
        behavior: "smooth",
      });
    });
  }, [currentIndex, form?.formId]);

  const currentQuestion = form?.questions[currentIndex];
  const currentConfirmation = currentQuestion
    ? confirmations[currentQuestion.key]
    : undefined;
  const selected = currentQuestion ? responses[currentQuestion.key] || [] : [];

  const confirmedCount = form
    ? form.questions.filter((question) => Boolean(confirmations[question.key])).length
    : 0;
  const progressPercent = form
    ? Math.round((confirmedCount / form.questions.length) * 100)
    : 0;

  const responseComplete = Boolean(
    currentQuestion && orderedResponseComplete(currentQuestion, selected),
  );

  const finalizeAttempt = useMutation({
    mutationFn: async (receiptsToSubmit: string[]) => {
      if (!form) {
        throw new Error("Capability form is not available.");
      }

      const res = await apiRequest(
        "POST",
        `/api/tutor/capability-assessments/${encodeURIComponent(form.key)}/attempt`,
        {
          tutorAssignmentId,
          interactionToken: form.interactionToken,
          receipts: receiptsToSubmit,
        },
      );
      return (await res.json()) as CapabilityAttemptResult;
    },
    onSuccess: async (attemptResult) => {
      setPendingResult(attemptResult);
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["capability-assessment-history", assessmentKey, tutorAssignmentId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["capability-ledger", tutorAssignmentId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["capability-mastery-plan", tutorAssignmentId],
        }),
        queryClient.invalidateQueries({ queryKey: ["/api/tutor/pod"] }),
      ]);
    },
  });

  const confirmQuestion = useMutation({
    mutationFn: async () => {
      if (!form || !currentQuestion || !responseComplete) {
        throw new Error("Choose your answer before confirming.");
      }

      const res = await apiRequest(
        "POST",
        `/api/tutor/capability-assessments/${encodeURIComponent(form.key)}/question-confirmation`,
        {
          interactionToken: form.interactionToken,
          priorReceipts: receipts,
          questionKey: currentQuestion.key,
          selectedOptionKeys: selected,
        },
      );
      return (await res.json()) as ConfirmationResponse;
    },
    onSuccess: ({ confirmation, receipt }) => {
      setAnswerFeedbackStage("feedback");
      setAnswerFeedbackOpen(true);
      setConfirmations((current) => ({
        ...current,
        [confirmation.questionKey]: confirmation,
      }));
      setResponses((current) => ({
        ...current,
        [confirmation.questionKey]: confirmation.selectedOptionKeys,
      }));

      const nextReceipts = [...receipts, receipt];
      setReceipts(nextReceipts);

      if (form && nextReceipts.length === form.questions.length) {
        finalizeAttempt.mutate(nextReceipts);
      }
    },
  });

  const submitExperienceFeedback = useMutation({
    mutationFn: async () => {
      if (!result?.attemptId || experienceRating === null) {
        throw new Error("Choose a rating before sending feedback.");
      }
      const res = await apiRequest(
        "POST",
        `/api/tutor/capability-attempts/${encodeURIComponent(result.attemptId)}/feedback`,
        {
          rating: experienceRating,
          feedback: experienceFeedback.trim() || null,
        },
      );
      return res.json();
    },
    onSuccess: () => {
      setExperienceFeedbackSubmitted(true);
    },
  });

  const selectSingle = (questionKey: string, optionKey: string) => {
    if (confirmations[questionKey]) return;
    setResponses((current) => ({ ...current, [questionKey]: [optionKey] }));
  };

  const toggleMulti = (questionKey: string, optionKey: string) => {
    if (confirmations[questionKey]) return;
    setResponses((current) => {
      const currentSelected = current[questionKey] || [];
      return {
        ...current,
        [questionKey]: currentSelected.includes(optionKey)
          ? currentSelected.filter((key) => key !== optionKey)
          : [...currentSelected, optionKey],
      };
    });
  };

  const addSequenceOption = (questionKey: string, optionKey: string) => {
    if (confirmations[questionKey]) return;
    setResponses((current) => {
      const currentSelected = current[questionKey] || [];
      if (currentSelected.includes(optionKey)) return current;
      return { ...current, [questionKey]: [...currentSelected, optionKey] };
    });
  };

  const moveSequenceOption = (
    questionKey: string,
    optionKey: string,
    direction: -1 | 1,
  ) => {
    if (confirmations[questionKey]) return;
    setResponses((current) => {
      const currentSelected = [...(current[questionKey] || [])];
      const index = currentSelected.indexOf(optionKey);
      const nextIndex = index + direction;
      if (
        index < 0 ||
        nextIndex < 0 ||
        nextIndex >= currentSelected.length
      ) {
        return current;
      }
      [currentSelected[index], currentSelected[nextIndex]] = [
        currentSelected[nextIndex],
        currentSelected[index],
      ];
      return { ...current, [questionKey]: currentSelected };
    });
  };

  const removeSequenceOption = (questionKey: string, optionKey: string) => {
    if (confirmations[questionKey]) return;
    setResponses((current) => ({
      ...current,
      [questionKey]: (current[questionKey] || []).filter(
        (key) => key !== optionKey,
      ),
    }));
  };

  const optionClasses = (
    optionKey: string,
    active: boolean,
    kind: CapabilityQuestionKind = "single_choice",
  ) => {
    if (currentConfirmation && kind === "multi_select") {
      if (currentConfirmation.selectedCorrectOptionKeys?.includes(optionKey)) {
        return "border-emerald-700/60 bg-emerald-500/[0.06] ring-1 ring-emerald-500/15";
      }
      if (currentConfirmation.selectedWrongOptionKeys?.includes(optionKey)) {
        return "border-destructive/70 bg-destructive/[0.06] ring-1 ring-destructive/15";
      }
      if (currentConfirmation.missedCorrectOptionKeys?.includes(optionKey)) {
        return "border-amber-700/60 bg-amber-500/[0.05] ring-1 ring-amber-500/15";
      }
      return "opacity-55";
    }

    const wasConfirmed = currentConfirmation?.selectedOptionKeys.includes(optionKey);
    if (wasConfirmed && currentConfirmation?.correct) {
      return "border-emerald-500 bg-emerald-500/10 ring-1 ring-emerald-500/20";
    }
    if (wasConfirmed && currentConfirmation && !currentConfirmation.correct) {
      return "border-red-500 bg-red-500/10 ring-1 ring-red-500/20";
    }
    if (currentConfirmation) return "opacity-60";
    return active
      ? "border-primary bg-primary/5"
      : "hover:bg-muted/40";
  };

  if (podLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">
        Loading Specialist assignment...
      </div>
    );
  }

  if (podError || !tutorAssignmentId) {
    return (
      <div className="min-h-screen bg-background px-4 py-12">
        <div className="mx-auto max-w-xl">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              A Specialist assignment is required before capability assessment can begin.
            </AlertDescription>
          </Alert>
          <Button
            variant="outline"
            className="mt-6"
            onClick={() => navigate("/specialist/pod")}
          >
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Specialist Pod
          </Button>
        </div>
      </div>
    );
  }

  if (result) {
    const attemptsRemaining = Math.max(
      0,
      (form?.maxAttempts || result.attemptNumber) - result.attemptNumber,
    );

    return (
      <div className="min-h-screen bg-background px-4 py-10">
        <div className="mx-auto max-w-2xl space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-11 w-11 items-center justify-center rounded-full ${
                    result.passed
                      ? "bg-emerald-500/10"
                      : "bg-amber-500/10"
                  }`}
                >
                  {result.passed ? (
                    <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                  ) : (
                    <RotateCcw className="h-6 w-6 text-amber-600" />
                  )}
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    Capability evidence recorded
                  </p>
                  <CardTitle>
                    {result.passed
                      ? result.evidenceKind === "mastery"
                        ? "Mastery evidenced"
                        : result.evidenceKind === "retrieval"
                          ? "Retention evidenced"
                          : "Transfer evidenced"
                      : "Not yet at standard"}
                  </CardTitle>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border p-4">
                  <p className="text-xs text-muted-foreground">Score</p>
                  <p className="text-2xl font-bold">{result.percent}%</p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-xs text-muted-foreground">Correct</p>
                  <p className="text-2xl font-bold">
                    {result.correctQuestions}/{result.totalQuestions}
                  </p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-xs text-muted-foreground">Attempt</p>
                  <p className="text-2xl font-bold">{result.attemptNumber}</p>
                </div>
              </div>

              {result.hasCriticalFail && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    A critical operating boundary was not preserved on this attempt.
                    That evidence is reflected in the result.
                  </AlertDescription>
                </Alert>
              )}

              <p className="text-sm text-muted-foreground">
                {result.passed
                  ? result.sandboxUnlocked
                    ? "Transformation Mastery, Retention and Transfer are now evidenced. Sandbox has been unlocked so Training can continue in the protected operating environment."
                    : result.evidenceKind === "mastery"
                      ? "This Deep Dive is mastered. Later gates still test whether you retain and apply the Transformation system without immediate Deep Dive cues."
                      : result.evidenceKind === "retrieval"
                        ? "Retention is evidenced. The next gate tests whether you can apply RI across mixed situations."
                        : "Transfer is evidenced. Sandbox unlocks when the complete Transformation evidence gate is satisfied."
                  : attemptsRemaining > 0
                    ? `${attemptsRemaining} attempt${attemptsRemaining === 1 ? "" : "s"} remain.`
                    : "No further attempts are currently available under this assessment configuration."}
              </p>
            </CardContent>
          </Card>

          {!experienceFeedbackSubmitted ? (
            <Card>
              <CardHeader>
                <CardTitle>Assessment reflection</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Reflect on how the assessment shaped your operating understanding. Share what strengthened your judgment, what prompted useful thinking, or what stood out to you in the experience. This does not change the RI standard or your result.
                </p>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Limited learning value</span>
                    <span>Strong learning value</span>
                  </div>
                  <div className="grid grid-cols-5 gap-2">
                    {[1, 2, 3, 4, 5].map((rating) => (
                      <Button
                        key={rating}
                        type="button"
                        variant={experienceRating === rating ? "default" : "outline"}
                        onClick={() => setExperienceRating(rating)}
                      >
                        {rating}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium">
                    What did this assessment reinforce, challenge, or help you see more clearly?
                  </p>
                  <Textarea
                    value={experienceFeedback}
                    onChange={(event) => setExperienceFeedback(event.target.value)}
                    maxLength={2000}
                    placeholder="Optional"
                    rows={4}
                  />
                </div>

                {submitExperienceFeedback.error ? (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      {submitExperienceFeedback.error instanceof Error
                        ? submitExperienceFeedback.error.message
                        : "Feedback could not be saved."}
                    </AlertDescription>
                  </Alert>
                ) : null}

                <div className="flex flex-wrap gap-3">
                  <Button
                    disabled={
                      experienceRating === null ||
                      submitExperienceFeedback.isPending
                    }
                    onClick={() => submitExperienceFeedback.mutate()}
                  >
                    {submitExperienceFeedback.isPending
                      ? "Sending..."
                      : "Submit reflection"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : experienceFeedbackSubmitted ? (
            <Card className="border-primary/20">
              <CardContent className="p-5 text-sm">
                Reflection recorded.
              </CardContent>
            </Card>
          ) : null}

          {experienceFeedbackSubmitted ? (
            <div className="flex flex-wrap gap-3">
              <Button onClick={() => navigate("/responseconditioningsystem")}>
                Back to Deep Dives
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  if (formQuery.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">
        Preparing capability check...
      </div>
    );
  }

  if (formQuery.error || !form || !currentQuestion) {
    return (
      <div className="min-h-screen bg-background px-4 py-12">
        <div className="mx-auto max-w-xl space-y-6">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {friendlyLoadError(formQuery.error)}
            </AlertDescription>
          </Alert>
          <p className="text-sm text-muted-foreground">
            Capability Checks record one layer of Training evidence at a time. Sandbox opens only after the complete Transformation gate is satisfied.
          </p>
          <Button
            variant="outline"
            onClick={() => navigate("/responseconditioningsystem")}
          >
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to RI-OS
          </Button>
        </div>
      </div>
    );
  }

  const sequenceOptionsByKey = new Map(
    currentQuestion.options.map((option) => [option.key, option]),
  );
  const remainingSequenceOptions = currentQuestion.options.filter(
    (option) => !selected.includes(option.key),
  );

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center justify-between gap-4">
          <Button variant="ghost" onClick={() => navigate(-1)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <div className="text-right text-xs text-muted-foreground">
            <p>{humanizeEvidenceKind(form.evidenceKind)}</p>
            <p>
              Attempt {form.attemptNumber} of {form.maxAttempts}
            </p>
            <p>
              {form.evidenceKind === "mastery"
                ? "Clean pass: 15/15"
                : "Pass: 24/25+"}
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Capability Check
              </p>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                {cleanCapabilityCopy(form.title.replace(/\s+Check$/, ""))}
              </h1>
            </div>
            <p className="text-sm font-medium">
              {confirmedCount}/{form.totalQuestions}
            </p>
          </div>
          <Progress value={progressPercent} className="rounded-none bg-[var(--ri-dark-surface)]" />
        </div>

        <Card>
          <CardHeader className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Question {currentIndex + 1} of {form.totalQuestions}
            </p>
            <CardTitle className="text-xl leading-relaxed">
              {cleanCapabilityCopy(currentQuestion.prompt)}
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">
            {currentQuestion.kind === "single_choice" && (
              <div className="grid gap-3">
                {currentQuestion.options.map((option) => {
                  const active = selected[0] === option.key;
                  return (
                    <button
                      type="button"
                      key={option.key}
                      disabled={Boolean(currentConfirmation)}
                      onClick={() =>
                        selectSingle(currentQuestion.key, option.key)
                      }
                      className={`flex w-full items-start gap-3 rounded-lg border p-4 text-left transition ${optionClasses(option.key, active, currentQuestion.kind)}`}
                    >
                      <span
                        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                          active && !currentConfirmation
                            ? "border-primary bg-primary text-primary-foreground"
                            : currentConfirmation?.selectedOptionKeys.includes(
                                  option.key,
                                )
                              ? currentConfirmation.correct
                                ? "border-emerald-500 bg-emerald-500 text-white"
                                : "border-red-500 bg-red-500 text-white"
                              : ""
                        }`}
                      >
                        {(active ||
                          currentConfirmation?.selectedOptionKeys.includes(
                            option.key,
                          )) && <Check className="h-3 w-3" />}
                      </span>
                      <span>{cleanCapabilityCopy(option.label)}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {currentQuestion.kind === "multi_select" && (
              <div className="grid gap-3">
                <p className="text-sm text-muted-foreground">
                  Select every option that applies.
                </p>
                {currentQuestion.options.map((option) => {
                  const active = selected.includes(option.key);
                  const submittedState = !currentConfirmation
                    ? null
                    : currentConfirmation.selectedCorrectOptionKeys?.includes(option.key)
                      ? "correct"
                      : currentConfirmation.selectedWrongOptionKeys?.includes(option.key)
                        ? "wrong"
                        : currentConfirmation.missedCorrectOptionKeys?.includes(option.key)
                          ? "missed"
                          : "neutral";
                  const stateLabel =
                    submittedState === "correct"
                      ? "Selected correctly"
                      : submittedState === "wrong"
                        ? "Does not apply"
                        : submittedState === "missed"
                          ? "Missed"
                          : null;

                  return (
                    <button
                      type="button"
                      key={option.key}
                      disabled={Boolean(currentConfirmation)}
                      onClick={() =>
                        toggleMulti(currentQuestion.key, option.key)
                      }
                      className={`flex w-full items-start gap-3 rounded-lg border p-4 text-left transition ${optionClasses(option.key, active, currentQuestion.kind)}`}
                    >
                      <span
                        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                          active && !currentConfirmation
                            ? "border-primary bg-primary text-primary-foreground"
                            : submittedState === "correct"
                              ? "border-emerald-700 bg-emerald-600 text-white"
                              : submittedState === "wrong"
                                ? "border-destructive bg-destructive text-destructive-foreground"
                                : submittedState === "missed"
                                  ? "border-amber-700 bg-amber-500/10 text-amber-700"
                                  : "border-muted-foreground/40"
                        }`}
                      >
                        {(active || submittedState === "correct" || submittedState === "wrong") && (
                          <Check className="h-3 w-3" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">{cleanCapabilityCopy(option.label)}</span>
                      {stateLabel ? (
                        <span className="shrink-0 text-[11px] uppercase tracking-wide text-muted-foreground">
                          {stateLabel}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            )}

            {currentQuestion.kind === "sequence" && (
              <div className="space-y-5">
                <div>
                  <p className="mb-2 text-sm font-medium">Your order</p>
                  {selected.length === 0 ? (
                    <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                      Choose the first step below.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {selected.map((optionKey, index) => {
                        const option = sequenceOptionsByKey.get(optionKey);
                        if (!option) return null;
                        return (
                          <div
                            key={optionKey}
                            className={`flex items-center gap-3 rounded-lg border p-3 ${
                              currentConfirmation
                                ? currentConfirmation.correct
                                  ? "border-emerald-500 bg-emerald-500/10"
                                  : "border-red-500 bg-red-500/10"
                                : ""
                            }`}
                          >
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold">
                              {index + 1}
                            </span>
                            <span className="flex-1">{cleanCapabilityCopy(option.label)}</span>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              disabled={index === 0 || Boolean(currentConfirmation)}
                              onClick={() =>
                                moveSequenceOption(
                                  currentQuestion.key,
                                  optionKey,
                                  -1,
                                )
                              }
                              aria-label="Move up"
                            >
                              <ArrowUp className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              disabled={
                                index === selected.length - 1 ||
                                Boolean(currentConfirmation)
                              }
                              onClick={() =>
                                moveSequenceOption(
                                  currentQuestion.key,
                                  optionKey,
                                  1,
                                )
                              }
                              aria-label="Move down"
                            >
                              <ArrowDown className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              disabled={Boolean(currentConfirmation)}
                              onClick={() =>
                                removeSequenceOption(
                                  currentQuestion.key,
                                  optionKey,
                                )
                              }
                            >
                              Remove
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {remainingSequenceOptions.length > 0 && !currentConfirmation && (
                  <div>
                    <p className="mb-2 text-sm font-medium">Available steps</p>
                    <div className="grid gap-2">
                      {remainingSequenceOptions.map((option) => (
                        <Button
                          key={option.key}
                          type="button"
                          variant="outline"
                          className="h-auto justify-start whitespace-normal py-3 text-left"
                          onClick={() =>
                            addSequenceOption(
                              currentQuestion.key,
                              option.key,
                            )
                          }
                        >
                          {cleanCapabilityCopy(option.label)}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

          </CardContent>
        </Card>

        {confirmQuestion.error ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {confirmQuestion.error instanceof Error
                ? confirmQuestion.error.message
                : "Answer could not be confirmed."}
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="flex items-center justify-between gap-3">
          <Button
            variant="outline"
            disabled={
              currentIndex === 0 ||
              confirmQuestion.isPending ||
              answerFeedbackOpen
            }
            onClick={() =>
              setCurrentIndex((index) => Math.max(0, index - 1))
            }
          >
            <ChevronLeft className="mr-2 h-4 w-4" /> Previous
          </Button>

          {currentConfirmation ? (
            answerFeedbackOpen ? (
              <span aria-hidden="true" />
            ) : currentIndex < form.questions.length - 1 ? (
              <Button
                onClick={() =>
                  setCurrentIndex((index) =>
                    Math.min(form.questions.length - 1, index + 1),
                  )
                }
              >
                Continue <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            ) : pendingResult ? (
              <Button onClick={() => setResult(pendingResult)}>
                View result <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <Button disabled>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Finalizing
              </Button>
            )
          ) : (
            <Button
              disabled={!responseComplete || confirmQuestion.isPending}
              onClick={() => confirmQuestion.mutate()}
            >
              {confirmQuestion.isPending ? "Confirming..." : "Confirm answer"}
            </Button>
          )}
        </div>

        {answerFeedbackOpen && currentConfirmation ? (
          <div className="pointer-events-none fixed inset-x-0 top-1/2 z-50 flex -translate-y-1/2 justify-center px-4">
            {(() => {
              const showingTruth =
                !currentConfirmation.correct && answerFeedbackStage === "truth";
              const isPositive = currentConfirmation.correct;
              const isNeutral = showingTruth;
              const pingTitle = currentConfirmation.correct
                ? "Yes"
                : showingTruth
                  ? "Truth"
                  : "Not quite";
              const pingCopy = showingTruth
                ? currentConfirmation.truth || currentConfirmation.feedback
                : currentConfirmation.feedback;

              const advanceFromPing = () => {
                if (currentIndex < form.questions.length - 1) {
                  setAnswerFeedbackOpen(false);
                  setAnswerFeedbackStage("feedback");
                  setCurrentIndex((index) =>
                    Math.min(form.questions.length - 1, index + 1),
                  );
                  return;
                }

                if (pendingResult) {
                  setAnswerFeedbackOpen(false);
                  setAnswerFeedbackStage("feedback");
                  setResult(pendingResult);
                }
              };

              return (
                <div
                  role="status"
                  aria-live="polite"
                  className={`pointer-events-auto w-full max-w-lg animate-in fade-in zoom-in-95 rounded-2xl border bg-background shadow-xl duration-150 ${
                    isNeutral
                      ? "border-border"
                      : isPositive
                        ? "border-emerald-500/60"
                        : "border-red-500/60"
                  }`}
                >
                  <div
                    className={`rounded-2xl p-5 sm:p-6 ${
                      isNeutral
                        ? "bg-background"
                        : isPositive
                          ? "bg-emerald-500/10"
                          : "bg-red-500/10"
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      {!isNeutral && !isPositive ? (
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-500/15">
                          <XCircle className="h-6 w-6 text-red-600" />
                        </div>
                      ) : null}

                      <div className="min-w-0 flex-1">
                        <p className="text-lg font-semibold">{pingTitle}</p>
                        <p className="mt-2 text-sm leading-relaxed text-foreground/90">
                          {cleanCapabilityCopy(pingCopy)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-5 flex justify-end">
                      {!currentConfirmation.correct &&
                      answerFeedbackStage === "feedback" ? (
                        <Button
                          size="sm"
                          onClick={() => setAnswerFeedbackStage("truth")}
                        >
                          Continue <ChevronRight className="ml-1.5 h-4 w-4" />
                        </Button>
                      ) : currentIndex < form.questions.length - 1 ? (
                        <Button size="sm" onClick={advanceFromPing}>
                          Continue <ChevronRight className="ml-1.5 h-4 w-4" />
                        </Button>
                      ) : pendingResult ? (
                        <Button size="sm" onClick={advanceFromPing}>
                          View result <ChevronRight className="ml-1.5 h-4 w-4" />
                        </Button>
                      ) : finalizeAttempt.error ? (
                        <Button
                          size="sm"
                          onClick={() => finalizeAttempt.mutate(receipts)}
                        >
                          Try finalizing
                        </Button>
                      ) : (
                        <Button size="sm" disabled>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Finalizing
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        ) : null}
      </div>
    </div>
  );
}
