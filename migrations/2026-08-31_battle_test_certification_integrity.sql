ALTER TABLE battle_test_rep_logs
  ADD COLUMN IF NOT EXISTS variant_key varchar(255) NOT NULL DEFAULT 'form_a',
  ADD COLUMN IF NOT EXISTS answer_evidence text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS scoring_guide jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS critical_fail_reason text;

COMMENT ON COLUMN battle_test_rep_logs.variant_key IS
  'Deterministic prompt form assigned from the deep-dive attempt count.';

COMMENT ON COLUMN battle_test_rep_logs.answer_evidence IS
  'Faithful capture of the Specialist answer used to justify the assessor score.';

COMMENT ON COLUMN battle_test_rep_logs.scoring_guide IS
  'Question-level Clear, Partial, and Fail anchors shown during the audit.';

COMMENT ON COLUMN battle_test_rep_logs.critical_fail_reason IS
  'Concrete non-negotiable operating boundary violated by this response.';
