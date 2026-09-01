import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, ShieldAlert, type LucideIcon } from "lucide-react";
import { stripWhatThisDoesSection } from "@/components/battle-testing/textUtils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import type {
  BattleTestPhaseDefinition,
  BattleTestResponseInput,
  BattleTestScore,
} from "@shared/battleTesting";
import { BATTLE_TEST_SCORE_POINTS, getBattleTestScoringGuide } from "@shared/battleTesting";

interface BattleTestRunnerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  phaseOptions: BattleTestPhaseDefinition[];
  selectionMode?: "multiple" | "fixed";
  preSelectedPhaseKeys?: string[];
  submitLabel: string;
  onSubmit: (payload: {
    selectedPhases: BattleTestPhaseDefinition[];
    responses: BattleTestResponseInput[];
  }) => Promise<void>;
}

type ResponseDraft = {
  score?: BattleTestScore;
  answerEvidence: string;
  note: string;
  isCriticalFail: boolean;
};

type BattleTestModuleGroup = {
  key: "transformation_phases" | "session_infrastructure" | "other";
  title: string;
  description: string;
  phases: BattleTestPhaseDefinition[];
};

type SelectionStage = "group" | "module" | "questions";

const SCORE_META: Record<
  BattleTestScore,
  { label: string; description: string; className: string; icon: LucideIcon }
> = {
  clear: {
    label: "CLEAR",
    description: "Fully aligned",
    className: "border-emerald-300 bg-emerald-50 text-emerald-800",
    icon: CheckCircle2,
  },
  partial: {
    label: "PARTIAL",
    description: "Some alignment, some drift",
    className: "border-amber-300 bg-amber-50 text-amber-800",
    icon: AlertTriangle,
  },
  fail: {
    label: "FAIL",
    description: "System misunderstanding",
    className: "border-rose-300 bg-rose-50 text-rose-800",
    icon: ShieldAlert,
  },
};

function getQuestionId(phaseKey: string, questionKey: string) {
  return `${phaseKey}:${questionKey}`;
}

function getPhaseGroupKey(phaseKey: string): BattleTestModuleGroup["key"] {
  if (
    [
      "clarity",
      "structured_execution",
      "controlled_discomfort",
      "time_pressure_stability",
      "topic_conditioning",
    ].includes(phaseKey)
  ) {
    return "transformation_phases";
  }

  if (
    [
      "intro_session_structure",
      "logging_system",
      "session_flow_control",
      "drill_library",
      "handover_verification",
      "tools_required",
    ].includes(phaseKey)
  ) {
    return "session_infrastructure";
  }

  return "other";
}

function groupPhaseOptions(phaseOptions: BattleTestPhaseDefinition[]): BattleTestModuleGroup[] {
  const groups = new Map<BattleTestModuleGroup["key"], BattleTestModuleGroup>();

  for (const phase of phaseOptions) {
    const groupKey = getPhaseGroupKey(phase.key);
    if (!groups.has(groupKey)) {
      groups.set(groupKey, {
        key: groupKey,
        title:
          groupKey === "transformation_phases"
            ? "Transformation Phases"
            : groupKey === "session_infrastructure"
            ? "Session Infrastructure"
            : "Other Modules",
        description:
          groupKey === "transformation_phases"
            ? "Tutor discipline across the transformation phases."
            : groupKey === "session_infrastructure"
            ? "Tutor discipline inside session setup, control, logging, and continuity systems."
            : "Additional tutor battle-test modules.",
        phases: [],
      });
    }

    groups.get(groupKey)!.phases.push(phase);
  }

  return [
    groups.get("transformation_phases"),
    groups.get("session_infrastructure"),
    groups.get("other"),
  ].filter((group): group is BattleTestModuleGroup => Boolean(group));
}

export default function BattleTestRunnerDialog({
  open,
  onOpenChange,
  title,
  description,
  phaseOptions,
  selectionMode = "multiple",
  preSelectedPhaseKeys,
  submitLabel,
  onSubmit,
}: BattleTestRunnerDialogProps) {
  const normalizedPreSelectedPhaseKeys = useMemo(
    () => (preSelectedPhaseKeys?.length ? [...preSelectedPhaseKeys] : []),
    [preSelectedPhaseKeys?.join("|")]
  );
  const hasPreSelectedPhaseKeys = normalizedPreSelectedPhaseKeys.length > 0;
  const fixedMode = selectionMode === "fixed";
  const initialPhaseKeys = useMemo(() => {
    if (fixedMode && hasPreSelectedPhaseKeys) {
      return normalizedPreSelectedPhaseKeys;
    }
    if (!fixedMode && normalizedPreSelectedPhaseKeys.length === 1) {
      return normalizedPreSelectedPhaseKeys;
    }
    return fixedMode ? phaseOptions.map((phase) => phase.key) : [];
  }, [phaseOptions, fixedMode, hasPreSelectedPhaseKeys, normalizedPreSelectedPhaseKeys]);

  const [selectedPhaseKeys, setSelectedPhaseKeys] = useState<string[]>(initialPhaseKeys);
  const [hasStarted, setHasStarted] = useState(fixedMode);
  const [responses, setResponses] = useState<Record<string, ResponseDraft>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saveCompleted, setSaveCompleted] = useState(false);
  const [runSummaryExpanded, setRunSummaryExpanded] = useState(true);
  const [selectionStage, setSelectionStage] = useState<SelectionStage>(fixedMode ? "questions" : "group");
  const [activeGroupKey, setActiveGroupKey] = useState<BattleTestModuleGroup["key"] | null>(null);

  const groupedPhaseOptions = useMemo(() => groupPhaseOptions(phaseOptions), [phaseOptions]);
  const activeGroup = useMemo(
    () => groupedPhaseOptions.find((group) => group.key === activeGroupKey) || null,
    [groupedPhaseOptions, activeGroupKey]
  );

  useEffect(() => {
    if (!open) return;
    setSelectedPhaseKeys(initialPhaseKeys);
    setHasStarted(fixedMode);
    setResponses({});
    setIsSubmitting(false);
    setSaveCompleted(false);
    setRunSummaryExpanded(true);
    setSelectionStage(fixedMode ? "questions" : "group");
    setActiveGroupKey(null);
  }, [open, initialPhaseKeys, fixedMode]);

  const selectedPhases = useMemo(
    () =>
      selectedPhaseKeys
        .map((phaseKey) => phaseOptions.find((phase) => phase.key === phaseKey))
        .filter((phase): phase is BattleTestPhaseDefinition => !!phase),
    [phaseOptions, selectedPhaseKeys]
  );

  const questions = useMemo(
    () =>
      selectedPhases.flatMap((phase) =>
        phase.questions.map((question) => ({
          phase,
          question,
          questionId: getQuestionId(phase.key, question.key),
        }))
      ),
    [selectedPhases]
  );

  const answeredCount = questions.filter(({ questionId }) => responses[questionId]?.score).length;
  const allAnswered = questions.length > 0 && answeredCount === questions.length;
  const hasDraftResponses = Object.values(responses).some(
    (response) =>
      Boolean(response.score) ||
      Boolean(response.answerEvidence.trim()) ||
      Boolean(response.note.trim()) ||
      response.isCriticalFail
  );
  const hasUnsavedProgress = hasStarted && hasDraftResponses && !saveCompleted;
  const auditLocked = isSubmitting || saveCompleted;
  const hasMissingNotes = questions.some(({ questionId }) => {
    const response = responses[questionId];
    return !!response?.score &&
      (response.score === "partial" || response.score === "fail") &&
      !response.note.trim();
  });
  const hasMissingAnswerEvidence = questions.some(({ questionId }) => {
    const response = responses[questionId];
    return !!response?.score && !response.answerEvidence.trim();
  });
  const estimatedPoints = questions.reduce((sum, { questionId }) => {
    const score = responses[questionId]?.score;
    return sum + (score ? BATTLE_TEST_SCORE_POINTS[score] : 0);
  }, 0);

  useEffect(() => {
    if (!open || !hasUnsavedProgress || isSubmitting || typeof window === "undefined") return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [open, hasUnsavedProgress, isSubmitting]);

  const confirmDiscardProgress = (message: string) => {
    if (!hasUnsavedProgress || typeof window === "undefined") return true;
    return window.confirm(message);
  };

  const handleDialogOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      onOpenChange(true);
      return;
    }

    if (isSubmitting) return;

    if (
      !confirmDiscardProgress(
        "Exit this audit? Any unsaved scoring, notes, and critical-fail markings from this run will be lost."
      )
    ) {
      return;
    }

    onOpenChange(false);
  };

  const handleModuleOpen = (phaseKey: string) => {
    if (selectionMode === "fixed") return;
    setSelectedPhaseKeys([phaseKey]);
    setHasStarted(true);
    setSelectionStage("questions");
    setResponses({});
  };

  const handleGroupOpen = (groupKey: BattleTestModuleGroup["key"]) => {
    if (selectionMode === "fixed") return;
    setActiveGroupKey(groupKey);
    setSelectionStage("module");
  };

  const handleReturnToGroupList = () => {
    if (selectionMode === "fixed") return;
    if (
      !confirmDiscardProgress(
        "Return to the audit families list? Any unsaved scoring, notes, and critical-fail markings from this run will be lost."
      )
    ) {
      return;
    }
    setSelectionStage("group");
    setActiveGroupKey(null);
    setSelectedPhaseKeys([]);
    setHasStarted(false);
    setResponses({});
  };

  const handleReturnToModuleList = () => {
    if (selectionMode === "fixed") return;
    if (
      !confirmDiscardProgress(
        "Return to the module list? Any unsaved scoring, notes, and critical-fail markings from this run will be lost."
      )
    ) {
      return;
    }
    setSelectionStage("module");
    setHasStarted(false);
    setSelectedPhaseKeys([]);
    setResponses({});
  };

  const handleScoreChange = (phaseKey: string, questionKey: string, score: BattleTestScore) => {
    const questionId = getQuestionId(phaseKey, questionKey);
    setResponses((current) => {
      const previous = current[questionId];
      return {
        ...current,
        [questionId]: {
          score,
          answerEvidence: previous?.answerEvidence || "",
          note: previous?.note || "",
          isCriticalFail: score === "fail" ? previous?.isCriticalFail || false : false,
        },
      };
    });
  };

  const handleAnswerEvidenceChange = (phaseKey: string, questionKey: string, value: string) => {
    const questionId = getQuestionId(phaseKey, questionKey);
    setResponses((current) => {
      const previous = current[questionId];
      return {
        ...current,
        [questionId]: {
          score: previous?.score,
          answerEvidence: value,
          note: previous?.note || "",
          isCriticalFail: previous?.isCriticalFail || false,
        },
      };
    });
  };

  const handleSubmit = async () => {
    if (!allAnswered || hasMissingNotes || hasMissingAnswerEvidence || isSubmitting) return;
    setIsSubmitting(true);
    setSaveCompleted(false);

    const payloadResponses: BattleTestResponseInput[] = questions.map(({ phase, question, questionId }) => {
      const response = responses[questionId];
      return {
        phaseKey: phase.key,
        questionKey: question.key,
        score: response.score!,
        answerEvidence: response.answerEvidence.trim(),
        note: response.note.trim() || undefined,
        isCriticalFail: question.autoCriticalOnFail
          ? response.score === "fail"
          : response.score === "fail"
          ? response.isCriticalFail
          : false,
      };
    });

    try {
      await onSubmit({
        selectedPhases,
        responses: payloadResponses,
      });
    } catch {
      setIsSubmitting(false);
      return;
    }

    setSaveCompleted(true);
    setIsSubmitting(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent
        onEscapeKeyDown={(event) => {
          if (isSubmitting || hasUnsavedProgress) {
            event.preventDefault();
          }
        }}
        onInteractOutside={(event) => {
          if (isSubmitting || hasUnsavedProgress) {
            event.preventDefault();
          }
        }}
        onPointerDownOutside={(event) => {
          if (isSubmitting || hasUnsavedProgress) {
            event.preventDefault();
          }
        }}
        className="flex h-[95dvh] w-[calc(100vw-1rem)] max-w-6xl flex-col overflow-hidden rounded-2xl border border-[#E7D5C8] bg-[#FCF7F0] p-0 shadow-2xl sm:h-auto sm:max-h-[92vh] sm:w-[min(96vw,88rem)] lg:max-h-[88vh] lg:max-w-[90rem]"
      >
        <div className="border-b border-[#E7D5C8] bg-white/95 px-4 py-4 sm:px-6 sm:py-5 lg:px-8 lg:py-6">
          <DialogHeader>
            <DialogTitle className="text-lg text-[#1A1A1A] sm:text-xl lg:text-2xl">{title}</DialogTitle>
            <DialogDescription className="text-[#6B5B52]">{description}</DialogDescription>
          </DialogHeader>
        </div>

        {(hasUnsavedProgress || isSubmitting || saveCompleted) && (
          <div
            className={`border-b px-4 py-3 text-sm sm:px-6 lg:px-8 ${
              saveCompleted
                ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                : isSubmitting
                ? "border-amber-200 bg-amber-50 text-amber-900"
                : "border-rose-200 bg-rose-50 text-rose-900"
            }`}
          >
            <p className="font-medium">
              {saveCompleted
                ? "Audit saved successfully."
                : isSubmitting
                ? "Saving audit. Keep this runner open until confirmation completes."
                : "Audit in progress. Closing this runner now will discard unsaved scoring and notes."}
            </p>
            <p className="mt-1 text-xs opacity-80">
              {saveCompleted
                ? "This runner will stay open until you close it."
                : isSubmitting
                ? "The runner will stay visible while the save completes."
                : "Use the top-right close button only if you want to abandon this draft audit."}
            </p>
          </div>
        )}

        <div className="relative flex min-h-0 flex-1 flex-col lg:grid lg:grid-cols-[minmax(0,1fr)_23rem] lg:gap-0 lg:overflow-hidden lg:bg-[#F6EEE3]">
          <div className="min-h-0 min-w-0 lg:overflow-hidden lg:bg-[#FCF7F0]">
            {!hasStarted ? (
              <ScrollArea className="h-[58dvh] sm:h-auto sm:max-h-none lg:h-full lg:max-h-full">
                <div className="space-y-5 p-4 sm:p-6 lg:mx-auto lg:max-w-4xl lg:space-y-6 lg:p-8">
                  {selectionStage === "group" ? (
                    <>
                      <div className="rounded-2xl border border-[#E7D5C8] bg-[#FFF5ED] p-4 text-[#1A1A1A] sm:p-5">
                        <p className="text-sm font-medium text-foreground">Choose an audit module family</p>
                        <p className="mt-1 text-sm text-[#6B5B52]">
                          TD first chooses the audit module family, then opens a specific 15-question deep-dive battle-test bank.
                        </p>
                      </div>
                      <div className="grid gap-4 md:grid-cols-2">
                        {groupedPhaseOptions
                          .filter((group) => group.key !== "other")
                          .map((group) => (
                            <button
                              key={group.key}
                              type="button"
                              onClick={() => handleGroupOpen(group.key)}
                              className="text-left"
                            >
                              <Card className="rounded-2xl border border-[#E7D5C8] bg-white p-5 shadow-sm transition-colors hover:border-primary/40 hover:bg-[#FFF9F3]">
                                <div className="space-y-3">
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="space-y-1">
                                      <p className="text-base font-semibold text-foreground">{group.title}</p>
                                      <p className="text-sm text-[#6B5B52]">{group.description}</p>
                                    </div>
                                    <ChevronRight className="mt-0.5 h-4 w-4 text-[#6B5B52]" />
                                  </div>
                                  <Badge variant="outline">{group.phases.length} banks</Badge>
                                </div>
                              </Card>
                            </button>
                          ))}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center justify-between gap-3 rounded-2xl border border-[#E7D5C8] bg-[#FFF5ED] p-4 text-[#1A1A1A] sm:p-5">
                        <div>
                          <p className="text-sm font-medium text-foreground">{activeGroup?.title || "Audit Modules"}</p>
                          <p className="mt-1 text-sm text-[#6B5B52]">
                            Click a module to open its 15-question deep-dive battle-test bank.
                          </p>
                        </div>
                        <Button variant="outline" size="sm" onClick={handleReturnToGroupList} disabled={auditLocked}>
                          Back
                        </Button>
                      </div>
                      <div className="grid gap-3 md:grid-cols-2">
                        {(activeGroup?.phases || []).map((phase) => (
                          <button
                            key={phase.key}
                            type="button"
                            onClick={() => handleModuleOpen(phase.key)}
                            className="text-left"
                          >
                            <Card className="rounded-2xl border border-[#E7D5C8] bg-white p-4 shadow-sm transition-colors hover:border-primary/40 hover:bg-[#FFF9F3]">
                              <div className="space-y-2">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="space-y-1">
                                    <p className="text-sm font-semibold text-foreground">{phase.title}</p>
                                    <p className="text-sm text-[#6B5B52]">{phase.description}</p>
                                  </div>
                                  <ChevronRight className="mt-0.5 h-4 w-4 text-[#6B5B52]" />
                                </div>
                                <Badge variant="outline">{phase.questions.length} questions</Badge>
                              </div>
                            </Card>
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </ScrollArea>
            ) : (
              <ScrollArea className="h-screen lg:h-full lg:max-h-full">
                <div className="space-y-5 p-4 pb-20 sm:p-6 sm:pb-24 lg:mx-auto lg:max-w-4xl lg:space-y-6 lg:p-8 lg:pb-8">
                  {questions.length === 0 ? (
                    <div className="rounded-[24px] border border-[#E7D5C8] bg-white p-12 text-center text-sm text-muted-foreground shadow-sm">
                      <p className="font-semibold text-foreground">No questions are available for the selected deep dive phases.</p>
                      <p className="mt-2">The system selected a phase set but could not load the rep bank. Refresh the page or open the audit again.</p>
                    </div>
                  ) : selectionMode !== "fixed" ? (
                    <div className="flex items-center justify-between gap-3 rounded-2xl border border-[#E7D5C8] bg-white px-4 py-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                          Active Module
                        </p>
                        <p className="text-sm font-medium text-foreground">
                          {selectedPhases[0]?.title || "Battle Test"}
                        </p>
                      </div>
                      <Button variant="outline" size="sm" onClick={handleReturnToModuleList} disabled={auditLocked}>
                        Back to modules
                      </Button>
                    </div>
                  ) : null}
                  {questions.map(({ phase, question, questionId }, index) => {
                    const response = responses[questionId] || { answerEvidence: "", note: "", isCriticalFail: false };
                    const scoringGuide = getBattleTestScoringGuide(question);
                    return (
                      <Card key={questionId} className="rounded-[24px] border border-[#E7D5C8] bg-white p-4 shadow-sm sm:p-5 lg:p-6">
                        <div className="space-y-4">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="secondary">{phase.title}</Badge>
                            <Badge variant="outline">{question.section}</Badge>
                            <span className="text-xs text-muted-foreground">Rep {index + 1}</span>
                          </div>

                          <div className="space-y-2">
                            <p className="text-base font-semibold text-foreground">
                              {stripWhatThisDoesSection(question.prompt)}
                            </p>
                            <Collapsible>
                              <CollapsibleTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-auto px-0 text-sm text-[#6B5B52] hover:text-[#1A1A1A]">
                                  Show expected answer and fail indicators
                                </Button>
                              </CollapsibleTrigger>
                              <CollapsibleContent className="space-y-3 rounded-2xl border border-[#E7D5C8] bg-[#FCF7F0] p-4">
                                <div>
                                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                                    Expected Answer
                                  </p>
                                  <p className="mt-2 text-sm text-foreground">
                                    {stripWhatThisDoesSection(question.expectedAnswer)}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                                    Fail Indicators
                                  </p>
                                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-foreground">
                                    {question.failIndicators.map((indicator) => (
                                      <li key={indicator}>{indicator}</li>
                                    ))}
                                  </ul>
                                </div>
                              </CollapsibleContent>
                            </Collapsible>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor={`${questionId}-answer-evidence`}>Specialist answer / evidence heard</Label>
                            <Textarea
                              id={`${questionId}-answer-evidence`}
                              value={response.answerEvidence}
                              disabled={auditLocked}
                              onChange={(event) => handleAnswerEvidenceChange(phase.key, question.key, event.target.value)}
                              placeholder="Capture the Specialist's actual answer or the evidence they gave before scoring."
                              rows={3}
                            />
                          </div>

                          <RadioGroup
                            value={response.score}
                            disabled={auditLocked}
                            onValueChange={(value) =>
                              handleScoreChange(phase.key, question.key, value as BattleTestScore)
                            }
                            className="grid gap-3 md:grid-cols-3"
                          >
                            {(["clear", "partial", "fail"] as BattleTestScore[]).map((score) => {
                              const meta = SCORE_META[score];
                              const Icon = meta.icon;
                              return (
                                <Label
                                  key={score}
                                  htmlFor={`${questionId}-${score}`}
                                  className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors ${meta.className} ${
                                    response.score === score ? "ring-2 ring-primary/30" : ""
                                  }`}
                                >
                                  <RadioGroupItem id={`${questionId}-${score}`} value={score} className="mt-0.5" />
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <Icon className="h-4 w-4" />
                                      <span className="font-semibold">{meta.label}</span>
                                    </div>
                                    <p className="mt-1 text-xs opacity-80">{scoringGuide[score] || meta.description}</p>
                                  </div>
                                </Label>
                              );
                            })}
                          </RadioGroup>

                          {(response.score === "partial" || response.score === "fail") && (
                            <div className="space-y-3">
                              <div className="space-y-2">
                                <Label htmlFor={`${questionId}-note`}>TD note</Label>
                                <Textarea
                                  id={`${questionId}-note`}
                                  value={response.note}
                                  disabled={auditLocked}
                                  onChange={(event) =>
                                    setResponses((current) => ({
                                      ...current,
                                      [questionId]: {
                                        score: response.score,
                                        answerEvidence: response.answerEvidence,
                                        note: event.target.value,
                                        isCriticalFail: response.isCriticalFail,
                                      },
                                    }))
                                  }
                                  placeholder="Log the exact drift, violation, or incomplete understanding."
                                  rows={3}
                                />
                              </div>
                              {response.score === "fail" && !question.autoCriticalOnFail ? (
                                <Label className="flex items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">
                                  <Checkbox
                                    checked={response.isCriticalFail}
                                    disabled={auditLocked}
                                    onCheckedChange={(checked) =>
                                      setResponses((current) => ({
                                        ...current,
                                        [questionId]: {
                                          score: response.score,
                                          answerEvidence: response.answerEvidence,
                                          note: response.note,
                                          isCriticalFail: checked === true,
                                        },
                                      }))
                                    }
                                  />
                                  Mark this fail as a critical override
                                </Label>
                              ) : null}
                              {response.score === "fail" && question.autoCriticalOnFail ? (
                                <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">
                                  This question auto-triggers a critical fail when scored as FAIL
                                  {question.criticalFailReason ? `: ${question.criticalFailReason}` : "."}
                                </div>
                              ) : null}
                            </div>
                          )}
                        </div>
                      </Card>
                    );
                  })}
                  <div className="h-28 lg:hidden" />
                </div>
              </ScrollArea>
            )}
          </div>

          {/* Mobile: Fixed at bottom when started */}
          {hasStarted && (
            <div className="fixed bottom-0 left-0 right-0 z-10 lg:hidden bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 overflow-hidden">
              <Button
                variant="ghost"
                onClick={() => setRunSummaryExpanded(!runSummaryExpanded)}
                className="w-full justify-between px-4 py-1 text-left font-medium hover:bg-muted/50 h-auto border-b"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Run Summary
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {answeredCount}/{questions.length}
                  </span>
                </div>
                <ChevronDown className={`h-3 w-3 transition-transform ${runSummaryExpanded ? "rotate-180" : ""}`} />
              </Button>
              {runSummaryExpanded && (
                <div className="max-h-[calc(100vh-120px)] sm:max-h-[calc(100vh-100px)] overflow-y-auto">
                  <div className="space-y-4 p-4 sm:p-6">
                    <div>
                      <p className="text-3xl font-semibold text-foreground">
                        {answeredCount}/{questions.length}
                      </p>
                      <p className="text-sm text-muted-foreground">Answers scored across assigned deep dive audits</p>
                    </div>

                    <Card className="border border-border/70 p-4">
                      <p className="text-sm font-medium text-foreground">Estimated alignment score</p>
                      <p className="mt-2 text-2xl font-semibold text-foreground">
                        {questions.length > 0 ? Math.round((estimatedPoints / questions.length) * 100) : 0}%
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Based on current CLEAR / PARTIAL / FAIL entries.
                      </p>
                    </Card>

                    <div className="space-y-2">
                      {selectedPhases.map((phase) => (
                        <div key={phase.key} className="rounded-xl border border-border/70 bg-background px-4 py-3">
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-sm font-medium text-foreground">{phase.title}</span>
                            <Badge variant="outline">{phase.questions.length} questions</Badge>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="rounded-xl border border-border/70 bg-background p-4 text-sm text-muted-foreground">
                      Capture the Specialist's actual answer for every scored question. Notes are required for every PARTIAL or FAIL score.
                    </div>

                    <div className="space-y-3">
                      <Button
                        className="w-full"
                        disabled={saveCompleted || !allAnswered || hasMissingAnswerEvidence || hasMissingNotes || isSubmitting}
                        onClick={handleSubmit}
                      >
                        {saveCompleted ? "Saved" : isSubmitting ? "Saving..." : submitLabel}
                      </Button>
                      {saveCompleted ? (
                        <Button variant="outline" className="w-full" onClick={() => onOpenChange(false)}>
                          Close Runner
                        </Button>
                      ) : null}
                      {isSubmitting || saveCompleted ? (
                        <p className={`text-xs ${saveCompleted ? "text-emerald-700" : "text-amber-700"}`}>
                          {saveCompleted
                            ? "Audit saved. Review it if needed, then close the runner manually."
                            : "Saving audit. Keep this runner open until confirmation appears."}
                        </p>
                      ) : null}
                      {!allAnswered ? (
                        <p className="text-xs text-amber-700">Every rep must be scored before submission.</p>
                      ) : null}
                      {allAnswered && hasMissingAnswerEvidence ? (
                        <p className="text-xs text-amber-700">Capture the Specialist answer/evidence for every scored question.</p>
                      ) : null}
                      {allAnswered && hasMissingNotes ? (
                        <p className="text-xs text-amber-700">Add notes for each PARTIAL and FAIL score.</p>
                      ) : null}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Desktop: Always show sidebar */}
          <div className="hidden lg:block lg:min-h-0 lg:overflow-y-auto lg:border-l lg:border-[#E7D5C8] lg:bg-[#F8F1E7]">
            <Collapsible open={runSummaryExpanded} onOpenChange={setRunSummaryExpanded}>
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  className="w-full justify-between border-b border-[#E7D5C8] px-6 py-4 text-left font-medium text-[#1A1A1A] hover:bg-[#F3E8DA]"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      Run Summary
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {answeredCount}/{questions.length} reps
                    </span>
                  </div>
                  <ChevronDown className={`h-4 w-4 transition-transform ${runSummaryExpanded ? "rotate-180" : ""}`} />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="p-6 lg:p-7">
                  <div className="space-y-4 rounded-[28px] border border-[#E7D5C8] bg-white p-5 shadow-sm">
                    <div>
                      <p className="mt-2 text-3xl font-semibold text-foreground">
                        {answeredCount}/{questions.length}
                      </p>
                      <p className="text-sm text-muted-foreground">Answers scored</p>
                    </div>

                    <Card className="border border-[#E7D5C8] bg-[#FCF7F0] p-4 shadow-none">
                      <p className="text-sm font-medium text-foreground">Estimated alignment score</p>
                      <p className="mt-2 text-2xl font-semibold text-foreground">
                        {questions.length > 0 ? Math.round((estimatedPoints / questions.length) * 100) : 0}%
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Based on current CLEAR / PARTIAL / FAIL entries.
                      </p>
                    </Card>

                    <div className="space-y-2">
                      {selectedPhases.map((phase) => (
                        <div key={phase.key} className="rounded-xl border border-[#E7D5C8] bg-[#FCF7F0] px-4 py-3">
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-sm font-medium text-foreground">{phase.title}</span>
                            <Badge variant="outline">{phase.questions.length} reps</Badge>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="rounded-xl border border-[#E7D5C8] bg-[#FCF7F0] p-4 text-sm text-muted-foreground">
                      Capture the Specialist's actual answer for every scored question. Notes are required for every PARTIAL or FAIL score.
                    </div>

                    {hasStarted && (
                      <div className="space-y-3">
                        <Button
                          className="w-full"
                          disabled={saveCompleted || !allAnswered || hasMissingAnswerEvidence || hasMissingNotes || isSubmitting}
                          onClick={handleSubmit}
                        >
                          {saveCompleted ? "Saved" : isSubmitting ? "Saving..." : submitLabel}
                        </Button>
                        {saveCompleted ? (
                          <Button variant="outline" className="w-full" onClick={() => onOpenChange(false)}>
                            Close Runner
                          </Button>
                        ) : null}
                        {isSubmitting || saveCompleted ? (
                          <p className={`text-xs ${saveCompleted ? "text-emerald-700" : "text-amber-700"}`}>
                            {saveCompleted
                              ? "Audit saved. Review it if needed, then close the runner manually."
                              : "Saving audit. Keep this runner open until confirmation appears."}
                          </p>
                        ) : null}
                        {!allAnswered ? (
                          <p className="text-xs text-amber-700">Every rep must be scored before submission.</p>
                        ) : null}
                        {allAnswered && hasMissingAnswerEvidence ? (
                          <p className="text-xs text-amber-700">Capture the Specialist answer/evidence for every scored question.</p>
                        ) : null}
                        {allAnswered && hasMissingNotes ? (
                          <p className="text-xs text-amber-700">Add notes for each PARTIAL and FAIL score.</p>
                        ) : null}
                      </div>
                    )}
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
