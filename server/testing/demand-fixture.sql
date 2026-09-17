-- Isolated PostgreSQL fixture. Synthetic identities only; no production connection.
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role;
CREATE TABLE users (
 id varchar(64) PRIMARY KEY, role text, name text, email text, first_name text, last_name text,
 production_link_code text, tracking_source text, tracking_campaign text,
 phone text, bio text, profile_image_url text, password text, grade text, school text, verified boolean DEFAULT false,
 created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
);
CREATE TABLE parents (id uuid DEFAULT gen_random_uuid(), user_id varchar(64) UNIQUE REFERENCES users(id),
 onboarding_type text NOT NULL DEFAULT 'commercial', affiliate_code text, affiliate_type text, full_name text,
 created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());
CREATE TABLE leads (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id varchar(64) REFERENCES users(id),
 affiliate_id text, encounter_id text, production_link_code text, tracking_source text, tracking_campaign text,
 onboarding_type text DEFAULT 'pilot', full_name text, lead_type text, affiliate_type text, affiliate_name text,
 created_at timestamptz DEFAULT now());
CREATE TABLE affiliate_codes (id uuid DEFAULT gen_random_uuid(), code text PRIMARY KEY, affiliate_id text,
 pipeline_type text, status text, owner_type text, owner_user_id text, owner_name text, ownership_status text,
 type text, affiliate_type text, person_name text, entity_name text, campaign_name text, created_by text,
 created_at timestamptz DEFAULT now());
CREATE TABLE encounters (id uuid DEFAULT gen_random_uuid(), affiliate_id text, parent_email text, created_at timestamptz DEFAULT now());
CREATE TABLE parent_enrollments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id varchar(64) UNIQUE REFERENCES users(id),
 parent_full_name text, parent_phone text, parent_email text, parent_city text, student_full_name text, student_grade text,
 student_gender text, school_name text, response_symptoms jsonb, topic_response_symptoms jsonb, response_signal_scores jsonb,
 topic_response_signal_scores jsonb, recommended_starting_phase text, topic_recommended_starting_phases jsonb,
 previous_tutoring text, internet_access text, parent_motivation text, status text DEFAULT 'awaiting_assignment',
 current_step text, is_sandbox_account boolean DEFAULT false, assigned_tutor_id text, assigned_student_id text,
 assignment_lane text DEFAULT 'commercial', proposal_id uuid, package_key text DEFAULT 'monthly_8', package_sessions integer DEFAULT 8,
 planned_sessions_per_week integer DEFAULT 2, confirmed_at timestamptz, proposal_sent_at timestamptz,
 created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
);
CREATE TABLE onboarding_proposals (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), enrollment_id uuid, student_id text, tutor_id text, parent_id text,
 accepted_at timestamptz, parent_code text, package_key text DEFAULT 'monthly_8', package_sessions integer DEFAULT 8,
 planned_sessions_per_week integer DEFAULT 2, package_amount numeric DEFAULT 1600,
 topic_conditioning_topic text, topic_conditioning_entry_phase text, topic_conditioning_stability text,
 created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
);
CREATE TABLE payment_transactions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), parent_id text, enrollment_id uuid, proposal_id uuid, student_id text, tutor_id text,
 provider text, payment_status text, plan text, amount numeric, currency text, tutor_share numeric, platform_share numeric,
 package_key text, package_sessions integer, planned_sessions_per_week integer, session_price numeric,
 merchant_reference text UNIQUE, item_name text, item_description text, raw_payload jsonb, payment_date timestamptz,
 paid_at timestamptz, itn_received_at timestamptz, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
);
CREATE TABLE students (id varchar(64) PRIMARY KEY DEFAULT gen_random_uuid()::text, parent_id text, tutor_id text, full_name text,
 grade text, school_name text, gender text, personal_profile jsonb DEFAULT '{}', concept_mastery jsonb DEFAULT '{}',
 created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());
CREATE TABLE tutor_assignments (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tutor_id text, pod_id text, operational_mode text,
 certification_status text, created_at timestamptz DEFAULT now());
CREATE TABLE tutor_battle_test_statuses (tutor_id text PRIMARY KEY, mode text);
CREATE TABLE tutor_trial_cases (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tutor_id text);
CREATE TABLE tutor_trial_placements (id uuid PRIMARY KEY DEFAULT gen_random_uuid());
CREATE TABLE tutor_applications (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id text, production_link_code text, status text);
CREATE TABLE closes (id uuid DEFAULT gen_random_uuid(), affiliate_id text, production_link_code text, production_owner_type text,
 production_owner_name text, parent_id text, lead_id uuid, child_id text, pod_assignment_id uuid, closed_at timestamptz, created_at timestamptz DEFAULT now());
CREATE TABLE training_session_runs (id uuid DEFAULT gen_random_uuid(), student_id text, scheduled_session_id text, status text);
CREATE TABLE intro_session_drills (id uuid DEFAULT gen_random_uuid(), student_id text, scheduled_session_id text, training_session_run_id text, drill text);
CREATE TABLE scheduled_sessions (id uuid DEFAULT gen_random_uuid(), parent_id text, student_id text, tutor_id text, type text, status text, scheduled_time timestamptz, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());
INSERT INTO users(id,role,name,email) VALUES ('coo','coo','Review owner','coo@example.test'),('recipient','hr','Receiving owner','recipient@example.test'),('specialist','tutor','Certified specialist','specialist@example.test'),('legacy','parent','Legacy family','legacy@example.test');
INSERT INTO parents(user_id,onboarding_type) VALUES ('legacy','pilot');
INSERT INTO parent_enrollments(user_id,parent_full_name,status,assigned_tutor_id) VALUES ('legacy','Legacy family','confirmed','specialist');
INSERT INTO affiliate_codes(code,pipeline_type,status,owner_type,owner_name,ownership_status,campaign_name) VALUES
 ('DEMAND01','demand','active','campaign','Community campaign','resolved','September'),
 ('DEMAND02','demand','active','campaign','Later campaign','resolved','October'),
 ('CAPACITY01','capacity','active','campaign','Specialist recruitment','resolved','Capacity');
INSERT INTO tutor_battle_test_statuses VALUES ('specialist','certified_live');
INSERT INTO tutor_assignments(tutor_id,operational_mode,certification_status) VALUES ('specialist','certified_live','passed');
CREATE TABLE pods (id text PRIMARY KEY, pod_name text, pod_type text, vehicle text, phase text, td_id text, status text, start_date timestamptz, end_date timestamptz, deleted_at timestamptz, created_at timestamptz DEFAULT now());
INSERT INTO pods(id,pod_name,vehicle,status) VALUES ('pod','Test Pod','four_seater','active');
UPDATE tutor_assignments SET pod_id='pod';
ALTER TABLE students ADD COLUMN name text, ADD COLUMN parent_contact text, ADD COLUMN parent_enrollment_id uuid, ADD COLUMN session_progress integer DEFAULT 0;
ALTER TABLE intro_session_drills ADD COLUMN tutor_id text, ADD COLUMN submitted_at timestamptz DEFAULT now();
ALTER TABLE onboarding_proposals ADD COLUMN primary_identity text, ADD COLUMN math_relationship text, ADD COLUMN confidence_triggers text,
 ADD COLUMN confidence_killers text, ADD COLUMN pressure_response text, ADD COLUMN growth_drivers text, ADD COLUMN current_topics jsonb,
 ADD COLUMN immediate_struggles text, ADD COLUMN gaps_identified text, ADD COLUMN tutor_notes text, ADD COLUMN future_identity text,
 ADD COLUMN want_to_remembered text, ADD COLUMN hidden_motivations text, ADD COLUMN internal_conflict text, ADD COLUMN recommended_plan text,
 ADD COLUMN justification text, ADD COLUMN child_will_win text, ADD COLUMN specialist_per_session_amount numeric, ADD COLUMN platform_per_session_amount numeric,
 ADD COLUMN sent_at timestamptz;
CREATE TABLE topic_conditioning_activations (id uuid DEFAULT gen_random_uuid(), student_id text,tutor_id text,topic text,reason text);
