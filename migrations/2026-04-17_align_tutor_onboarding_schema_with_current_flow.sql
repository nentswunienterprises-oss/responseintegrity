-- Align tutor onboarding schema with the current 6-step TT document flow.
-- Renames old semantic step columns to neutral submission columns and drops
-- the deprecated legacy two-document onboarding fields.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tutor_applications' AND column_name = 'doc_1_tutor_agreement_url') THEN
    ALTER TABLE tutor_applications RENAME COLUMN doc_1_tutor_agreement_url TO doc_1_submission_url;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tutor_applications' AND column_name = 'doc_1_tutor_agreement_uploaded_at') THEN
    ALTER TABLE tutor_applications RENAME COLUMN doc_1_tutor_agreement_uploaded_at TO doc_1_submission_uploaded_at;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tutor_applications' AND column_name = 'doc_1_tutor_agreement_verified') THEN
    ALTER TABLE tutor_applications RENAME COLUMN doc_1_tutor_agreement_verified TO doc_1_submission_verified;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tutor_applications' AND column_name = 'doc_1_tutor_agreement_verified_by') THEN
    ALTER TABLE tutor_applications RENAME COLUMN doc_1_tutor_agreement_verified_by TO doc_1_submission_verified_by;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tutor_applications' AND column_name = 'doc_1_tutor_agreement_verified_at') THEN
    ALTER TABLE tutor_applications RENAME COLUMN doc_1_tutor_agreement_verified_at TO doc_1_submission_verified_at;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tutor_applications' AND column_name = 'doc_1_tutor_agreement_rejection_reason') THEN
    ALTER TABLE tutor_applications RENAME COLUMN doc_1_tutor_agreement_rejection_reason TO doc_1_submission_rejection_reason;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tutor_applications' AND column_name = 'doc_2_code_of_conduct_url') THEN
    ALTER TABLE tutor_applications RENAME COLUMN doc_2_code_of_conduct_url TO doc_2_submission_url;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tutor_applications' AND column_name = 'doc_2_code_of_conduct_uploaded_at') THEN
    ALTER TABLE tutor_applications RENAME COLUMN doc_2_code_of_conduct_uploaded_at TO doc_2_submission_uploaded_at;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tutor_applications' AND column_name = 'doc_2_code_of_conduct_verified') THEN
    ALTER TABLE tutor_applications RENAME COLUMN doc_2_code_of_conduct_verified TO doc_2_submission_verified;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tutor_applications' AND column_name = 'doc_2_code_of_conduct_verified_by') THEN
    ALTER TABLE tutor_applications RENAME COLUMN doc_2_code_of_conduct_verified_by TO doc_2_submission_verified_by;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tutor_applications' AND column_name = 'doc_2_code_of_conduct_verified_at') THEN
    ALTER TABLE tutor_applications RENAME COLUMN doc_2_code_of_conduct_verified_at TO doc_2_submission_verified_at;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tutor_applications' AND column_name = 'doc_2_code_of_conduct_rejection_reason') THEN
    ALTER TABLE tutor_applications RENAME COLUMN doc_2_code_of_conduct_rejection_reason TO doc_2_submission_rejection_reason;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tutor_applications' AND column_name = 'doc_3_emergency_waiver_url') THEN
    ALTER TABLE tutor_applications RENAME COLUMN doc_3_emergency_waiver_url TO doc_3_submission_url;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tutor_applications' AND column_name = 'doc_3_emergency_waiver_uploaded_at') THEN
    ALTER TABLE tutor_applications RENAME COLUMN doc_3_emergency_waiver_uploaded_at TO doc_3_submission_uploaded_at;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tutor_applications' AND column_name = 'doc_3_emergency_waiver_verified') THEN
    ALTER TABLE tutor_applications RENAME COLUMN doc_3_emergency_waiver_verified TO doc_3_submission_verified;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tutor_applications' AND column_name = 'doc_3_emergency_waiver_verified_by') THEN
    ALTER TABLE tutor_applications RENAME COLUMN doc_3_emergency_waiver_verified_by TO doc_3_submission_verified_by;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tutor_applications' AND column_name = 'doc_3_emergency_waiver_verified_at') THEN
    ALTER TABLE tutor_applications RENAME COLUMN doc_3_emergency_waiver_verified_at TO doc_3_submission_verified_at;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tutor_applications' AND column_name = 'doc_3_emergency_waiver_rejection_reason') THEN
    ALTER TABLE tutor_applications RENAME COLUMN doc_3_emergency_waiver_rejection_reason TO doc_3_submission_rejection_reason;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tutor_applications' AND column_name = 'doc_4_background_auth_url') THEN
    ALTER TABLE tutor_applications RENAME COLUMN doc_4_background_auth_url TO doc_4_submission_url;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tutor_applications' AND column_name = 'doc_4_background_auth_uploaded_at') THEN
    ALTER TABLE tutor_applications RENAME COLUMN doc_4_background_auth_uploaded_at TO doc_4_submission_uploaded_at;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tutor_applications' AND column_name = 'doc_4_background_auth_verified') THEN
    ALTER TABLE tutor_applications RENAME COLUMN doc_4_background_auth_verified TO doc_4_submission_verified;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tutor_applications' AND column_name = 'doc_4_background_auth_verified_by') THEN
    ALTER TABLE tutor_applications RENAME COLUMN doc_4_background_auth_verified_by TO doc_4_submission_verified_by;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tutor_applications' AND column_name = 'doc_4_background_auth_verified_at') THEN
    ALTER TABLE tutor_applications RENAME COLUMN doc_4_background_auth_verified_at TO doc_4_submission_verified_at;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tutor_applications' AND column_name = 'doc_4_background_auth_rejection_reason') THEN
    ALTER TABLE tutor_applications RENAME COLUMN doc_4_background_auth_rejection_reason TO doc_4_submission_rejection_reason;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tutor_applications' AND column_name = 'doc_5_tax_info_url') THEN
    ALTER TABLE tutor_applications RENAME COLUMN doc_5_tax_info_url TO doc_5_submission_url;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tutor_applications' AND column_name = 'doc_5_tax_info_uploaded_at') THEN
    ALTER TABLE tutor_applications RENAME COLUMN doc_5_tax_info_uploaded_at TO doc_5_submission_uploaded_at;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tutor_applications' AND column_name = 'doc_5_tax_info_verified') THEN
    ALTER TABLE tutor_applications RENAME COLUMN doc_5_tax_info_verified TO doc_5_submission_verified;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tutor_applications' AND column_name = 'doc_5_tax_info_verified_by') THEN
    ALTER TABLE tutor_applications RENAME COLUMN doc_5_tax_info_verified_by TO doc_5_submission_verified_by;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tutor_applications' AND column_name = 'doc_5_tax_info_verified_at') THEN
    ALTER TABLE tutor_applications RENAME COLUMN doc_5_tax_info_verified_at TO doc_5_submission_verified_at;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tutor_applications' AND column_name = 'doc_5_tax_info_rejection_reason') THEN
    ALTER TABLE tutor_applications RENAME COLUMN doc_5_tax_info_rejection_reason TO doc_5_submission_rejection_reason;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tutor_applications' AND column_name = 'doc_6_certified_id_copy_url') THEN
    ALTER TABLE tutor_applications RENAME COLUMN doc_6_certified_id_copy_url TO doc_6_submission_url;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tutor_applications' AND column_name = 'doc_6_certified_id_copy_uploaded_at') THEN
    ALTER TABLE tutor_applications RENAME COLUMN doc_6_certified_id_copy_uploaded_at TO doc_6_submission_uploaded_at;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tutor_applications' AND column_name = 'doc_6_certified_id_copy_verified') THEN
    ALTER TABLE tutor_applications RENAME COLUMN doc_6_certified_id_copy_verified TO doc_6_submission_verified;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tutor_applications' AND column_name = 'doc_6_certified_id_copy_verified_by') THEN
    ALTER TABLE tutor_applications RENAME COLUMN doc_6_certified_id_copy_verified_by TO doc_6_submission_verified_by;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tutor_applications' AND column_name = 'doc_6_certified_id_copy_verified_at') THEN
    ALTER TABLE tutor_applications RENAME COLUMN doc_6_certified_id_copy_verified_at TO doc_6_submission_verified_at;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tutor_applications' AND column_name = 'doc_6_certified_id_copy_rejection_reason') THEN
    ALTER TABLE tutor_applications RENAME COLUMN doc_6_certified_id_copy_rejection_reason TO doc_6_submission_rejection_reason;
  END IF;
END $$;

ALTER TABLE tutor_applications
  DROP COLUMN IF EXISTS trial_agreement_url,
  DROP COLUMN IF EXISTS trial_agreement_uploaded_at,
  DROP COLUMN IF EXISTS trial_agreement_verified,
  DROP COLUMN IF EXISTS trial_agreement_verified_by,
  DROP COLUMN IF EXISTS trial_agreement_verified_at,
  DROP COLUMN IF EXISTS parent_consent_url,
  DROP COLUMN IF EXISTS parent_consent_uploaded_at,
  DROP COLUMN IF EXISTS parent_consent_verified,
  DROP COLUMN IF EXISTS parent_consent_verified_by,
  DROP COLUMN IF EXISTS parent_consent_verified_at;

COMMENT ON COLUMN tutor_applications.document_submission_step IS 'Current step in 6-step tutor onboarding document submission (0-6).';
COMMENT ON COLUMN tutor_applications.documents_status IS 'JSON status for tutor document steps 1-6: not_started, pending_upload, pending_review, approved, rejected.';
COMMENT ON COLUMN tutor_applications.doc_1_submission_url IS 'Tutor submission for TT-TCF-001.';
COMMENT ON COLUMN tutor_applications.doc_2_submission_url IS 'Tutor submission for TT-EQV-002.';
COMMENT ON COLUMN tutor_applications.doc_3_submission_url IS 'Tutor submission for TT-ICA-003.';
COMMENT ON COLUMN tutor_applications.doc_4_submission_url IS 'Tutor submission for TT-SCP-004.';
COMMENT ON COLUMN tutor_applications.doc_5_submission_url IS 'Tutor submission for TT-DPC-005.';
COMMENT ON COLUMN tutor_applications.doc_6_submission_url IS 'Tutor submission for TT-CID-006 certified ID copy.';
