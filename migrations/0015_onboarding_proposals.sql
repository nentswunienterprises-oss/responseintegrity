-- Migration: Add onboarding proposals system
-- Adds enrollment_status enum, updates parent_enrollments table, and creates onboarding_proposals table

-- Add new enrollment status values
DO $$ BEGIN
  CREATE TYPE enrollment_status AS ENUM (
    'not_enrolled',
    'awaiting_assignment',
    'assigned',
    'proposal_sent',
    'session_booked',
    'report_received',
    'confirmed'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Update parent_enrollments table to use new status enum and add proposal tracking
ALTER TABLE parent_enrollments 
  DROP COLUMN IF EXISTS status CASCADE;

ALTER TABLE parent_enrollments
  ADD COLUMN status enrollment_status NOT NULL DEFAULT 'awaiting_assignment',
  ADD COLUMN IF NOT EXISTS proposal_id UUID,
  ADD COLUMN IF NOT EXISTS proposal_sent_at TIMESTAMP;

-- Add updated_at only if it doesn't exist
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'parent_enrollments' 
    AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE parent_enrollments ADD COLUMN updated_at TIMESTAMP DEFAULT NOW();
  END IF;
END $$;

-- Create onboarding_proposals table
CREATE TABLE IF NOT EXISTS onboarding_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID NOT NULL REFERENCES parent_enrollments(id),
  tutor_id VARCHAR NOT NULL REFERENCES public.users(id),
  student_id VARCHAR NOT NULL REFERENCES students(id),
  
  -- Identity & Emotional Profile
  primary_identity VARCHAR,
  math_relationship TEXT,
  confidence_triggers TEXT,
  confidence_killers TEXT,
  pressure_response VARCHAR,
  growth_drivers TEXT,
  
  -- Academic Diagnosis
  current_topics TEXT,
  immediate_struggles TEXT,
  gaps_identified TEXT,
  tutor_notes TEXT,
  
  -- Psychological Anchor
  future_identity TEXT,
  want_to_remembered TEXT,
  hidden_motivations TEXT,
  internal_conflict TEXT,
  
  -- Recommendation
  recommended_plan VARCHAR NOT NULL,
  justification TEXT NOT NULL,
  child_will_win TEXT,
  
  -- Metadata
  sent_at TIMESTAMP,
  viewed_at TIMESTAMP,
  viewed_count INTEGER NOT NULL DEFAULT 0,
  accepted_at TIMESTAMP,
  declined_at TIMESTAMP,
  decline_reason TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_onboarding_proposals_enrollment_id ON onboarding_proposals(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_proposals_tutor_id ON onboarding_proposals(tutor_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_proposals_student_id ON onboarding_proposals(student_id);
CREATE INDEX IF NOT EXISTS idx_parent_enrollments_status ON parent_enrollments(status);
CREATE INDEX IF NOT EXISTS idx_parent_enrollments_proposal_id ON parent_enrollments(proposal_id);

-- Disable RLS - authentication is handled in backend middleware
ALTER TABLE onboarding_proposals DISABLE ROW LEVEL SECURITY;

-- Update updated_at trigger for parent_enrollments
CREATE OR REPLACE FUNCTION update_parent_enrollments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS parent_enrollments_updated_at ON parent_enrollments;
CREATE TRIGGER parent_enrollments_updated_at
  BEFORE UPDATE ON parent_enrollments
  FOR EACH ROW
  EXECUTE FUNCTION update_parent_enrollments_updated_at();

-- Update updated_at trigger for onboarding_proposals
CREATE OR REPLACE FUNCTION update_onboarding_proposals_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER onboarding_proposals_updated_at
  BEFORE UPDATE ON onboarding_proposals
  FOR EACH ROW
  EXECUTE FUNCTION update_onboarding_proposals_updated_at();
