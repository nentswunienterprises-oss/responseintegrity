-- Authorized Response Integrity evidence correction lineage.
-- Original ledger rows remain immutable. Corrections are append-only events that preserve both
-- what was first recorded and what the Specialist later states should have been recorded.

create table if not exists public.response_integrity_evidence_corrections (
  correction_id uuid primary key default gen_random_uuid(),
  evidence_id text not null references public.response_integrity_evidence_ledger(evidence_id) on delete cascade,
  source_drill_id varchar(64) not null,
  student_id varchar(64) not null,
  tutor_id varchar(64) not null,
  correction_sequence integer not null check (correction_sequence > 0),
  previous_option_id text not null,
  previous_raw_option text not null,
  previous_normalized_level varchar(24) not null,
  corrected_option_id text not null,
  corrected_raw_option text not null,
  corrected_normalized_level varchar(24) not null,
  reason text not null check (char_length(reason) between 10 and 1000),
  requested_by varchar(64) not null,
  requested_by_role varchar(32) not null check (requested_by_role in ('tutor')),
  state_review_required boolean not null default true,
  created_at timestamptz not null default now(),
  unique (evidence_id, correction_sequence)
);

create index if not exists idx_ri_evidence_corrections_source
  on public.response_integrity_evidence_corrections (source_drill_id, created_at);

create index if not exists idx_ri_evidence_corrections_student
  on public.response_integrity_evidence_corrections (student_id, created_at);

create or replace function public.prevent_response_integrity_evidence_correction_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Response Integrity evidence correction rows are immutable';
end;
$$;

drop trigger if exists trg_response_integrity_evidence_corrections_immutable
  on public.response_integrity_evidence_corrections;

create trigger trg_response_integrity_evidence_corrections_immutable
before update or delete on public.response_integrity_evidence_corrections
for each row execute function public.prevent_response_integrity_evidence_correction_mutation();

alter table public.response_integrity_evidence_corrections enable row level security;

comment on table public.response_integrity_evidence_corrections is
  'Append-only correction lineage for immutable Response Integrity evidence. Original evidence is never silently rewritten; dependent state remains review-required.';
