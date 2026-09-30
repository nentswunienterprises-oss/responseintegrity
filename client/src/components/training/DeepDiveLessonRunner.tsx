import {
  Children,
  cloneElement,
  isValidElement,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { DeepDiveTeachingInteraction } from "@/components/training/DeepDiveTeachingInteraction";

type TeachingInteractionElement = ReactElement<{
  onAnswered?: () => void;
}>;

export function DeepDiveLessonRunner({
  lessonKey,
  title,
  children,
  completion,
}: {
  lessonKey: string;
  title: string;
  children: ReactNode;
  completion: ReactNode;
}) {
  const steps = useMemo(() => Children.toArray(children), [children]);
  const [stepIndex, setStepIndex] = useState(0);
  const [answeredSteps, setAnsweredSteps] = useState<Set<number>>(
    () => new Set<number>(),
  );
  const [complete, setComplete] = useState(false);
  const topRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem(`ri-deep-dive:${lessonKey}`);
    if (!stored) return;

    try {
      const parsed = JSON.parse(stored) as {
        stepIndex?: number;
        complete?: boolean;
        answeredSteps?: number[];
      };
      const maxIndex = Math.max(steps.length - 1, 0);
      setStepIndex(Math.min(Math.max(parsed.stepIndex || 0, 0), maxIndex));
      setComplete(Boolean(parsed.complete));
      setAnsweredSteps(new Set(parsed.answeredSteps || []));
    } catch {
      window.localStorage.removeItem(`ri-deep-dive:${lessonKey}`);
    }
  }, [lessonKey, steps.length]);

  useEffect(() => {
    window.localStorage.setItem(
      `ri-deep-dive:${lessonKey}`,
      JSON.stringify({
        stepIndex,
        complete,
        answeredSteps: Array.from(answeredSteps),
      }),
    );
  }, [answeredSteps, complete, lessonKey, stepIndex]);

  const current = steps[stepIndex] || null;
  const isTeachingInteraction =
    isValidElement(current) && current.type === DeepDiveTeachingInteraction;
  const interactionAnswered = answeredSteps.has(stepIndex);
  const canContinue = !isTeachingInteraction || interactionAnswered;
  const progress = complete
    ? 100
    : steps.length > 0
      ? ((stepIndex + 1) / steps.length) * 100
      : 100;

  const moveTo = (nextIndex: number) => {
    setStepIndex(nextIndex);
    requestAnimationFrame(() => {
      topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const continueLesson = () => {
    if (!canContinue) return;

    if (stepIndex >= steps.length - 1) {
      setComplete(true);
      requestAnimationFrame(() => {
        topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
      return;
    }

    moveTo(stepIndex + 1);
  };

  const renderedStep =
    isTeachingInteraction && isValidElement(current)
      ? cloneElement(current as TeachingInteractionElement, {
          onAnswered: () => {
            setAnsweredSteps((currentAnswered) => {
              if (currentAnswered.has(stepIndex)) return currentAnswered;
              const next = new Set(currentAnswered);
              next.add(stepIndex);
              return next;
            });
          },
        })
      : current;

  return (
    <div ref={topRef} className="mx-auto max-w-3xl space-y-6 scroll-mt-4">
      <div className="sticky top-0 z-20 -mx-4 border-b bg-background/95 px-4 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/85">
        <div className="mx-auto max-w-3xl space-y-2">
          <div className="flex items-center justify-between gap-4 text-sm">
            <p className="font-medium">{title}</p>
            <p className="text-muted-foreground">
              {complete
                ? "Complete"
                : `${stepIndex + 1} of ${Math.max(steps.length, 1)}`}
            </p>
          </div>
          <Progress
            value={progress}
            className="h-2 rounded-md bg-[var(--ri-dark-surface)]"
          />
        </div>
      </div>

      {complete ? (
        <Card className="p-6 space-y-3 border-primary/30 bg-primary/5">
          <div className="flex items-center gap-2">
            
            <p className="font-semibold">Deep Dive complete</p>
          </div>
          <p className="text-sm text-muted-foreground">
            You have worked through {title}. The next step is demonstration,
            not more scrolling.
          </p>
        </Card>
      ) : (
        <>
          <div key={stepIndex}>{renderedStep}</div>

          <div className="flex flex-col-reverse gap-3 border-t pt-5 sm:flex-row sm:items-center sm:justify-between">
            <Button
              variant="ghost"
              disabled={stepIndex === 0}
              onClick={() => moveTo(Math.max(stepIndex - 1, 0))}
            >
              
              Back
            </Button>

            <div className="space-y-2 sm:text-right">
              {isTeachingInteraction && !interactionAnswered ? (
                <p className="text-xs text-muted-foreground">
                  Answer the check before continuing.
                </p>
              ) : null}
              <Button disabled={!canContinue} onClick={continueLesson}>
                {stepIndex === steps.length - 1 ? "Finish Deep Dive" : "Continue"}
                
              </Button>
            </div>
          </div>
        </>
      )}

      <div hidden={!complete} aria-hidden={!complete}>
        {completion}
      </div>

      {complete ? (
        <Button
          variant="ghost"
          onClick={() => {
            setComplete(false);
            moveTo(Math.max(steps.length - 1, 0));
          }}
        >
          
          Review the final lesson step
        </Button>
      ) : null}
    </div>
  );
}
