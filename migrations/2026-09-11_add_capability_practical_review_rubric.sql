ALTER TABLE specialist_capability_practical_evidence
  ADD COLUMN IF NOT EXISTS rubric_version integer,
  ADD COLUMN IF NOT EXISTS rubric_snapshot jsonb;

ALTER TABLE specialist_capability_practical_evidence
  DROP CONSTRAINT IF EXISTS specialist_capability_practical_evidence_rubric_version_check;
ALTER TABLE specialist_capability_practical_evidence
  ADD CONSTRAINT specialist_capability_practical_evidence_rubric_version_check
  CHECK (rubric_version IS NULL OR rubric_version > 0);

ALTER TABLE specialist_capability_practical_reviews
  ADD COLUMN IF NOT EXISTS rubric_version integer,
  ADD COLUMN IF NOT EXISTS outcome_rule_version integer,
  ADD COLUMN IF NOT EXISTS criterion_judgments jsonb,
  ADD COLUMN IF NOT EXISTS clear_count integer,
  ADD COLUMN IF NOT EXISTS partial_count integer,
  ADD COLUMN IF NOT EXISTS fail_count integer,
  ADD COLUMN IF NOT EXISTS critical_fail_count integer,
  ADD COLUMN IF NOT EXISTS critical_fail_criterion_keys jsonb;

ALTER TABLE specialist_capability_practical_reviews
  DROP CONSTRAINT IF EXISTS specialist_capability_practical_reviews_rubric_version_check;
ALTER TABLE specialist_capability_practical_reviews
  ADD CONSTRAINT specialist_capability_practical_reviews_rubric_version_check
  CHECK (rubric_version IS NULL OR rubric_version > 0);

ALTER TABLE specialist_capability_practical_reviews
  DROP CONSTRAINT IF EXISTS specialist_capability_practical_reviews_outcome_rule_version_check;
ALTER TABLE specialist_capability_practical_reviews
  ADD CONSTRAINT specialist_capability_practical_reviews_outcome_rule_version_check
  CHECK (outcome_rule_version IS NULL OR outcome_rule_version > 0);

ALTER TABLE specialist_capability_practical_reviews
  DROP CONSTRAINT IF EXISTS specialist_capability_practical_reviews_counts_check;
ALTER TABLE specialist_capability_practical_reviews
  ADD CONSTRAINT specialist_capability_practical_reviews_counts_check
  CHECK (
    (clear_count IS NULL OR clear_count >= 0)
    AND (partial_count IS NULL OR partial_count >= 0)
    AND (fail_count IS NULL OR fail_count >= 0)
    AND (critical_fail_count IS NULL OR critical_fail_count >= 0)
  );

COMMENT ON COLUMN specialist_capability_practical_evidence.rubric_snapshot IS
  'Immutable review rubric snapshot frozen when the Specialist submits the practical evidence.';

COMMENT ON COLUMN specialist_capability_practical_reviews.criterion_judgments IS
  'Immutable criterion-level Clear/Partial/Fail judgments and reviewer evidence notes used to derive the practical review outcome.';

COMMENT ON COLUMN specialist_capability_practical_reviews.outcome IS
  'System-derived outcome from the frozen practical rubric. Reviewers do not choose this outcome directly in Capability Engine V2.';