-- Neutral report intake. Keeps technical and operational matters outside the legacy HR disputes workflow.
-- Reports are written and read by authenticated server routes through the private PostgreSQL pool.
CREATE TABLE IF NOT EXISTS public.issue_reports (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  reported_by varchar NOT NULL REFERENCES public.users(id),
  category varchar(32) NOT NULL CHECK (category IN ('technical', 'workflow', 'service', 'people', 'other')),
  owner_team varchar(32) NOT NULL CHECK (owner_team IN ('technology', 'operations', 'people')),
  title varchar(160) NOT NULL CHECK (length(btrim(title)) >= 5),
  description text NOT NULL CHECK (length(btrim(description)) >= 12),
  location_hint varchar(500),
  impact varchar(24) NOT NULL CHECK (impact IN ('blocked', 'affected', 'informational')),
  help_requested varchar(1000),
  status varchar(24) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved')),
  resolution_note text,
  reviewed_by varchar REFERENCES public.users(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT issue_reports_routing_authority CHECK (
    (category = 'technical' AND owner_team = 'technology') OR
    (category = 'people' AND owner_team = 'people') OR
    (category IN ('workflow', 'service', 'other') AND owner_team = 'operations')
  )
);
CREATE INDEX IF NOT EXISTS idx_issue_reports_team_status_date
  ON public.issue_reports(owner_team, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_issue_reports_reporter_date
  ON public.issue_reports(reported_by, created_at DESC);

ALTER TABLE public.issue_reports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.issue_reports FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.issue_reports TO service_role;

-- Each change has an append-only record; no DELETE or UPDATE grants for the event table.
CREATE TABLE IF NOT EXISTS public.issue_report_status_events (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  issue_report_id varchar NOT NULL REFERENCES public.issue_reports(id),
  changed_by varchar NOT NULL REFERENCES public.users(id),
  from_status varchar(24) NOT NULL CHECK (from_status IN ('open', 'in_progress', 'resolved')),
  to_status varchar(24) NOT NULL CHECK (to_status IN ('open', 'in_progress', 'resolved')),
  note text,
  changed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_issue_report_status_events_report
  ON public.issue_report_status_events(issue_report_id, changed_at DESC);
ALTER TABLE public.issue_report_status_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.issue_report_status_events FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.issue_report_status_events TO service_role;
