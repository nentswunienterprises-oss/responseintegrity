import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { AlertCircle, ArrowDown, ArrowLeft, ArrowUp, Check, CheckCircle2, ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import type { Pod, TutorAssignment } from "@shared/schema";

type CapabilityQuestionKind = "single_choice" | "multi_select" | "sequence";

type CapabilityQuestion = {
  key: string;
  prompt: string;
  kind: CapabilityQuestionKind;
  options: Array<{ key: string; label: string }>;
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
  questions: CapabilityQuestion[];
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
};

type PodData = {
  assignment: TutorAssignment & { pod: Pod };
};

type ResponseMap = Record<string, string[]>;

function humanizeEvidenceKind(kind: CapabilityForm["evidenceKind"]) {
  if (kind === "retrieval") return "Delayed retrieval";
  if (kind === "transfer") return "Interleaved transfer";
  return "Mastery";
}

function friendlyLoadError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");
  if (message.startsWith("404:")) {
    return "This capability check is not available in the active private assessment bank yet.";
  }
  if (message.startsWith("409:")) {
    return message.includes("Maximum")
      ? "No further attempts are currently available for this capability check."
      : "The next attempt is not available yet. Review the previous attempt and return when the retry window opens.";
  }
  return "The capability check could not be loaded. Your existing training progress has not been changed.";
}

function orderedResponseComplete(question: CapabilityQuestion, selected: string[]) {
  if (question.kind === "sequence") return selected.length === question.options.length;
  return selected.length > 0;
}

export default function SpecialistCapabilityAssessment() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { assessmentKey = "" } = useParams<{ assessmentKey: string }>();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [responses, setResponses] = useState<ResponseMap>({});
  const [result, setResult] = useState<CapabilityAttemptResult | null>(null);

  const { data: podData, isLoading: podLoading, error: podError } = useQuery<PodData>({
    queryKey: ["/api/tutor/pod"],
    retry: false,
  });

  const tutorAssignmentId = String(podData?.assignment?.id || "");

  const formQuery = useQuery<CapabilityForm>({
    queryKey: ["capability-assessment-form", assessmentKey, tutorAssignmentId],
    enabled: Boolean(assessmentKey && tutorAssignmentId && !result),
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
  const currentQuestion = form?.questions[currentIndex];

  const answeredCount = useMemo(() => {
    if (!form) return 0;
    return form.questions.filter((question) =>
      orderedResponseComplete(question, responses[question.key] || []),
    ).length;
  }, [form, responses]);

  const allComplete = Boolean(form && answeredCount === form.questions.length);
  const progressPercent = form ? Math.round((answeredCount / form.questions.length) * 100) : 0;

  const submitAttempt = useMutation({
    mutationFn: async () => {
      if (!form || !allComplete) throw new Error("Complete every question before submitting.");

      const res = await apiRequest(
        "POST",
        `/api/tutor/capability-assessments/${encodeURIComponent(form.key)}/attempt`,
        {
          tutorAssignmentId,
          formId: form.formId,
          bankVersion: form.bankVersion,
          responses: form.questions.map((question) => ({
            questionKey: question.key,
            selectedOptionKeys: responses[question.key] || [],
          })),
        },
      );
      return (await res.json()) as CapabilityAttemptResult;
    },
    onSuccess: async (attemptResult) => {
      setResult(attemptResult);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["capability-assessment-form", assessmentKey, tutorAssignmentId] }),
        queryClient.invalidateQueries({ queryKey: ["capability-assessment-history", assessmentKey, tutorAssignmentId] }),
        queryClient.invalidateQueries({ queryKey: ["capability-ledger", tutorAssignmentId] }),
      ]);
    },
  });

  const selectSingle = (questionKey: string, optionKey: string) => {
    setResponses((current) => ({ ...current, [questionKey]: [optionKey] }));
  };

  const toggleMulti = (questionKey: string, optionKey: string) => {
    setResponses((current) => {
      const selected = current[questionKey] || [];
      return {
        ...current,
        [questionKey]: selected.includes(optionKey)
          ? selected.filter((key) => key !== optionKey)
          : [...selected, optionKey],
      };
    });
  };

  const addSequenceOption = (questionKey: string, optionKey: string) => {
    setResponses((current) => {
      const selected = current[questionKey] || [];
      if (selected.includes(optionKey)) return current;
      return { ...current, [questionKey]: [...selected, optionKey] };
    });
  };

  const moveSequenceOption = (questionKey: string, optionKey: string, direction: -1 | 1) => {
    setResponses((current) => {
      const selected = [...(current[questionKey] || [])];
      const index = selected.indexOf(optionKey);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= selected.length) return current;
      [selected[index], selected[nextIndex]] = [selected[nextIndex], selected[index]];
      return { ...current, [questionKey]: selected };
    });
  };

  const removeSequenceOption = (questionKey: string, optionKey: string) => {
    setResponses((current) => ({
      ...current,
      [questionKey]: (current[questionKey] || []).filter((key) => key !== optionKey),
    }));
  };

  if (podLoading) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">Loading Specialist assignment...</div>;
  }

  if (podError || !tutorAssignmentId) {
    return (
      <div className="min-h-screen bg-background px-4 py-12">
        <div className="mx-auto max-w-xl">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>A Specialist assignment is required before capability assessment can begin.</AlertDescription>
          </Alert>
          <Button variant="outline" className="mt-6" onClick={() => navigate("/specialist/pod")}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Specialist Pod
          </Button>
        </div>
      </div>
    );
  }

  if (result) {
    const attemptsRemaining = Math.max(0, (form?.maxAttempts || result.attemptNumber) - result.attemptNumber);
    return (
      <div className="min-h-screen bg-background px-4 py-10">
        <div className="mx-auto max-w-2xl space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className={`flex h-11 w-11 items-center justify-center rounded-full ${result.passed ? "bg-emerald-500/10" : "bg-amber-500/10"}`}>
                  {result.passed ? <CheckCircle2 className="h-6 w-6 text-emerald-600" /> : <RotateCcw className="h-6 w-6 text-amber-600" />}
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Capability evidence recorded</p>
                  <CardTitle>{result.passed ? "Standard met" : "Not yet at standard"}</CardTitle>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border p-4"><p className="text-xs text-muted-foreground">Score</p><p className="text-2xl font-bold">{result.percent}%</p></div>
                <div className="rounded-lg border p-4"><p className="text-xs text-muted-foreground">Correct</p><p className="text-2xl font-bold">{result.correctQuestions}/{result.totalQuestions}</p></div>
                <div className="rounded-lg border p-4"><p className="text-xs text-muted-foreground">Attempt</p><p className="text-2xl font-bold">{result.attemptNumber}</p></div>
              </div>

              {result.hasCriticalFail && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    A critical operating boundary was not preserved on this attempt. The evidence has been recorded, but the assessment does not reveal the answer key.
                  </AlertDescription>
                </Alert>
              )}

              <p className="text-sm text-muted-foreground">
                {result.passed
                  ? "This evidence is now part of your capability record. It does not by itself certify you for live responsibility."
                  : attemptsRemaining > 0
                    ? `${attemptsRemaining} attempt${attemptsRemaining === 1 ? "" : "s"} remain under the current assessment configuration.`
                    : "No further attempts are currently available under this assessment configuration."}
              </p>

              <div className="flex flex-wrap gap-3">
                <Button onClick={() => navigate("/specialist/pod")}>Return to Specialist Pod</Button>
                <Button variant="outline" onClick={() => navigate("/responseconditioningsystem")}>Review RI-OS</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (formQuery.isLoading) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">Preparing capability check...</div>;
  }

  if (formQuery.error || !form || !currentQuestion) {
    return (
      <div className="min-h-screen bg-background px-4 py-12">
        <div className="mx-auto max-w-xl space-y-6">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{friendlyLoadError(formQuery.error)}</AlertDescription>
          </Alert>
          <p className="text-sm text-muted-foreground">
            Capability Engine evidence is still shadow evidence. Your current Battle Test training state remains unchanged.
          </p>
          <Button variant="outline" onClick={() => navigate("/responseconditioningsystem")}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to RI-OS
          </Button>
        </div>
      </div>
    );
  }

  const selected = responses[currentQuestion.key] || [];
  const sequenceOptionsByKey = new Map(currentQuestion.options.map((option) => [option.key, option]));
  const remainingSequenceOptions = currentQuestion.options.filter((option) => !selected.includes(option.key));

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center justify-between gap-4">
          <Button variant="ghost" onClick={() => navigate(-1)}><ArrowLeft className="mr-2 h-4 w-4" />Back</Button>
          <div className="text-right text-xs text-muted-foreground">
            <p>{humanizeEvidenceKind(form.evidenceKind)}</p>
            <p>Attempt {form.attemptNumber} of {form.maxAttempts}</p>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Capability Check</p>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{form.title}</h1>
            </div>
            <p className="text-sm font-medium">{answeredCount}/{form.totalQuestions}</p>
          </div>
          <Progress value={progressPercent} />
        </div>

        <Card>
          <CardHeader className="space-y-3">
            <p className="text-sm text-muted-foreground">Question {currentIndex + 1} of {form.totalQuestions}</p>
            <CardTitle className="text-xl leading-relaxed">{currentQuestion.prompt}</CardTitle>
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
                      onClick={() => selectSingle(currentQuestion.key, option.key)}
                      className={`flex w-full items-start gap-3 rounded-lg border p-4 text-left transition ${active ? "border-primary bg-primary/5" : "hover:bg-muted/40"}`}
                    >
                      <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${active ? "border-primary bg-primary text-primary-foreground" : ""}`}>
                        {active && <Check className="h-3 w-3" />}
                      </span>
                      <span>{option.label}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {currentQuestion.kind === "multi_select" && (
              <div className="grid gap-3">
                <p className="text-sm text-muted-foreground">Select every option that applies.</p>
                {currentQuestion.options.map((option) => {
                  const active = selected.includes(option.key);
                  return (
                    <button
                      type="button"
                      key={option.key}
                      onClick={() => toggleMulti(currentQuestion.key, option.key)}
                      className={`flex w-full items-start gap-3 rounded-lg border p-4 text-left transition ${active ? "border-primary bg-primary/5" : "hover:bg-muted/40"}`}
                    >
                      <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border ${active ? "border-primary bg-primary text-primary-foreground" : ""}`}>
                        {active && <Check className="h-3 w-3" />}
                      </span>
                      <span>{option.label}</span>
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
                    <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Choose the first step below.</div>
                  ) : (
                    <div className="space-y-2">
                      {selected.map((optionKey, index) => {
                        const option = sequenceOptionsByKey.get(optionKey);
                        if (!option) return null;
                        return (
                          <div key={optionKey} className="flex items-center gap-3 rounded-lg border p-3">
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold">{index + 1}</span>
                            <span className="flex-1">{option.label}</span>
                            <Button type="button" size="icon" variant="ghost" disabled={index === 0} onClick={() => moveSequenceOption(currentQuestion.key, optionKey, -1)} aria-label="Move up"><ArrowUp className="h-4 w-4" /></Button>
                            <Button type="button" size="icon" variant="ghost" disabled={index === selected.length - 1} onClick={() => moveSequenceOption(currentQuestion.key, optionKey, 1)} aria-label="Move down"><ArrowDown className="h-4 w-4" /></Button>
                            <Button type="button" variant="ghost" size="sm" onClick={() => removeSequenceOption(currentQuestion.key, optionKey)}>Remove</Button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {remainingSequenceOptions.length > 0 && (
                  <div>
                    <p className="mb-2 text-sm font-medium">Available steps</p>
                    <div className="grid gap-2">
                      {remainingSequenceOptions.map((option) => (
                        <Button key={option.key} type="button" variant="outline" className="h-auto justify-start whitespace-normal py-3 text-left" onClick={() => addSequenceOption(currentQuestion.key, option.key)}>
                          {option.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex items-center justify-between gap-3">
          <Button variant="outline" disabled={currentIndex === 0} onClick={() => setCurrentIndex((index) => Math.max(0, index - 1))}>
            <ChevronLeft className="mr-2 h-4 w-4" /> Previous
          </Button>

          {currentIndex < form.questions.length - 1 ? (
            <Button onClick={() => setCurrentIndex((index) => Math.min(form.questions.length - 1, index + 1))}>
              Next <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button disabled={!allComplete || submitAttempt.isPending} onClick={() => submitAttempt.mutate()}>
              {submitAttempt.isPending ? "Submitting..." : "Submit capability evidence"}
            </Button>
          )}
        </div>

        {!allComplete && currentIndex === form.questions.length - 1 && (
          <p className="text-center text-sm text-muted-foreground">Complete all {form.totalQuestions} questions before submission.</p>
        )}

        {submitAttempt.error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{submitAttempt.error instanceof Error ? submitAttempt.error.message : "Attempt submission failed."}</AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  );
}
