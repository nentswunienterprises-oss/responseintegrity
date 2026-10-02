import { useEffect, useMemo, useState } from "react";
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
          ).map((key) => String(key).trim()).filter(Boolean),
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
  if (kind === "single_choice" && answerKeys.length !== 1) {
    throw new Error("Single-choice formative interactions must define exactly one defensible answer.");
  }
  if (kind === "multi_select" && answerKeys.length < 2) {
    throw new Error("Multi-select formative interactions must define at least two defensible answers.");
  }

  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const correct = submitted && sameStringSet(selectedKeys, answerKeys);

  const selectedOptions = options.filter((option) => selectedKeys.includes(option.key));
  const selectedWrongOptions = selectedOptions.filter((option) => !answerKeys.includes(option.key));
  const missedCorrectOptions = options.filter(
    (option) => answerKeys.includes(option.key) && !selectedKeys.includes(option.key),
  );

  useEffect(() => {
    if (submitted) onAnswered?.();
  }, [onAnswered, submitted]);

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

  const feedbackLines = !submitted
    ? []
    : correct
      ? selectedOptions.map((option) => option.feedback)
      : [
          ...selectedWrongOptions.map((option) => option.feedback),
          ...missedCorrectOptions.map(
            (option) => `You missed another defensible conclusion: ${option.feedback}`,
          ),
        ];

  return (
    <Card className="ri-teaching-interaction p-6 space-y-5 border-primary/20 bg-primary/[0.025]">
      <div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
          Check your thinking
        </p>
        <p className="mt-2 text-lg font-semibold leading-relaxed">{prompt}</p>
        {kind === "multi_select" ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Select every option that applies, then confirm.
          </p>
        ) : null}
      </div>

      <div className="grid gap-2">
        {options.map((option) => {
          const isSelected = selectedKeys.includes(option.key);
          return (
            <button
              key={option.key}
              type="button"
              disabled={submitted}
              onClick={() => chooseOption(option.key)}
              className={
                "w-full rounded-lg border px-4 py-3 text-left text-sm transition " +
                (isSelected
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/40 hover:bg-muted/30")
              }
            >
              {option.label}
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
          Confirm
        </Button>
      ) : null}

      {submitted ? (
        <div className="ri-feedback-panel space-y-3 rounded-lg border bg-background p-4">
          <div className="flex items-start gap-3">
            {!correct ? (
              <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-destructive/10">
                <X className="h-4 w-4 text-destructive" />
              </div>
            ) : null}
            <div className="space-y-1">
              <p className="font-medium">{correct ? "Yes." : "Not quite"}</p>
              {feedbackLines.length > 0 ? (
                <div className="space-y-1 text-sm text-muted-foreground">
                  {feedbackLines.map((line, index) => (
                    <p key={`${index}-${line}`}>{line}</p>
                  ))}
                </div>
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

      {submitted ? (
        <Button type="button" variant="ghost" size="sm" onClick={reset}>
          Choose again
        </Button>
      ) : null}
    </Card>
  );
}
