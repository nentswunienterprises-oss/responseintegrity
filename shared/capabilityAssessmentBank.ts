// TEST / DESIGN FIXTURES ONLY.
//
// The Response Integrity repository is public. These definitions must never be
// used as the live Specialist assessment bank. Runtime capability delivery is
// sourced from private Postgres tables through server/capabilityBank.ts.
// Production items must be authored/rotated privately before rollout.

import { CLARITY_MASTERY_ASSESSMENT } from "./capabilityAssessments";
import { CLARITY_RETRIEVAL_ASSESSMENT } from "./capabilityAssessmentsRetrieval";
import { STRUCTURED_EXECUTION_MASTERY_ASSESSMENT } from "./capabilityAssessmentsStructuredExecution";
import { CLARITY_STRUCTURED_TRANSFER_ASSESSMENT } from "./capabilityAssessmentsTransfer";

export const CAPABILITY_ASSESSMENT_FIXTURES = [
  CLARITY_MASTERY_ASSESSMENT,
  CLARITY_RETRIEVAL_ASSESSMENT,
  STRUCTURED_EXECUTION_MASTERY_ASSESSMENT,
  CLARITY_STRUCTURED_TRANSFER_ASSESSMENT,
] as const;
