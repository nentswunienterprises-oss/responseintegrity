import type { TutorTrainingMode } from "@shared/battleTesting";

export function proposalRequiresConfirmedIntroSession(mode: TutorTrainingMode) {
  return mode === "trial" || mode === "certified_live";
}
