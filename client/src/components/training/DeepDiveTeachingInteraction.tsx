import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export type DeepDiveTeachingOption = {
  key: string;
  label: string;
  feedback: string;
};

export function DeepDiveTeachingInteraction({
  prompt,
  options,
  correctOptionKey,
  truth,
  onAnswered,
}: {
  prompt: string;
  options: DeepDiveTeachingOption[];
  correctOptionKey: string;
  truth: string;
  onAnswered?: () => void;
}) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const selected = options.find((option) => option.key === selectedKey) || null;
  const correct = selectedKey === correctOptionKey;

  useEffect(() => {
    if (selectedKey) onAnswered?.();
  }, [onAnswered, selectedKey]);

  return (
    <Card className="ri-teaching-interaction p-6 space-y-5 border-primary/20 bg-primary/[0.025]">
      <div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
          Check your thinking
        </p>
        <p className="mt-2 text-lg font-semibold leading-relaxed">{prompt}</p>
      </div>

      <div className="grid gap-2">
        {options.map((option) => {
          const isSelected = selectedKey === option.key;
          return (
            <button
              key={option.key}
              type="button"
              onClick={() => setSelectedKey(option.key)}
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

      {selected ? (
        <div className="ri-feedback-panel space-y-3 rounded-lg border bg-background p-4">
          <div className="flex items-start gap-3">
            {!correct ? (
              <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-destructive/10">
                <X className="h-4 w-4 text-destructive" />
              </div>
            ) : null}
            <div>
              {!correct ? <p className="font-medium">Not quite</p> : null}
              <p className={correct ? "text-sm text-muted-foreground" : "mt-1 text-sm text-muted-foreground"}>
                {selected.feedback}
              </p>
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

      {selectedKey ? (
        <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedKey(null)}>
          Choose again
        </Button>
      ) : null}
    </Card>
  );
}
