-- Evidence-native diagnosis projection v2 stores behavioral classes rather than legacy
-- weak / partial / clear levels and intentionally carries no numeric score authority.

alter table public.response_integrity_evidence_ledger
  alter column normalized_level type varchar(24);

alter table public.response_integrity_evidence_ledger
  drop constraint if exists response_integrity_evidence_ledger_normalized_level_check,
  drop constraint if exists response_integrity_evidence_ledger_score_contribution_check,
  drop constraint if exists response_integrity_evidence_ledger_score_contribution_max_check,
  drop constraint if exists response_integrity_evidence_ledger_projection_version_check;

alter table public.response_integrity_evidence_ledger
  add constraint response_integrity_evidence_ledger_projection_version_check
    check (projection_version in (1, 2)),
  add constraint response_integrity_evidence_ledger_normalized_level_check
    check (
      (projection_version = 1 and normalized_level in ('weak', 'partial', 'clear'))
      or
      (projection_version = 2 and normalized_level in (
        'breakdown',
        'conditional',
        'near_stable',
        'supported',
        'not_observed',
        'confounded'
      ))
    ),
  add constraint response_integrity_evidence_ledger_score_contribution_check
    check (
      (projection_version = 1 and score_contribution >= 0)
      or
      (projection_version = 2 and score_contribution = 0)
    ),
  add constraint response_integrity_evidence_ledger_score_contribution_max_check
    check (
      (projection_version = 1 and score_contribution_max > 0)
      or
      (projection_version = 2 and score_contribution_max = 0)
    );
