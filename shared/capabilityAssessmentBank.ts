import { CLARITY_MASTERY_ASSESSMENT } from "./capabilityAssessments";
import { CLARITY_RETRIEVAL_ASSESSMENT } from "./capabilityAssessmentsRetrieval";
import { STRUCTURED_EXECUTION_MASTERY_ASSESSMENT } from "./capabilityAssessmentsStructuredExecution";
import { CLARITY_STRUCTURED_TRANSFER_ASSESSMENT } from "./capabilityAssessmentsTransfer";

export const CAPABILITY_ASSESSMENTS = [
  CLARITY_MASTERY_ASSESSMENT,
  CLARITY_RETRIEVAL_ASSESSMENT,
  STRUCTURED_EXECUTION_MASTERY_ASSESSMENT,
  CLARITY_STRUCTURED_TRANSFER_ASSESSMENT,
] as const;
