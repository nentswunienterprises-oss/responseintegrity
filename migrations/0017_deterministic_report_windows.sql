-- Deterministic report identity and replay protection.
-- Nullable keeps historical reports readable while new deterministic reports
-- receive a source-window key from the application.
ALTER TABLE parent_reports
  ADD COLUMN IF NOT EXISTS report_window_key VARCHAR;

CREATE UNIQUE INDEX IF NOT EXISTS uq_parent_reports_source_window
  ON parent_reports (tutor_id, student_id, report_type, report_window_key)
  WHERE report_window_key IS NOT NULL;
