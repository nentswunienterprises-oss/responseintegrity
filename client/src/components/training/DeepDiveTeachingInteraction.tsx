import { useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export type DeepDiveTeachingOption = {
  key: string;
  label: string;
  feedback: string;
};

export type DeepDiveTeachingInteractionKind = "single_choice" | "multi_select";

function sameStringSet(left: string[], right: string[]) {
  if (left.length !== right.length) return false;
  const rightSet = new Set(right);
  return left.every((value) => rightSet.has(value));
}

function cleanFeedback(value: string) {
  return value
    .replace(/^Yes[.!]?\s*/i, "")
    .replace(/^That is correct[.!]?\s*/i, "")
    .trim();
}

export function DeepDiveTeachingInteraction({
  prompt,
  options,
  kind = "single_choice",
  correctOptionKey,
  correctOptionKeys,
  truth,
  onAnswered,
}: {
  prompt: string;
  options: DeepDiveTeachingOption[];
  kind?: DeepDiveTeachingInteractionKind;
  correctOptionKey?: string;
  correctOptionKeys?: string[];
  truth: string;
  onAnswered?: () => void;
}) {
  const answerKeys = useMemo(
    () =>
      Array.from(
        new Set(
          (correctOptionKeys?.length
            ? correctOptionKeys
            : correctOptionKey
              ? [correctOptionKey]
              : []
          )
            .map((key) => String(key).trim())
            .filter(Boolean),
        ),
      ),
    [correctOptionKey, correctOptionKeys],
  );

  if (options.length < 5) {
    throw new Error("Deep Dive formative interactions must expose at least five options.");
  }

  const optionKeys = new Set(options.map((option) => option.key));
  if (optionKeys.size !== options.length) {
    throw new Error("Deep Dive formative interaction option keys must be unique.");
  }
  if (answerKeys.some((key) => !optionKeys.has(key))) {
    throw new Error("Deep Dive formative interaction answer keys must exist in the options.");
  }
  if (kind === "single_choice" && (answerKeys.length < 1 || answerKeys.length > 2)) {
    throw new Error("Single-choice formative interactions must define one or two defensible answers.");
  }
  if (kind === "multi_select" && answerKeys.length < 2) {
    throw new Error("Multi-select formative interactions must define at least two defensible answers.");
  }

  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const feedbackRef = useRef<HTMLDivElement | null>(null);
  const correct =
    submitted &&
    (kind === "single_choice"
      ? selectedKeys.length === 1 && answerKeys.includes(selectedKeys[0])
      : sameStringSet(selectedKeys, answerKeys));

  const selectedOptions = options.filter((option) => selectedKeys.includes(option.key));
  const selectedCorrectOptions = selectedOptions.filter((option) => answerKeys.includes(option.key));
  const selectedWrongOptions = selectedOptions.filter((option) => !answerKeys.includes(option.key));
  const missedCorrectOptions = options.filter(
    (option) => answerKeys.includes(option.key) && !selectedKeys.includes(option.key),
  );

  useEffect(() => {
    if (submitted) onAnswered?.();
  }, [onAnswered, submitted]);

  useEffect(() => {
    if (!submitted || !window.matchMedia("(max-width: 639px)").matches) return;

    const frame = window.requestAnimationFrame(() => {
      feedbackRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [submitted]);

  const chooseOption = (optionKey: string) => {
    if (submitted) return;

    if (kind === "single_choice") {
      setSelectedKeys([optionKey]);
      setSubmitted(true);
      return;
    }

    setSelectedKeys((current) =>
      current.includes(optionKey)
        ? current.filter((key) => key !== optionKey)
        : [...current, optionKey],
    );
  };

  const reset = () => {
    setSelectedKeys([]);
    setSubmitted(false);
  };

  const singleChoiceFeedback =
    submitted && kind === "single_choice" && selectedOptions[0]
      ? cleanFeedback(selectedOptions[0].feedback)
      : "";

  const ordinalLabel = (index: number) =>
    ["first", "second", "third", "fourth", "fifth", "sixth"][index] ??
    `#${index + 1}`;

  const naturalJoin = (values: string[]) => {
    if (values.length <= 1) return values[0] ?? "";
    if (values.length === 2) return `${values[0]} and ${values[1]}`;
    return `${values.slice(0, -1).join(", ")}, and ${values.at(-1)}`;
  };

  const selectedCorrectPositions = selectedKeys
    .map((key, index) => (answerKeys.includes(key) ? ordinalLabel(index) : null))
    .filter((value): value is string => Boolean(value));

  const selectedWrongPositions = selectedKeys
    .map((key, index) => (!answerKeys.includes(key) ? ordinalLabel(index) : null))
    .filter((value): value is string => Boolean(value));

  const countWord = (count: number) =>
    ["zero", "one", "two", "three", "four", "five", "six"][count] ??
    String(count);

  const multiSelectSummary = correct
    ? ""
    : [
        selectedCorrectPositions.length === 0
          ? "None of your selections are right."
          : `You got the ${naturalJoin(selectedCorrectPositions)} right.`,
        selectedWrongPositions.length === 0
          ? null
          : selectedWrongPositions.length === 1
            ? `The ${selectedWrongPositions[0]} does not apply.`
            : `The ${naturalJoin(selectedWrongPositions)} do not apply.`,
        missedCorrectOptions.length === 0
          ? null
          : missedCorrectOptions.length === 1
            ? "There is one more option that also applies."
            : `There are ${countWord(missedCorrectOptions.length)} more options that also apply.`,
      ]
        .filter(Boolean)
        .join(" ");

  return (
    <Card className="ri-teaching-interaction p-6 space-y-5 border-primary/20 bg-primary/[0.025]">
      <div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
          Check your thinking
        </p>
        <p className="mt-2 text-lg font-semibold leading-relaxed">{prompt}</p>
        {kind === "multi_select" ? (
          <div className="mt-3 flex items-center justify-between gap-4 text-sm text-muted-foreground">
            <p>Select all that apply.</p>
            <p className="shrink-0 tabular-nums">{selectedKeys.length} selected</p>
          </div>
        ) : null}
      </div>

      <div className="grid gap-2">
        {options.map((option) => {
          const isSelected = selectedKeys.includes(option.key);
          const isAnswer = answerKeys.includes(option.key);
          const submittedState =
            !submitted || kind !== "multi_select"
              ? null
              : isSelected && isAnswer
                ? "correct"
                : isSelected && !isAnswer
                  ? "wrong"
                  : !isSelected && isAnswer
                    ? "missed"
                    : "neutral";

          const stateClass =
            submittedState === "correct"
              ? "border-emerald-700/60 bg-emerald-500/[0.06]"
              : submittedState === "wrong"
                ? "border-destructive/70 bg-destructive/[0.06]"
                : submittedState === "missed"
                  ? "border-amber-700/60 bg-amber-500/[0.05]"
                  : submittedState === "neutral"
                    ? "opacity-55"
                    : isSelected
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/40 hover:bg-muted/30";

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
              key={option.key}
              type="button"
              disabled={submitted}
              onClick={() => chooseOption(option.key)}
              className={"w-full rounded-lg border px-4 py-3 text-left text-sm transition " + stateClass}
            >
              <div className="flex items-start gap-3">
                {kind === "multi_select" ? (
                  <span
                    aria-hidden="true"
                    className={
                      "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border text-xs " +
                      (isSelected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-muted-foreground/40")
                    }
                  >
                    {isSelected ? "•" : ""}
                  </span>
                ) : null}
                <span className="min-w-0 flex-1 leading-relaxed">{option.label}</span>
                {stateLabel ? (
                  <span className="shrink-0 text-[11px] uppercase tracking-wide text-muted-foreground">
                    {stateLabel}
                  </span>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>

      {kind === "multi_select" && !submitted ? (
        <Button
          type="button"
          size="sm"
          disabled={selectedKeys.length === 0}
          onClick={() => setSubmitted(true)}
        >
          Confirm selections
        </Button>
      ) : null}

      {submitted && kind === "single_choice" ? (
        <div ref={feedbackRef} className="ri-feedback-panel scroll-mt-24 space-y-3 rounded-lg border bg-background p-4">
          <div className="flex items-start gap-3">
            {!correct ? (
              <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-destructive/10">
                <X className="h-4 w-4 text-destructive" />
              </div>
            ) : null}
            <div className="space-y-1">
              <p className="font-medium">{correct ? "Yes" : "Not quite"}</p>
              {singleChoiceFeedback ? (
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {singleChoiceFeedback}
                </p>
              ) : null}
            </div>
          </div>

          {!correct ? (
            <div className="border-t pt-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
                Truth
              </p>
              <p className="mt-1 text-sm leading-relaxed">{truth}</p>
            </div>
          ) : null}
        </div>
      ) : null}

      {submitted && kind === "multi_select" ? (
        <div ref={feedbackRef} className="ri-feedback-panel scroll-mt-24 space-y-4 rounded-lg border bg-background p-4">
          <div className="flex items-start gap-3">
            {!correct ? (
              <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-destructive/10">
                <X className="h-4 w-4 text-destructive" />
              </div>
            ) : null}
            <div>
              <p className="font-medium">{correct ? "Yes" : "Not quite"}</p>
              {multiSelectSummary ? (
                <p className="mt-1 text-sm text-muted-foreground">{multiSelectSummary}</p>
              ) : null}
            </div>
          </div>

          {!correct && selectedWrongOptions.length > 0 ? (
            <div className="space-y-3 border-t pt-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
                Selected, but does not apply
              </p>
              {selectedWrongOptions.map((option) => (
                <div key={option.key}>
                  <p className="text-sm font-medium leading-relaxed">{option.label}</p>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    {cleanFeedback(option.feedback)}
                  </p>
                </div>
              ))}
            </div>
          ) : null}

          {!correct && missedCorrectOptions.length > 0 ? (
            <div className="space-y-3 border-t pt-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
                Missed
              </p>
              {missedCorrectOptions.map((option) => (
                <div key={option.key}>
                  <p className="text-sm font-medium leading-relaxed">{option.label}</p>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    {cleanFeedback(option.feedback)}
                  </p>
                </div>
              ))}
            </div>
          ) : null}

          <div className="border-t pt-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
              Core rule
            </p>
            <p className="mt-1 text-sm leading-relaxed">{truth}</p>
          </div>
        </div>
      ) : null}

      {submitted ? (
        <Button type="button" variant="ghost" size="sm" onClick={reset}>
          Choose again
        </Button>
      ) : null}
    </Card>
  );
}
