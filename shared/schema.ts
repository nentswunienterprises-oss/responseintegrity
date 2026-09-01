import { sql } from "drizzle-orm";
import {
  pgTable,
  varchar,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
  pgEnum,
  index,
  real,
  serial,
  bigint,
  decimal,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ============================================
// ENUMS
// ============================================

// Client Portal: parent, student
// Affiliate Portal: affiliate, od (outreach director)
// Operational Portal: tutor, td (territory director)
// Executive Portal: coo, hr, ceo, cto, cmo
export const roleEnum = pgEnum("role", [
  "parent",
  "student",
  "tutor",
  "td",
  "affiliate",
  "od",
  "coo",
  "hr",
  "ceo",
  "cto",
  "cmo",
]);
export const podTypeEnum = pgEnum("pod_type", ["training", "paid"]);
export const vehicleEnum = pgEnum("vehicle", ["4_seater", "5_seater", "6_seater"]);
export const phaseEnum = pgEnum("phase", ["foundation", "scale_test"]);
export const podStatusEnum = pgEnum("pod_status", ["active", "completed"]);
export const certificationStatusEnum = pgEnum("certification_status", [
  "pending",
  "passed",
  "failed",
]);
export const tutorOperationalModeEnum = pgEnum("tutor_operational_mode", [
  "applicant",
  "training",
  "sandbox",
  "trial",
  "certified_live",
  "watchlist",
  "suspended",
]);
export const verificationStatusEnum = pgEnum("verification_status", [
  "pending",
  "verified",
  "rejected",
]);
export const visibilityEnum = pgEnum("visibility", ["all", "tds", "tutors", "parents", "students", "affiliates", "od", "hr", "ceo"]);
export const applicationStatusEnum = pgEnum("application_status", [
  "pending",
  "approved",
  "rejected",
]);
export const enrollmentStatusEnum = pgEnum("enrollment_status", [
  "not_enrolled",
  "awaiting_assignment",
  "awaiting_tutor_acceptance",
  "assigned",
  "proposal_sent",
  "session_booked",
  "report_received",
  "confirmed",
]);
export const reportTypeEnum = pgEnum("report_type", ["weekly", "monthly"]);
export const onboardingAcceptanceMethodEnum = pgEnum("onboarding_acceptance_method", [
  "checkbox_typed_name",
]);
export const battleTestSubjectEnum = pgEnum("battle_test_subject", ["tutor", "td"]);
export const battleTestScoreEnum = pgEnum("battle_test_score", ["clear", "partial", "fail"]);
export const battleTestStateEnum = pgEnum("battle_test_state", ["locked", "watchlist", "fail"]);
export const tutorCertificationModeEnum = pgEnum("tutor_certification_mode", [
  "applicant",
  "training",
  "sandbox",
  "trial",
  "certified_live",
  "watchlist",
  "suspended",
]);
export const tutorDeepDiveHistoricalStateEnum = pgEnum("tutor_deep_dive_historical_state", [
  "in_progress",
  "completed",
]);
export const tutorDeepDiveHealthStateEnum = pgEnum("tutor_deep_dive_health_state", [
  "locked",
  "watchlist",
  "drift",
]);

// ============================================
// SESSION STORAGE (Required for Replit Auth)
// ============================================

export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)]
);

// ============================================
// USERS TABLE
// ============================================

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique().notNull(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  phone: varchar("phone"),
  bio: text("bio"),
  profileImageUrl: varchar("profile_image_url"),
  
  // Supabase auth fields
  password: varchar("password"), // Hashed password (optional - Supabase handles auth)
  
  // TT-specific fields
  role: roleEnum("role").notNull().default("tutor"),
  name: varchar("name").notNull(),
  grade: varchar("grade"), // For tutors only
  school: varchar("school"), // For tutors only
  verified: boolean("verified").notNull().default(false),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type UpsertUser = typeof users.$inferInsert;

export const upsertUserSchema = createInsertSchema(users).pick({
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  profileImageUrl: true,
});

export const updateUserProfileSchema = createInsertSchema(users).pick({
  name: true,
  role: true,
  grade: true,
  school: true,
});

// ============================================
// PODS TABLE
// ============================================

export const pods = pgTable("pods", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  podName: varchar("pod_name").notNull(),
  podType: podTypeEnum("pod_type").notNull().default("training"),
  vehicle: vehicleEnum("vehicle").notNull().default("4_seater"),
  phase: phaseEnum("phase").notNull().default("foundation"),
  tdId: varchar("td_id").references(() => users.id),
  status: podStatusEnum("status").notNull().default("active"),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Pod = typeof pods.$inferSelect;
export type InsertPod = typeof pods.$inferInsert;

export const insertPodSchema = createInsertSchema(pods).omit({
  id: true,
  createdAt: true,
});

// ============================================
// TUTOR ASSIGNMENTS TABLE
// ============================================

export const tutorAssignments = pgTable("tutor_assignments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tutorId: varchar("tutor_id")
    .notNull()
    .references(() => users.id),
  podId: varchar("pod_id")
    .notNull()
    .references(() => pods.id),
  studentCount: integer("student_count").notNull().default(1),
  certificationStatus: certificationStatusEnum("certification_status")
    .notNull()
    .default("pending"),
  operationalMode: tutorOperationalModeEnum("operational_mode")
    .notNull()
    .default("training"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type TutorAssignment = typeof tutorAssignments.$inferSelect;
export type InsertTutorAssignment = typeof tutorAssignments.$inferInsert;

export const insertTutorAssignmentSchema = createInsertSchema(
  tutorAssignments
).omit({
  id: true,
  createdAt: true,
});

// ============================================
// BATTLE TESTING TABLES
// ============================================

export const battleTestRuns = pgTable("battle_test_runs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  podId: varchar("pod_id")
    .notNull()
    .references(() => pods.id),
  subjectType: battleTestSubjectEnum("subject_type").notNull(),
  subjectUserId: varchar("subject_user_id")
    .notNull()
    .references(() => users.id),
  tutorAssignmentId: varchar("tutor_assignment_id").references(() => tutorAssignments.id),
  createdByUserId: varchar("created_by_user_id")
    .notNull()
    .references(() => users.id),
  templateKey: varchar("template_key").notNull(),
  selectedPhaseKeys: jsonb("selected_phase_keys").notNull().default(sql`'[]'::jsonb`),
  phaseScores: jsonb("phase_scores").notNull().default(sql`'[]'::jsonb`),
  weakPhases: jsonb("weak_phases").notNull().default(sql`'[]'::jsonb`),
  criticalFailReasons: jsonb("critical_fail_reasons").notNull().default(sql`'[]'::jsonb`),
  totalQuestions: integer("total_questions").notNull().default(0),
  answeredQuestions: integer("answered_questions").notNull().default(0),
  totalPoints: real("total_points").notNull().default(0),
  possiblePoints: real("possible_points").notNull().default(0),
  alignmentPercent: real("alignment_percent").notNull().default(0),
  state: battleTestStateEnum("state").notNull().default("fail"),
  hasCriticalFail: boolean("has_critical_fail").notNull().default(false),
  actionRequired: text("action_required"),
  completedAt: timestamp("completed_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const battleTestRepLogs = pgTable("battle_test_rep_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  runId: varchar("run_id")
    .notNull()
    .references(() => battleTestRuns.id),
  phaseKey: varchar("phase_key").notNull(),
  questionKey: varchar("question_key").notNull(),
  section: varchar("section").notNull(),
  questionOrder: integer("question_order").notNull(),
  prompt: text("prompt").notNull(),
  variantKey: varchar("variant_key").notNull().default("form_a"),
  answerEvidence: text("answer_evidence").notNull().default(""),
  expectedAnswer: text("expected_answer").notNull(),
  failIndicators: jsonb("fail_indicators").notNull().default(sql`'[]'::jsonb`),
  scoringGuide: jsonb("scoring_guide").notNull().default(sql`'{}'::jsonb`),
  score: battleTestScoreEnum("score").notNull(),
  pointsAwarded: real("points_awarded").notNull().default(0),
  note: text("note"),
  isCriticalFail: boolean("is_critical_fail").notNull().default(false),
  criticalFailReason: text("critical_fail_reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const tutorBattleTestStatuses = pgTable("tutor_battle_test_statuses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tutorAssignmentId: varchar("tutor_assignment_id")
    .notNull()
    .references(() => tutorAssignments.id),
  tutorId: varchar("tutor_id")
    .notNull()
    .references(() => users.id),
  mode: tutorCertificationModeEnum("mode").notNull().default("training"),
  moduleProgress: jsonb("module_progress").notNull().default(sql`'[]'::jsonb`),
  nextBattleTests: jsonb("next_battle_tests").notNull().default(sql`'[]'::jsonb`),
  lastSyncedAt: timestamp("last_synced_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  assignmentIdx: index("idx_tutor_battle_test_status_assignment").on(table.tutorAssignmentId),
  tutorIdx: index("idx_tutor_battle_test_status_tutor").on(table.tutorId),
}));

export const tutorBattleTestDeepDiveProgress = pgTable("tutor_battle_test_deep_dive_progress", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tutorAssignmentId: varchar("tutor_assignment_id")
    .notNull()
    .references(() => tutorAssignments.id),
  tutorId: varchar("tutor_id")
    .notNull()
    .references(() => users.id),
  phaseKey: varchar("phase_key").notNull(),
  title: varchar("title").notNull(),
  moduleKey: varchar("module_key").notNull(),
  moduleTitle: varchar("module_title").notNull(),
  historicalState: tutorDeepDiveHistoricalStateEnum("historical_state").notNull().default("in_progress"),
  currentHealthState: tutorDeepDiveHealthStateEnum("current_health_state").notNull().default("drift"),
  currentStreak: integer("current_streak").notNull().default(0),
  consecutiveDriftCount: integer("consecutive_drift_count").notNull().default(0),
  latestScore: real("latest_score"),
  completedAt: timestamp("completed_at"),
  lastTestedAt: timestamp("last_tested_at"),
  attemptsCount: integer("attempts_count").notNull().default(0),
  criticalFlag: boolean("critical_flag").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  assignmentIdx: index("idx_tutor_deep_dive_progress_assignment").on(table.tutorAssignmentId),
  tutorIdx: index("idx_tutor_deep_dive_progress_tutor").on(table.tutorId),
  phaseIdx: index("idx_tutor_deep_dive_progress_phase").on(table.phaseKey),
}));

export type BattleTestRun = typeof battleTestRuns.$inferSelect;
export type InsertBattleTestRun = typeof battleTestRuns.$inferInsert;
export type BattleTestRepLog = typeof battleTestRepLogs.$inferSelect;
export type InsertBattleTestRepLog = typeof battleTestRepLogs.$inferInsert;
export type TutorBattleTestStatus = typeof tutorBattleTestStatuses.$inferSelect;
export type InsertTutorBattleTestStatus = typeof tutorBattleTestStatuses.$inferInsert;
export type TutorBattleTestDeepDiveProgressRow = typeof tutorBattleTestDeepDiveProgress.$inferSelect;
export type InsertTutorBattleTestDeepDiveProgress = typeof tutorBattleTestDeepDiveProgress.$inferInsert;

export const insertBattleTestRunSchema = createInsertSchema(battleTestRuns).omit({
  id: true,
  completedAt: true,
  createdAt: true,
});

export const insertBattleTestRepLogSchema = createInsertSchema(battleTestRepLogs).omit({
  id: true,
  createdAt: true,
});

export const insertTutorBattleTestStatusSchema = createInsertSchema(tutorBattleTestStatuses).omit({
  id: true,
  lastSyncedAt: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTutorBattleTestDeepDiveProgressSchema = createInsertSchema(tutorBattleTestDeepDiveProgress).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// ============================================
// STUDENTS TABLE
// ============================================

export const students = pgTable("students", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  grade: varchar("grade").notNull(),
  tutorId: varchar("tutor_id")
    .notNull()
    .references(() => users.id),
  sessionProgress: integer("session_progress").notNull().default(0),
  conceptMastery: jsonb("concept_mastery"),
  confidenceScore: real("confidence_score"),
  parentContact: varchar("parent_contact"),
  personalProfile: jsonb("personal_profile"),
  emotionalInsights: jsonb("emotional_insights"),
  academicDiagnosis: jsonb("academic_diagnosis"),
  identitySheet: jsonb("identity_sheet"),
  identitySheetCompletedAt: timestamp("identity_sheet_completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Student = typeof students.$inferSelect;
export type InsertStudent = typeof students.$inferInsert;

export const insertStudentSchema = createInsertSchema(students).omit({
  id: true,
  createdAt: true,
  sessionProgress: true,
});

// ============================================
// SESSIONS TABLE
// ============================================

export const sessionsTable = pgTable("tutoring_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tutorId: varchar("tutor_id")
    .notNull()
    .references(() => users.id),
  studentId: varchar("student_id")
    .notNull()
    .references(() => students.id),
  date: timestamp("date").notNull(),
  duration: integer("duration").notNull(), // in minutes
  notes: text("notes"),
  
  // 3-Layer Lens Teaching Model fields
  vocabularyNotes: text("vocabulary_notes"), // Vocabulary layer notes
  methodNotes: text("method_notes"), // Method layer notes
  reasonNotes: text("reason_notes"), // Reason layer notes
  studentResponse: text("student_response"), // How student responded to session
  confidenceChange: integer("confidence_change"), // Scale 1-5 for + or -
  tutorGrowthReflection: text("tutor_growth_reflection"), // Tutor's reflection/notes
  bossBattlesDone: text("boss_battles_done"), // Boss battles done in session
  practiceProblems: text("practice_problems"), // Practice problems assigned
  
  confidenceScoreDelta: real("confidence_score_delta"), // Legacy field
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Session = typeof sessionsTable.$inferSelect;
export type InsertSession = typeof sessionsTable.$inferInsert;

export const insertSessionSchema = createInsertSchema(sessionsTable).omit({
  id: true,
  createdAt: true,
});

// ============================================
// REFLECTIONS TABLE
// ============================================

export const reflections = pgTable("reflections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tutorId: varchar("tutor_id")
    .notNull()
    .references(() => users.id),
  date: timestamp("date").notNull(),
  reflectionText: text("reflection_text").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Reflection = typeof reflections.$inferSelect;
export type InsertReflection = typeof reflections.$inferInsert;

export const insertReflectionSchema = createInsertSchema(reflections).omit({
  id: true,
  createdAt: true,
});

// ============================================
// WEEKLY CHECK-INS TABLE (Tutor Weekly Reports)
// ============================================

export const weeklyCheckIns = pgTable("weekly_check_ins", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tutorId: varchar("tutor_id")
    .notNull()
    .references(() => users.id),
  podId: varchar("pod_id")
    .notNull()
    .references(() => pods.id),
  weekStartDate: timestamp("week_start_date").notNull(), // Start of the week
  sessionsSummary: text("sessions_summary"), // How sessions went this week
  wins: text("wins"), // Wins this week
  challenges: text("challenges"), // Challenges faced
  emotions: text("emotions"), // Emotions felt and thoughts
  skillImprovement: text("skill_improvement"), // Working on improving about student transformation
  helpNeeded: text("help_needed"), // Help needed or questions
  nextWeekGoals: text("next_week_goals"), // Goals for next week
  submittedAt: timestamp("submitted_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type WeeklyCheckIn = typeof weeklyCheckIns.$inferSelect;
export type InsertWeeklyCheckIn = typeof weeklyCheckIns.$inferInsert;

export const insertWeeklyCheckInSchema = createInsertSchema(weeklyCheckIns).omit({
  id: true,
  submittedAt: true,
  createdAt: true,
}).extend({
  sessionsSummary: z.string().min(1, "Please describe your sessions"),
  wins: z.string().min(1, "Please share your wins"),
  challenges: z.string().min(1, "Please describe challenges"),
  emotions: z.string().min(1, "Please share your emotions and thoughts"),
  skillImprovement: z.string().min(1, "Please describe what you're working on"),
  helpNeeded: z.string().optional(),
  nextWeekGoals: z.string().min(1, "Please set goals for next week"),
});

// ============================================
// ACADEMIC PROFILES TABLE (School Tracker)
// ============================================

export const academicProfiles = pgTable("academic_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  studentId: varchar("student_id")
    .notNull()
    .references(() => students.id)
    .unique(),
  fullName: varchar("full_name").notNull(),
  grade: varchar("grade").notNull(),
  school: varchar("school"),
  latestTermReport: text("latest_term_report"),
  myThoughts: text("my_thoughts"),
  currentChallenges: text("current_challenges"),
  recentWins: text("recent_wins"),
  upcomingExamsProjects: text("upcoming_exams_projects"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type AcademicProfile = typeof academicProfiles.$inferSelect;
export type InsertAcademicProfile = typeof academicProfiles.$inferInsert;

export const insertAcademicProfileSchema = createInsertSchema(
  academicProfiles
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// ============================================
// STRUGGLE TARGETS TABLE (Target Center)
// ============================================

export const struggleTargets = pgTable("struggle_targets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  studentId: varchar("student_id")
    .notNull()
    .references(() => students.id),
  subject: varchar("subject").notNull(),
  topicConcept: varchar("topic_concept").notNull(),
  myStruggle: text("my_struggle").notNull(),
  strategy: text("strategy").notNull(),
  consolidationDate: timestamp("consolidation_date"),
  overcame: boolean("overcame").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type StruggleTarget = typeof struggleTargets.$inferSelect;
export type InsertStruggleTarget = typeof struggleTargets.$inferInsert;

export const insertStruggleTargetSchema = createInsertSchema(
  struggleTargets
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  overcame: true,
});

// ============================================
// VERIFICATION DOCS TABLE
// ============================================

export const verificationDocs = pgTable("verification_docs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tutorId: varchar("tutor_id")
    .notNull()
    .references(() => users.id),
  fileUrlAgreement: varchar("file_url_agreement"),
  fileUrlConsent: varchar("file_url_consent"),
  status: verificationStatusEnum("status").notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type VerificationDoc = typeof verificationDocs.$inferSelect;
export type InsertVerificationDoc = typeof verificationDocs.$inferInsert;

export const insertVerificationDocSchema = createInsertSchema(
  verificationDocs
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  status: true,
});

// ============================================
// TUTOR APPLICATIONS TABLE
// ============================================

export const tutorApplications = pgTable("tutor_applications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),

  // Section 1 - Basic Information
  fullName: varchar("full_name").notNull(),
  age: integer("age").notNull(),
  phone: varchar("phone").notNull(),
  email: varchar("email").notNull(),
  city: varchar("city").notNull(),
  idType: varchar("id_type"),

  // Section 2 - Academic Background
  completedMatric: varchar("completed_matric").notNull(),       // 'yes' | 'currently' | 'no'
  matricYear: varchar("matric_year"),
  mathLevel: varchar("math_level").notNull(),                   // 'core' | 'literacy'
  mathResult: varchar("math_result"),
  otherSubjects: text("other_subjects"),

  // Section 3 - Current Situation
  currentSituation: varchar("current_situation").notNull(),     // 'gap_year' | 'waiting_uni' | 'studying' | 'working' | 'other'
  currentSituationOther: varchar("current_situation_other"),
  interestReason: text("interest_reason").notNull(),

  // Section 4 - Teaching & Communication
  helpedBefore: varchar("helped_before").notNull(),             // 'yes' | 'no'
  helpExplanation: text("help_explanation"),
  studentDontGet: text("student_dont_get").notNull(),

  // Section 5 - Response Under Pressure
  pressureStory: text("pressure_story").notNull(),
  pressureResponse: text("pressure_response").array().notNull(),
  panicCause: text("panic_cause").notNull(),

  // Section 6 - Discipline & Responsibility
  disciplineReason: text("discipline_reason").notNull(),
  repeatMistakeResponse: text("repeat_mistake_response").notNull(),

  // Section 7 - Alignment With Response Integrity
  ttMeaning: text("tt_meaning").notNull(),
  structurePreference: varchar("structure_preference").notNull(), // 'structure' | 'flexibility'

  // Section 8 - Availability
  hoursPerWeek: varchar("hours_per_week").notNull(),
  availableAfternoon: varchar("available_afternoon").notNull(), // 'yes' | 'no' | 'sometimes'

  // Section 9 - Final Filter
  finalReason: text("final_reason").notNull(),

  // Section 10 - Commitment
  commitment: varchar("commitment").notNull(),                  // 'yes' | 'no'

  // Application Status
  status: applicationStatusEnum("status").notNull().default("pending"),
  reviewedBy: varchar("reviewed_by").references(() => users.id), // COO who approved/rejected
  reviewedAt: timestamp("reviewed_at"),
  rejectionReason: text("rejection_reason"),
  
  onboardingCompletedAt: timestamp("onboarding_completed_at"),

  // Sequential Document Submission (6-step process)
  documentSubmissionStep: integer("document_submission_step").default(0),
  documentsStatus: jsonb("documents_status").default('{"1": "not_started", "2": "not_started", "3": "not_started", "4": "not_started", "5": "not_started", "6": "not_started"}'),

  // Step 1: Response Integrity-TCF-001
  doc1SubmissionUrl: varchar("doc_1_submission_url"),
  doc1SubmissionUploadedAt: timestamp("doc_1_submission_uploaded_at"),
  doc1SubmissionVerified: boolean("doc_1_submission_verified").default(false),
  doc1SubmissionVerifiedBy: varchar("doc_1_submission_verified_by").references(() => users.id),
  doc1SubmissionVerifiedAt: timestamp("doc_1_submission_verified_at"),
  doc1SubmissionRejectionReason: text("doc_1_submission_rejection_reason"),
  doc1CompletedTemplateUrl: varchar("doc_1_completed_template_url"),
  doc1CompletedTemplateUploadedAt: timestamp("doc_1_completed_template_uploaded_at"),
  doc1CompletedTemplateUploadedBy: varchar("doc_1_completed_template_uploaded_by").references(() => users.id),

  // Step 2: Response Integrity-EQV-002
  doc2SubmissionUrl: varchar("doc_2_submission_url"),
  doc2SubmissionUploadedAt: timestamp("doc_2_submission_uploaded_at"),
  doc2SubmissionVerified: boolean("doc_2_submission_verified").default(false),
  doc2SubmissionVerifiedBy: varchar("doc_2_submission_verified_by").references(() => users.id),
  doc2SubmissionVerifiedAt: timestamp("doc_2_submission_verified_at"),
  doc2SubmissionRejectionReason: text("doc_2_submission_rejection_reason"),
  doc2CompletedTemplateUrl: varchar("doc_2_completed_template_url"),
  doc2CompletedTemplateUploadedAt: timestamp("doc_2_completed_template_uploaded_at"),
  doc2CompletedTemplateUploadedBy: varchar("doc_2_completed_template_uploaded_by").references(() => users.id),

  // Step 3: Response Integrity-ICA-003
  doc3SubmissionUrl: varchar("doc_3_submission_url"),
  doc3SubmissionUploadedAt: timestamp("doc_3_submission_uploaded_at"),
  doc3SubmissionVerified: boolean("doc_3_submission_verified").default(false),
  doc3SubmissionVerifiedBy: varchar("doc_3_submission_verified_by").references(() => users.id),
  doc3SubmissionVerifiedAt: timestamp("doc_3_submission_verified_at"),
  doc3SubmissionRejectionReason: text("doc_3_submission_rejection_reason"),
  doc3CompletedTemplateUrl: varchar("doc_3_completed_template_url"),
  doc3CompletedTemplateUploadedAt: timestamp("doc_3_completed_template_uploaded_at"),
  doc3CompletedTemplateUploadedBy: varchar("doc_3_completed_template_uploaded_by").references(() => users.id),

  // Step 4: Response Integrity-SCP-004
  doc4SubmissionUrl: varchar("doc_4_submission_url"),
  doc4SubmissionUploadedAt: timestamp("doc_4_submission_uploaded_at"),
  doc4SubmissionVerified: boolean("doc_4_submission_verified").default(false),
  doc4SubmissionVerifiedBy: varchar("doc_4_submission_verified_by").references(() => users.id),
  doc4SubmissionVerifiedAt: timestamp("doc_4_submission_verified_at"),
  doc4SubmissionRejectionReason: text("doc_4_submission_rejection_reason"),
  doc4CompletedTemplateUrl: varchar("doc_4_completed_template_url"),
  doc4CompletedTemplateUploadedAt: timestamp("doc_4_completed_template_uploaded_at"),
  doc4CompletedTemplateUploadedBy: varchar("doc_4_completed_template_uploaded_by").references(() => users.id),

  // Step 5: Response Integrity-DPC-005
  doc5SubmissionUrl: varchar("doc_5_submission_url"),
  doc5SubmissionUploadedAt: timestamp("doc_5_submission_uploaded_at"),
  doc5SubmissionVerified: boolean("doc_5_submission_verified").default(false),
  doc5SubmissionVerifiedBy: varchar("doc_5_submission_verified_by").references(() => users.id),
  doc5SubmissionVerifiedAt: timestamp("doc_5_submission_verified_at"),
  doc5SubmissionRejectionReason: text("doc_5_submission_rejection_reason"),

  doc5CompletedTemplateUrl: varchar("doc_5_completed_template_url"),
  doc5CompletedTemplateUploadedAt: timestamp("doc_5_completed_template_uploaded_at"),
  doc5CompletedTemplateUploadedBy: varchar("doc_5_completed_template_uploaded_by").references(() => users.id),

  // Step 6: Certified ID Copy (tutor submits complete copy)
  doc6SubmissionUrl: varchar("doc_6_submission_url"),
  doc6SubmissionUploadedAt: timestamp("doc_6_submission_uploaded_at"),
  doc6SubmissionVerified: boolean("doc_6_submission_verified").default(false),
  doc6SubmissionVerifiedBy: varchar("doc_6_submission_verified_by").references(() => users.id),
  doc6SubmissionVerifiedAt: timestamp("doc_6_submission_verified_at"),
  doc6SubmissionRejectionReason: text("doc_6_submission_rejection_reason"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type TutorApplication = typeof tutorApplications.$inferSelect;
export type InsertTutorApplication = typeof tutorApplications.$inferInsert;

export const insertTutorApplicationSchema = createInsertSchema(tutorApplications).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  reviewedBy: true,
  reviewedAt: true,
  rejectionReason: true,
});

export const tutorOnboardingAcceptances = pgTable("tutor_onboarding_acceptances", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  applicationId: varchar("application_id").notNull().references(() => tutorApplications.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  documentStep: integer("document_step").notNull(),
  documentCode: varchar("document_code").notNull(),
  documentTitle: varchar("document_title").notNull(),
  documentVersion: varchar("document_version").notNull(),
  documentEffectiveDate: varchar("document_effective_date"),
  documentLastUpdatedAt: timestamp("document_last_updated_at"),
  documentSnapshot: text("document_snapshot").notNull(),
  documentChecksum: varchar("document_checksum").notNull(),
  acceptedAt: timestamp("accepted_at").defaultNow().notNull(),
  acceptedTimezone: varchar("accepted_timezone"),
  acceptanceMethod: onboardingAcceptanceMethodEnum("acceptance_method").notNull().default("checkbox_typed_name"),
  typedFullName: varchar("typed_full_name").notNull(),
  accountEmail: varchar("account_email").notNull(),
  phoneNumberSnapshot: varchar("phone_number_snapshot"),
  ipAddress: varchar("ip_address"),
  userAgent: text("user_agent"),
  deviceType: varchar("device_type"),
  platform: varchar("platform"),
  sessionId: varchar("session_id"),
  locale: varchar("locale"),
  sourceFlow: varchar("source_flow"),
  formSnapshotJson: jsonb("form_snapshot_json"),
  acceptedClausesJson: jsonb("accepted_clauses_json").$type<string[]>().default(sql`'[]'::jsonb`),
  scrollCompletionPercent: integer("scroll_completion_percent"),
  viewStartedAt: timestamp("view_started_at"),
  viewCompletedAt: timestamp("view_completed_at"),
  acceptClickedAt: timestamp("accept_clicked_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const tutorOnboardingClauseAcknowledgements = pgTable("tutor_onboarding_clause_acknowledgements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  acceptanceId: varchar("acceptance_id").notNull().references(() => tutorOnboardingAcceptances.id),
  clauseKey: varchar("clause_key").notNull(),
  clauseLabel: text("clause_label").notNull(),
  acknowledgedAt: timestamp("acknowledged_at").defaultNow().notNull(),
});

export const tutorOnboardingAcceptanceEvents = pgTable("tutor_onboarding_acceptance_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  acceptanceId: varchar("acceptance_id").references(() => tutorOnboardingAcceptances.id),
  applicationId: varchar("application_id").notNull().references(() => tutorApplications.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  documentStep: integer("document_step").notNull(),
  eventType: varchar("event_type").notNull(),
  payload: jsonb("payload"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type TutorOnboardingAcceptance = typeof tutorOnboardingAcceptances.$inferSelect;
export type InsertTutorOnboardingAcceptance = typeof tutorOnboardingAcceptances.$inferInsert;
export type TutorOnboardingClauseAcknowledgement = typeof tutorOnboardingClauseAcknowledgements.$inferSelect;
export type InsertTutorOnboardingClauseAcknowledgement = typeof tutorOnboardingClauseAcknowledgements.$inferInsert;
export type TutorOnboardingAcceptanceEvent = typeof tutorOnboardingAcceptanceEvents.$inferSelect;
export type InsertTutorOnboardingAcceptanceEvent = typeof tutorOnboardingAcceptanceEvents.$inferInsert;

// ============================================
// BROADCASTS TABLE
// ============================================

export const broadcasts = pgTable("broadcasts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  subject: varchar("subject"),
  message: text("message").notNull(),
  senderRole: roleEnum("sender_role").notNull(),
  visibility: visibilityEnum("visibility").notNull().default("all"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Broadcast = typeof broadcasts.$inferSelect;
export type InsertBroadcast = typeof broadcasts.$inferInsert;

export const insertBroadcastSchema = z.object({
  subject: z.string().min(1, "Subject is required"),
  message: z.string().min(1, "Message is required"),
  senderRole: z.enum(["parent", "student", "tutor", "td", "affiliate", "od", "coo", "hr", "ceo"]),
  visibility: z.enum(["all", "tds", "tutors", "parents", "students", "affiliates", "od", "hr", "ceo"]),
});

// ============================================
// COO BRAIN LIBRARY TABLE
// ============================================

export const cooBrainLibraryItemKindEnum = pgEnum("coo_brain_library_item_kind", ["rich_text", "pdf"]);

export const cooBrainLibraryItems = pgTable("coo_brain_library_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  kind: cooBrainLibraryItemKindEnum("kind").notNull(),
  content: text("content"),
  pdfUrl: text("pdf_url"),
  pdfFileName: varchar("pdf_file_name"),
  createdBy: varchar("created_by")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type CooBrainLibraryItem = typeof cooBrainLibraryItems.$inferSelect;
export type InsertCooBrainLibraryItem = typeof cooBrainLibraryItems.$inferInsert;

export const insertCooBrainRichTextSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  content: z.string().trim().min(1, "Document content is required"),
});

export const uploadCooBrainPdfSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  fileName: z.string().trim().min(1, "PDF file name is required"),
  fileData: z.string().trim().min(1, "PDF file data is required"),
  fileType: z.string().trim().optional(),
});

// ============================================
// NOTIFICATIONS TABLE
// ============================================

export const notificationChannelEnum = pgEnum("notification_channel", ["action_required", "informational"]);
export const communicationAudienceEnum = pgEnum("communication_audience", ["parent", "student"]);

export const notifications = pgTable("notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  recipientUserId: varchar("recipient_user_id")
    .notNull()
    .references(() => users.id),
  actorUserId: varchar("actor_user_id").references(() => users.id),
  channel: notificationChannelEnum("channel").notNull().default("informational"),
  title: varchar("title").notNull(),
  message: text("message").notNull(),
  link: varchar("link"),
  entityType: varchar("entity_type"),
  entityId: varchar("entity_id"),
  isRead: boolean("is_read").notNull().default(false),
  readAt: timestamp("read_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;

export const insertNotificationSchema = z.object({
  recipientUserId: z.string().min(1),
  actorUserId: z.string().optional(),
  channel: z.enum(["action_required", "informational"]).default("informational"),
  title: z.string().min(1, "Title is required"),
  message: z.string().min(1, "Message is required"),
  link: z.string().optional(),
  entityType: z.string().optional(),
  entityId: z.string().optional(),
});

// ============================================
// STUDENT COMMUNICATION THREADS
// ============================================

export const studentCommunicationThreads = pgTable("student_communication_threads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  studentId: varchar("student_id")
    .notNull()
    .references(() => students.id),
  tutorId: varchar("tutor_id")
    .notNull()
    .references(() => users.id),
  parentId: varchar("parent_id")
    .references(() => users.id),
  audience: communicationAudienceEnum("audience").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type StudentCommunicationThread = typeof studentCommunicationThreads.$inferSelect;
export type InsertStudentCommunicationThread = typeof studentCommunicationThreads.$inferInsert;

export const studentCommunicationMessages = pgTable("student_communication_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  threadId: varchar("thread_id")
    .notNull()
    .references(() => studentCommunicationThreads.id),
  studentId: varchar("student_id")
    .notNull()
    .references(() => students.id),
  tutorId: varchar("tutor_id")
    .notNull()
    .references(() => users.id),
  parentId: varchar("parent_id").references(() => users.id),
  audience: communicationAudienceEnum("audience").notNull(),
  senderRole: roleEnum("sender_role").notNull(),
  senderUserId: varchar("sender_user_id").references(() => users.id),
  senderStudentUserId: varchar("sender_student_user_id").references(() => studentUsers.id),
  replyToMessageId: varchar("reply_to_message_id").references((): any => studentCommunicationMessages.id),
  message: text("message").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  readByTutorAt: timestamp("read_by_tutor_at"),
  readByParentAt: timestamp("read_by_parent_at"),
  readByStudentAt: timestamp("read_by_student_at"),
});

export type StudentCommunicationMessage = typeof studentCommunicationMessages.$inferSelect;
export type InsertStudentCommunicationMessage = typeof studentCommunicationMessages.$inferInsert;

export const insertStudentCommunicationMessageSchema = z.object({
  audience: z.enum(["parent", "student"]),
  replyToMessageId: z.string().min(1).optional(),
  message: z.string().trim().min(1, "Message is required").max(4000, "Message is too long"),
});

// ============================================
// WEB PUSH SUBSCRIPTIONS TABLE
// ============================================

export const pushSubscriptions = pgTable("push_subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id")
    .notNull()
    .references(() => users.id),
  endpoint: text("endpoint").notNull().unique(),
  p256dhKey: text("p256dh_key").notNull(),
  authKey: text("auth_key").notNull(),
  expirationTime: bigint("expiration_time", { mode: "number" }),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  lastUsedAt: timestamp("last_used_at").defaultNow().notNull(),
});

export type PushSubscriptionRecord = typeof pushSubscriptions.$inferSelect;
export type InsertPushSubscriptionRecord = typeof pushSubscriptions.$inferInsert;

// ============================================
// BROADCAST READS TABLE (Track which broadcasts users have read)
// ============================================

export const broadcastReads = pgTable("broadcast_reads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id")
    .notNull()
    .references(() => users.id),
  broadcastId: varchar("broadcast_id")
    .notNull()
    .references(() => broadcasts.id),
  readAt: timestamp("read_at").defaultNow().notNull(),
});

export type BroadcastRead = typeof broadcastReads.$inferSelect;
export type InsertBroadcastRead = typeof broadcastReads.$inferInsert;

// ============================================
// ROLE AUTHORIZATION (In-Memory)
// ============================================
// Track which emails are authorized for TD/COO roles

export interface RolePermission {
  email: string;
  role: "td" | "coo" | "od";
  assignedPodId?: string | null;
}

export const roleAuthorizationSchema = z.object({
  email: z.string().email(),
  role: z.enum(["td", "coo", "od"]),
  assignedPodId: z.string().nullable().optional(),
});

// ============================================
// EGP CREWS
// ============================================

export const egpCrewStatusEnum = pgEnum("egp_crew_status", ["active", "archived"]);
export const egpCrewMemberRoleEnum = pgEnum("egp_crew_member_role", ["member", "crew_lead"]);

export const egpCrews = pgTable("egp_crews", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  crewName: varchar("crew_name").notNull(),
  territory: varchar("territory"),
  status: egpCrewStatusEnum("status").notNull().default("active"),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const egpCrewMembers = pgTable("egp_crew_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  crewId: varchar("crew_id")
    .notNull()
    .references(() => egpCrews.id),
  egpId: varchar("egp_id")
    .notNull()
    .references(() => users.id),
  role: egpCrewMemberRoleEnum("role").notNull().default("member"),
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
  removedAt: timestamp("removed_at"),
});

export type EgpCrew = typeof egpCrews.$inferSelect;
export type InsertEgpCrew = typeof egpCrews.$inferInsert;
export type EgpCrewMember = typeof egpCrewMembers.$inferSelect;
export type InsertEgpCrewMember = typeof egpCrewMembers.$inferInsert;

export const insertEgpCrewSchema = createInsertSchema(egpCrews).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  createdBy: true,
});

export const insertEgpCrewMemberSchema = createInsertSchema(egpCrewMembers).omit({
  id: true,
  joinedAt: true,
  removedAt: true,
});

// ============================================
// AFFILIATE PROSPECTING SYSTEM
// ============================================

// Enums for affiliate prospecting
export const encounterStatusEnum = pgEnum("encounter_status", [
  "prospect",
  "objected",
]);

// Affiliate Codes - Unique code for each affiliate to give to parents
export const affiliateCodes = pgTable("affiliate_codes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  affiliateId: varchar("affiliate_id")
    .notNull()
    .references(() => users.id),
  code: varchar("code").notNull().unique(), // e.g., "AFIX001"
  type: varchar("type", { length: 16 }), // 'person' or 'entity'
  personName: varchar("person_name", { length: 128 }),
  entityName: varchar("entity_name", { length: 128 }),
  schoolType: varchar("school_type", { length: 16 }), // 'primary' or 'high'
  pipelineType: varchar("pipeline_type", { length: 16 }).notNull().default("demand"),
  campaignName: varchar("campaign_name", { length: 128 }),
  status: varchar("status", { length: 16 }).notNull().default("active"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type AffiliateCode = typeof affiliateCodes.$inferSelect;
export type InsertAffiliateCode = typeof affiliateCodes.$inferInsert;

export const insertAffiliateCodeSchema = createInsertSchema(affiliateCodes).omit({
  id: true,
  createdAt: true,
});

// Encounters - Parent meets affiliate, gets their code
export const encounters = pgTable("encounters", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  affiliateId: varchar("affiliate_id")
    .notNull()
    .references(() => users.id),
  // Parent Info
  parentName: varchar("parent_name").notNull(),
  parentEmail: varchar("parent_email"),
  parentPhone: varchar("parent_phone"),
  // Child Info
  childName: varchar("child_name"),
  childGrade: varchar("child_grade"),
  // Encounter Properties
  dateMet: timestamp("date_met"),
  contactMethod: varchar("contact_method"), // "phone", "dm", "referral", "school_outreach", etc.
  discoveryOutcome: text("discovery_outcome"), // Parent's pain points
  deliveryNotes: text("delivery_notes"), // How Response Integrity's solution was positioned
  finalOutcome: varchar("final_outcome"), // "enrolled", "objected", "follow_up_needed"
  result: text("result"), // What's next
  confidenceRating: integer("confidence_rating"), // 1-5
  myThoughts: text("my_thoughts"), // Self-review: what I did well, what to adjust
  // Legacy
  notes: text("notes"),
  status: encounterStatusEnum("status").notNull().default("prospect"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Encounter = typeof encounters.$inferSelect;
export type InsertEncounter = typeof encounters.$inferInsert;

export const insertEncounterSchema = createInsertSchema(encounters)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    affiliateId: true, // Set by server from session
  })
  .extend({
    parentName: z.string().min(1, "Parent name is required"),
    parentEmail: z.string().email().optional(),
    parentPhone: z.string().optional(),
    dateMet: z.string().optional().transform((val) => val ? new Date(val) : undefined),
    contactMethod: z.string().optional(),
    discoveryOutcome: z.string().optional(),
    deliveryNotes: z.string().optional(),
    finalOutcome: z.string().optional(),
    result: z.string().optional(),
    confidenceRating: z.number().min(1).max(5).optional(),
    myThoughts: z.string().optional(),
  });

// Leads - Parent created account with affiliate's code
export const leads = pgTable("leads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  affiliateId: varchar("affiliate_id")
    .notNull()
    .references(() => users.id),
  productionLinkCode: varchar("production_link_code", { length: 20 }),
  userId: varchar("user_id")
    .notNull()
    .references(() => users.id)
    .unique(), // One lead per parent
  encounterId: varchar("encounter_id").references(() => encounters.id),
  // Tracking fields - how lead was acquired
  trackingSource: varchar("tracking_source"), // "affiliate", "blog", "school", "media", "organic"
  trackingCampaign: varchar("tracking_campaign"), // Campaign identifier (for analytics)
  leadType: varchar("lead_type"), // "parent", "tutor", etc. (for extensibility)
  convertedAt: timestamp("converted_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Lead = typeof leads.$inferSelect;
export type InsertLead = typeof leads.$inferInsert;

export const insertLeadSchema = createInsertSchema(leads).omit({
  id: true,
  convertedAt: true,
  createdAt: true,
});

// Closes - Parent committed to tutoring journey (assigned tutor)
export const closes = pgTable("closes", {
  id: serial("id").primaryKey(),
  affiliateId: varchar("affiliate_id")
    .notNull()
    .references(() => users.id),
  parentId: varchar("parent_id").references(() => users.id),
  leadId: bigint("lead_id", { mode: "number" }).references(() => leads.id),
  childId: bigint("child_id", { mode: "number" }).references(() => students.id),
  podAssignmentId: bigint("pod_assignment_id", { mode: "number" }),
  commissionAmount: decimal("commission_amount", { precision: 10, scale: 2 }),
  commissionStatus: varchar("commission_status", { length: 50 }).default("pending"),
  closedAt: timestamp("closed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export type Close = typeof closes.$inferSelect;
export type InsertClose = typeof closes.$inferInsert;

export const insertCloseSchema = createInsertSchema(closes).omit({
  id: true,
  closedAt: true,
  createdAt: true,
});

// Affiliate Reflections - Reflections on first read of Sales Psychology blueprint
export const affiliateReflections = pgTable("affiliate_reflections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  affiliateId: varchar("affiliate_id")
    .notNull()
    .references(() => users.id)
    .unique(), // One set of initial reflections per affiliate
  reflectionText: text("reflection_text").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type AffiliateReflection = typeof affiliateReflections.$inferSelect;
export type InsertAffiliateReflection = typeof affiliateReflections.$inferInsert;

export const insertAffiliateReflectionSchema = createInsertSchema(
  affiliateReflections
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// ============================================
// FUTURE EXPANSION PLACEHOLDERS (6-Seater)
// ============================================
// These fields anticipate 6-Seater + DDAN integration
// but stay dormant in Phase 1

export const futureExpansionFields = pgTable("future_expansion", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  PayfastPaymentStatus: varchar("Payfast_payment_status"),
  affiliateId: varchar("affiliate_id"),
  revenueSplit: jsonb("revenue_split"),
  mplEmWaveId: varchar("mpl_em_wave_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ============================================
// High School Leadership Pilot Requests
// ============================================
// Stores submissions from schools expressing interest in the Leadership Development Pilot
export const leadershipPilotRequests = pgTable("leadership_pilot_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  schoolName: varchar("school_name").notNull(),
  contactPersonName: varchar("contact_person_name"),
  contactPersonPhone: varchar("contact_person_phone"),
  contactPersonRole: varchar("contact_person_role").notNull(),
  email: varchar("email").notNull(),
  submittedBy: varchar("submitted_by").references(() => users.id),
  submitterName: varchar("submitter_name"),
  submitterRole: varchar("submitter_role"),
  status: varchar("status").notNull().default("new"),
  submittedAt: timestamp("submitted_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type LeadershipPilotRequest = typeof leadershipPilotRequests.$inferSelect;
export type InsertLeadershipPilotRequest = typeof leadershipPilotRequests.$inferInsert;

export const insertLeadershipPilotRequestSchema = createInsertSchema(leadershipPilotRequests).omit({
  id: true,
  createdAt: true,
  submittedAt: true,
  submittedBy: true,
  status: true,
});

// Early Intervention Pilot Requests
export const earlyInterventionRequests = pgTable("early_intervention_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  schoolName: varchar("school_name").notNull(),
  contactPersonName: varchar("contact_person_name"),
  contactPersonPhone: varchar("contact_person_phone"),
  contactPersonRole: varchar("contact_person_role").notNull(),
  email: varchar("email").notNull(),
  submittedBy: varchar("submitted_by").references(() => users.id),
  submitterName: varchar("submitter_name"),
  submitterRole: varchar("submitter_role"),
  status: varchar("status").notNull().default("new"),
  submittedAt: timestamp("submitted_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type EarlyInterventionRequest = typeof earlyInterventionRequests.$inferSelect;
export type InsertEarlyInterventionRequest = typeof earlyInterventionRequests.$inferInsert;

export const insertEarlyInterventionRequestSchema = createInsertSchema(earlyInterventionRequests).omit({
  id: true,
  createdAt: true,
  submittedAt: true,
  submittedBy: true,
  status: true,
});

// ============================================
// PARENT ENROLLMENTS TABLE
// ============================================
// Stores parent enrollment applications from gateway

export const parentEnrollments = pgTable("parent_enrollments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  parentId: varchar("parent_id")
    .notNull()
    .references(() => users.id),
  // Parent Info
  parentFullName: varchar("parent_full_name").notNull(),
  parentPhone: varchar("parent_phone").notNull(),
  parentEmail: varchar("parent_email").notNull(),
  parentCity: varchar("parent_city").notNull(),
  // Student Info
  studentFullName: varchar("student_full_name").notNull(),
  studentGrade: varchar("student_grade").notNull(),
  studentGender: varchar("student_gender"),
  schoolName: varchar("school_name").notNull(),
  responseSymptoms: jsonb("response_symptoms"),
  topicResponseSymptoms: jsonb("topic_response_symptoms"),
  responseSignalScores: jsonb("response_signal_scores"),
  topicResponseSignalScores: jsonb("topic_response_signal_scores"),
  recommendedStartingPhase: varchar("recommended_starting_phase"),
  topicRecommendedStartingPhases: jsonb("topic_recommended_starting_phases"),
  // Background
  previousTutoring: varchar("previous_tutoring").notNull(),
  internetAccess: varchar("internet_access").notNull(),
  parentMotivation: text("parent_motivation"),
  // Assignment tracking
  status: enrollmentStatusEnum("status").notNull().default("awaiting_assignment"),
  assignedTutorId: varchar("assigned_tutor_id").references(() => users.id),
  assignedStudentId: varchar("assigned_student_id").references(() => students.id),
  proposalId: varchar("proposal_id"),
  assignedAt: timestamp("assigned_at"),
  assignmentLane: varchar("assignment_lane", { length: 16 }).notNull().default("commercial"),
  proposalSentAt: timestamp("proposal_sent_at"),
  confirmedAt: timestamp("confirmed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type ParentEnrollment = typeof parentEnrollments.$inferSelect;
export type InsertParentEnrollment = typeof parentEnrollments.$inferInsert;

export const insertParentEnrollmentSchema = createInsertSchema(parentEnrollments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// ============================================
// TUTOR TRIAL CERTIFICATION TABLES
// ============================================

export const tutorTrialCases = pgTable("tutor_trial_cases", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tutorId: varchar("tutor_id").notNull().references(() => users.id),
  tutorAssignmentId: varchar("tutor_assignment_id").notNull().references(() => tutorAssignments.id),
  status: varchar("status", { length: 32 }).notNull().default("active"),
  riskState: varchar("risk_state", { length: 24 }).notNull().default("clear"),
  riskNote: text("risk_note"),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  reviewableAt: timestamp("reviewable_at"),
  closedAt: timestamp("closed_at"),
  createdByUserId: varchar("created_by_user_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const tutorTrialPlacements = pgTable("tutor_trial_placements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  caseId: varchar("case_id").notNull().references(() => tutorTrialCases.id),
  enrollmentId: varchar("enrollment_id").notNull().references(() => parentEnrollments.id),
  parentId: varchar("parent_id").notNull(),
  studentId: varchar("student_id").notNull().references(() => students.id),
  familyKey: varchar("family_key").notNull(),
  status: varchar("status", { length: 24 }).notNull().default("active"),
  requiredSessionCount: integer("required_session_count").notNull().default(9),
  feedbackState: varchar("feedback_state", { length: 24 }).notNull().default("pending"),
  feedbackNote: text("feedback_note"),
  feedbackRecordedAt: timestamp("feedback_recorded_at"),
  testimonialPermission: varchar("testimonial_permission", { length: 24 }).notNull().default("not_requested"),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  endedAt: timestamp("ended_at"),
  createdByUserId: varchar("created_by_user_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const tutorTrialReviews = pgTable("tutor_trial_reviews", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  placementId: varchar("placement_id").notNull().references(() => tutorTrialPlacements.id),
  outcomeClassification: varchar("outcome_classification", { length: 24 }).notNull(),
  decision: varchar("decision", { length: 32 }).notNull(),
  evidenceNote: text("evidence_note").notNull(),
  reviewedByUserId: varchar("reviewed_by_user_id").notNull().references(() => users.id),
  reviewedAt: timestamp("reviewed_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const tutorCertificationDecisions = pgTable("tutor_certification_decisions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  caseId: varchar("case_id").notNull().references(() => tutorTrialCases.id),
  decision: varchar("decision", { length: 32 }).notNull(),
  rationale: text("rationale").notNull(),
  idempotencyKey: varchar("idempotency_key").notNull(),
  decidedByUserId: varchar("decided_by_user_id").notNull().references(() => users.id),
  decidedAt: timestamp("decided_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type TutorTrialCase = typeof tutorTrialCases.$inferSelect;
export type TutorTrialPlacement = typeof tutorTrialPlacements.$inferSelect;
export type TutorTrialReview = typeof tutorTrialReviews.$inferSelect;
export type TutorCertificationDecision = typeof tutorCertificationDecisions.$inferSelect;

// ============================================
// ONBOARDING PROPOSALS TABLE
// ============================================
// Stores tutor-created parent onboarding proposals

export const onboardingProposals = pgTable("onboarding_proposals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  enrollmentId: varchar("enrollment_id")
    .references(() => parentEnrollments.id),
  tutorId: varchar("tutor_id")
    .notNull()
    .references(() => users.id),
  studentId: varchar("student_id")
    .notNull()
    .references(() => students.id),
  // Identity & Emotional Profile
  primaryIdentity: varchar("primary_identity"),
  mathRelationship: text("math_relationship"),
  confidenceTriggers: text("confidence_triggers"),
  confidenceKillers: text("confidence_killers"),
  pressureResponse: varchar("pressure_response"),
  growthDrivers: text("growth_drivers"),
  // Academic Diagnosis
  currentTopics: text("current_topics"),
  topicConditioningTopic: text("topic_conditioning_topic"),
  topicConditioningEntryPhase: varchar("topic_conditioning_entry_phase"),
  topicConditioningStability: varchar("topic_conditioning_stability"),
  immediateStruggles: text("immediate_struggles"),
  gapsIdentified: text("gaps_identified"),
  tutorNotes: text("tutor_notes"),
  // Psychological Anchor
  futureIdentity: text("future_identity"),
  wantToRemembered: text("want_to_remembered"),
  hiddenMotivations: text("hidden_motivations"),
  internalConflict: text("internal_conflict"),
  // Recommendation
  recommendedPlan: varchar("recommended_plan").notNull(),
  justification: text("justification").notNull(),
  childWillWin: text("child_will_win"),
  // Metadata
  sentAt: timestamp("sent_at"),
  viewedAt: timestamp("viewed_at"),
  viewedCount: integer("viewed_count").notNull().default(0),
  acceptedAt: timestamp("accepted_at"),
  declinedAt: timestamp("declined_at"),
  declineReason: text("decline_reason"),
  parentCode: varchar("parent_code", { length: 8 }).unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type OnboardingProposal = typeof onboardingProposals.$inferSelect;
export type InsertOnboardingProposal = typeof onboardingProposals.$inferInsert;

export const insertOnboardingProposalSchema = createInsertSchema(onboardingProposals).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// ============================================
// STUDENT USERS TABLE (Student Authentication)
// ============================================

export const studentUsers = pgTable("student_users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique().notNull(),
  password: varchar("password").notNull(), // Hashed password
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  studentId: varchar("student_id").references(() => students.id),
  parentCode: varchar("parent_code", { length: 8 }).references(() => onboardingProposals.parentCode),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastLogin: timestamp("last_login"),
});

export type StudentUser = typeof studentUsers.$inferSelect;
export type InsertStudentUser = typeof studentUsers.$inferInsert;

export const insertStudentUserSchema = createInsertSchema(studentUsers).omit({
  id: true,
  createdAt: true,
  lastLogin: true,
});

// ============================================
// STUDENT COMMITMENTS TABLE
// ============================================
// Stores student's goals/habits/commitments

export const studentCommitments = pgTable("student_commitments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  studentId: varchar("student_id")
    .notNull()
    .references(() => students.id),
  name: varchar("name").notNull(),
  description: text("description"),
  whyCommitment: text("why_commitment"), // Why this commitment matters
  dailyAction: text("daily_action"), // What to do daily
  streakCount: integer("streak_count").notNull().default(0),
  lastCompletedDate: timestamp("last_completed_date"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type StudentCommitment = typeof studentCommitments.$inferSelect;
export type InsertStudentCommitment = typeof studentCommitments.$inferInsert;

export const insertStudentCommitmentSchema = createInsertSchema(studentCommitments).omit({
  id: true,
  createdAt: true,
  streakCount: true,
  lastCompletedDate: true,
});

// ============================================
// COMMITMENT LOGS TABLE
// ============================================
// Tracks daily completion of commitments

export const commitmentLogs = pgTable("commitment_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  commitmentId: varchar("commitment_id")
    .notNull()
    .references(() => studentCommitments.id),
  studentId: varchar("student_id")
    .notNull()
    .references(() => students.id),
  completedDate: timestamp("completed_date").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type CommitmentLog = typeof commitmentLogs.$inferSelect;
export type InsertCommitmentLog = typeof commitmentLogs.$inferInsert;

export const insertCommitmentLogSchema = createInsertSchema(commitmentLogs).omit({
  id: true,
  createdAt: true,
});

// ============================================
// STUDENT REFLECTIONS TABLE
// ============================================
// Student's personal reflections (similar to tutor reflections)

export const studentReflections = pgTable("student_reflections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  studentId: varchar("student_id")
    .notNull()
    .references(() => students.id),
  date: timestamp("date").notNull(),
  reflectionText: text("reflection_text").notNull(),
  mood: varchar("mood"), // Optional: student's mood
  tags: text("tags"), // Comma-separated tags
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type StudentReflection = typeof studentReflections.$inferSelect;
export type InsertStudentReflection = typeof studentReflections.$inferInsert;

export const insertStudentReflectionSchema = createInsertSchema(studentReflections).omit({
  id: true,
  createdAt: true,
});

// ============================================
// ASSIGNMENTS TABLE
// ============================================
// Practice problems assigned by tutor to student

export const assignments = pgTable("assignments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tutorId: varchar("tutor_id")
    .notNull()
    .references(() => users.id),
  studentId: varchar("student_id")
    .notNull()
    .references(() => students.id),
  title: varchar("title").notNull(),
  description: text("description"),
  problemsAssigned: text("problems_assigned"), // Problems to complete
  dueDate: timestamp("due_date"),
  isCompleted: boolean("is_completed").notNull().default(false),
  completedAt: timestamp("completed_at"),
  studentResult: text("student_result"), // Student's result/answer
  studentWork: text("student_work"), // What student did, how, and why
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Assignment = typeof assignments.$inferSelect;
export type InsertAssignment = typeof assignments.$inferInsert;

export const insertAssignmentSchema = createInsertSchema(assignments).omit({
  id: true,
  createdAt: true,
  completedAt: true,
  isCompleted: true,
});

// ============================================
// PARENT REPORTS TABLE
// ============================================
// Weekly/Monthly reports sent by tutor to parent

export const parentReports = pgTable("parent_reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tutorId: varchar("tutor_id")
    .notNull()
    .references(() => users.id),
  studentId: varchar("student_id")
    .notNull()
    .references(() => students.id),
  parentId: varchar("parent_id")
    .notNull()
    .references(() => users.id),
  reportType: reportTypeEnum("report_type").notNull(),
  weekNumber: integer("week_number"), // For weekly reports
  monthName: varchar("month_name"), // For monthly reports
  reportWindowKey: varchar("report_window_key"), // Stable source-window identity for deterministic reports
  
  // Report content
  summary: text("summary").notNull(),
  topicsLearned: text("topics_learned"),
  strengths: text("strengths"),
  areasForGrowth: text("areas_for_growth"),
  bossBattlesCompleted: integer("boss_battles_completed").notNull().default(0),
  solutionsUnlocked: integer("solutions_unlocked").notNull().default(0),
  confidenceGrowth: integer("confidence_growth"), // Percentage or score
  nextSteps: text("next_steps"),
  
  // Parent feedback
  parentFeedback: text("parent_feedback"),
  parentFeedbackAt: timestamp("parent_feedback_at"),
  
  sentAt: timestamp("sent_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type ParentReport = typeof parentReports.$inferSelect;
export type InsertParentReport = typeof parentReports.$inferInsert;

export const insertParentReportSchema = createInsertSchema(parentReports).omit({
  id: true,
  createdAt: true,
  parentFeedbackAt: true,
});

// ============================================
// BRAIN MODULE: PEOPLE REGISTRY
// ============================================
// Single Source of Truth for organizational identity

export const personStatusEnum = pgEnum("person_status", ["active", "paused", "exiting"]);

export const peopleRegistry = pgTable("people_registry", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id), // Optional link to users table
  fullName: varchar("full_name").notNull(),
  roleTitle: varchar("role_title").notNull(),
  roleDescription: text("role_description"), // What winning looks like
  shortBio: text("short_bio"), // How they see themselves
  podId: varchar("pod_id").references(() => pods.id), // Pod/team association
  teamName: varchar("team_name"), // Alternative team naming
  startDate: timestamp("start_date"),
  contractUrl: varchar("contract_url"), // Supabase storage URL
  ndaUrl: varchar("nda_url"), // Supabase storage URL
  status: personStatusEnum("status").notNull().default("active"),
  email: varchar("email"),
  phone: varchar("phone"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type PersonRegistry = typeof peopleRegistry.$inferSelect;
export type InsertPersonRegistry = typeof peopleRegistry.$inferInsert;

export const insertPersonRegistrySchema = createInsertSchema(peopleRegistry).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// ============================================
// BRAIN MODULE: DETAILS (Weekly Execution Layer)
// ============================================

export const detailStatusEnum = pgEnum("detail_status", ["pending", "done", "missed"]);

export const details = pgTable("details", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  personId: varchar("person_id").notNull().references(() => peopleRegistry.id),
  description: text("description").notNull(),
  dueDate: timestamp("due_date").notNull(),
  status: detailStatusEnum("status").notNull().default("pending"),
  weekNumber: integer("week_number"), // Optional: track by week
  fulfilledAt: timestamp("fulfilled_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  createdBy: varchar("created_by").references(() => users.id),
});

export type Detail = typeof details.$inferSelect;
export type InsertDetail = typeof details.$inferInsert;

export const insertDetailSchema = createInsertSchema(details).omit({
  id: true,
  createdAt: true,
  fulfilledAt: true,
});

// ============================================
// BRAIN MODULE: CAMPAIGNS / PROJECTS
// ============================================

export const projectStatusEnum = pgEnum("project_status", ["active", "at_risk", "completed"]);
export const projectHorizonEnum = pgEnum("project_horizon", ["30", "60", "90"]);

export const projects = pgTable("projects", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  ownerId: varchar("owner_id").notNull().references(() => peopleRegistry.id), // Single throat to choke
  horizon: projectHorizonEnum("horizon").notNull().default("30"),
  objective: text("objective").notNull(), // 1 sentence max
  status: projectStatusEnum("status").notNull().default("active"),
  startDate: timestamp("start_date").defaultNow(),
  endDate: timestamp("end_date"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  createdBy: varchar("created_by").references(() => users.id),
});

export type Project = typeof projects.$inferSelect;
export type InsertProject = typeof projects.$inferInsert;

export const insertProjectSchema = createInsertSchema(projects).omit({
  id: true,
  createdAt: true,
});

// Link details to projects
export const projectDetails = pgTable("project_details", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id),
  detailId: varchar("detail_id").notNull().references(() => details.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ============================================
// BRAIN MODULE: IDEAS / STRATEGIES
// ============================================

export const ideaStatusEnum = pgEnum("idea_status", ["new", "reviewed", "approved", "archived"]);
export const pillarEnum = pgEnum("pillar", ["revenue", "reputation", "systems", "culture", "other"]);

export const ideas = pgTable("ideas", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: varchar("title").notNull(),
  description: text("description").notNull(), // 3-5 sentences
  pillar: pillarEnum("pillar").notNull().default("other"),
  problemSolved: text("problem_solved"), // Optional: What problem does this solve?
  status: ideaStatusEnum("status").notNull().default("new"),
  submittedBy: varchar("submitted_by").references(() => users.id),
  submitterName: varchar("submitter_name"), // In case user doesn't exist
  submitterRole: varchar("submitter_role"),
  reviewedBy: varchar("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  reviewNotes: text("review_notes"),
  convertedToProjectId: varchar("converted_to_project_id").references(() => projects.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Idea = typeof ideas.$inferSelect;
export type InsertIdea = typeof ideas.$inferInsert;

export const insertIdeaSchema = createInsertSchema(ideas).omit({
  id: true,
  createdAt: true,
  reviewedAt: true,
  convertedToProjectId: true,
});

// ============================================
// DISPUTES MODULE: ISSUE LOGGING
// ============================================

export const disputeTypeEnum = pgEnum("dispute_type", [
  "miscommunication",
  "missed_responsibility",
  "disrespect",
  "performance_concern",
]);

export const disputeOutcomeEnum = pgEnum("dispute_outcome", [
  "clarity",
  "apology",
  "decision",
  "separation",
]);

export const disputeStatusEnum = pgEnum("dispute_status", [
  "open",
  "under_review",
  "resolved",
  "escalated",
]);

export const disputes = pgTable("disputes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  loggedBy: varchar("logged_by").references(() => users.id),
  loggedByName: varchar("logged_by_name"), // In case user doesn't exist
  involvedParties: jsonb("involved_parties").$type<string[]>(), // Array of person IDs from registry
  involvedPartyNames: jsonb("involved_party_names").$type<string[]>(), // Names for display
  disputeType: disputeTypeEnum("dispute_type").notNull(),
  description: text("description").notNull(), // Max 300 words enforced on frontend
  desiredOutcome: disputeOutcomeEnum("desired_outcome").notNull(),
  status: disputeStatusEnum("status").notNull().default("open"),
  // Visibility - only HR + CEO by default
  visibleTo: jsonb("visible_to").$type<string[]>().default(["hr", "ceo"]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Dispute = typeof disputes.$inferSelect;
export type InsertDispute = typeof disputes.$inferInsert;

export const insertDisputeSchema = createInsertSchema(disputes).omit({
  id: true,
  createdAt: true,
});

// ============================================
// DISPUTES MODULE: RESOLUTIONS
// ============================================

export const resolutionActionEnum = pgEnum("resolution_action", [
  "clarification_requested",
  "mediated_discussion",
  "warning_issued",
  "role_change_recommended",
  "exit_recommended",
]);

export const disputeResolutions = pgTable("dispute_resolutions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  disputeId: varchar("dispute_id").notNull().references(() => disputes.id),
  action: resolutionActionEnum("action").notNull(),
  summary: text("summary").notNull(),
  decision: text("decision").notNull(),
  followUpDate: timestamp("follow_up_date"),
  resolvedBy: varchar("resolved_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type DisputeResolution = typeof disputeResolutions.$inferSelect;
export type InsertDisputeResolution = typeof disputeResolutions.$inferInsert;

export const insertDisputeResolutionSchema = createInsertSchema(disputeResolutions).omit({
  id: true,
  createdAt: true,
});

// ============================================
// EXECUTIVE COMMAND RHYTHM OS
// ============================================

export const executiveDepartmentEnum = pgEnum("executive_department", [
  "ceo",
  "coo",
  "hr",
  "cto",
  "cmo",
]);

export const executiveOnboardingStatusEnum = pgEnum("executive_onboarding_status", [
  "not_started",
  "in_progress",
  "completed",
]);

export const executiveContributionStatusEnum = pgEnum("executive_contribution_status", [
  "not_contributing",
  "building",
  "contributing",
  "at_risk",
]);

export const executiveTaskPriorityEnum = pgEnum("executive_task_priority", [
  "critical",
  "high",
  "normal",
  "low",
]);

export const executiveTaskStatusEnum = pgEnum("executive_task_status", [
  "not_started",
  "in_progress",
  "blocked",
  "submitted",
  "approved",
  "missed",
]);

export const executiveTaskCompletionResultEnum = pgEnum("executive_task_completion_result", [
  "done",
  "delayed",
  "failed",
  "moved",
]);

export const executiveProofStatusEnum = pgEnum("executive_proof_status", [
  "submitted",
  "approved",
  "rejected",
]);

export const executiveTimeLogValueTypeEnum = pgEnum("executive_time_log_value_type", [
  "strategic",
  "support",
  "activity",
]);

export const executiveWeeklyRecordTypeEnum = pgEnum("executive_weekly_record_type", [
  "coo_operational_report",
  "ceo_feedback_record",
  "executive_direction_report",
  "department_report",
]);

export const executiveProfiles = pgTable("executive_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id")
    .notNull()
    .references(() => users.id)
    .unique(),
  department: executiveDepartmentEnum("department").notNull(),
  title: varchar("title").notNull(),
  mission: text("mission"),
  reportingLine: varchar("reporting_line"),
  authorityLevel: varchar("authority_level"),
  coreResponsibilities: jsonb("core_responsibilities").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  communicationRhythm: text("communication_rhythm"),
  onboardingStatus: executiveOnboardingStatusEnum("onboarding_status").notNull().default("not_started"),
  contributionStatus: executiveContributionStatusEnum("contribution_status").notNull().default("not_contributing"),
  doctrineAcknowledged: boolean("doctrine_acknowledged").notNull().default(false),
  consequenceLogicAcknowledged: boolean("consequence_logic_acknowledged").notNull().default(false),
  onboardingCompletedAt: timestamp("onboarding_completed_at"),
  contributionActivatedAt: timestamp("contribution_activated_at"),
  lastContributionAt: timestamp("last_contribution_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type ExecutiveProfile = typeof executiveProfiles.$inferSelect;
export type InsertExecutiveProfile = typeof executiveProfiles.$inferInsert;

export const insertExecutiveProfileSchema = createInsertSchema(executiveProfiles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const executiveCommandTasks = pgTable("executive_command_tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: varchar("title").notNull(),
  description: text("description"),
  department: executiveDepartmentEnum("department").notNull(),
  ownerUserId: varchar("owner_user_id")
    .notNull()
    .references(() => users.id),
  createdByUserId: varchar("created_by_user_id")
    .notNull()
    .references(() => users.id),
  approvedByUserId: varchar("approved_by_user_id").references(() => users.id),
  supportingUserIds: jsonb("supporting_user_ids").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  deadline: timestamp("deadline").notNull(),
  priority: executiveTaskPriorityEnum("priority").notNull().default("normal"),
  requiredProof: text("required_proof").notNull(),
  proofRequiredForApproval: boolean("proof_required_for_approval").notNull().default(true),
  status: executiveTaskStatusEnum("status").notNull().default("not_started"),
  completionPercent: integer("completion_percent").notNull().default(0),
  blockerSummary: text("blocker_summary"),
  blockerNeeds: text("blocker_needs"),
  blockerDecisionNeeded: text("blocker_decision_needed"),
  blockerReportedAt: timestamp("blocker_reported_at"),
  ceoVisible: boolean("ceo_visible").notNull().default(true),
  ceoNotes: text("ceo_notes"),
  cooNotes: text("coo_notes"),
  consequenceIfIncomplete: text("consequence_if_incomplete"),
  completionResult: executiveTaskCompletionResultEnum("completion_result"),
  directionSource: text("direction_source"),
  weekStartDate: timestamp("week_start_date"),
  submittedAt: timestamp("submitted_at"),
  approvedAt: timestamp("approved_at"),
  lastUpdatedAt: timestamp("last_updated_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  ownerIdx: index("idx_executive_command_tasks_owner").on(table.ownerUserId),
  departmentIdx: index("idx_executive_command_tasks_department").on(table.department),
  deadlineIdx: index("idx_executive_command_tasks_deadline").on(table.deadline),
}));

export type ExecutiveCommandTask = typeof executiveCommandTasks.$inferSelect;
export type InsertExecutiveCommandTask = typeof executiveCommandTasks.$inferInsert;

export const insertExecutiveCommandTaskSchema = createInsertSchema(executiveCommandTasks).omit({
  id: true,
  createdAt: true,
  lastUpdatedAt: true,
  submittedAt: true,
  approvedAt: true,
  approvedByUserId: true,
});

export const executiveTaskTimeLogs = pgTable("executive_task_time_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  taskId: varchar("task_id")
    .notNull()
    .references(() => executiveCommandTasks.id),
  userId: varchar("user_id")
    .notNull()
    .references(() => users.id),
  workDate: timestamp("work_date").notNull(),
  minutesSpent: integer("minutes_spent").notNull(),
  outcomeProduced: text("outcome_produced").notNull(),
  proofReference: text("proof_reference"),
  roleAligned: boolean("role_aligned").notNull().default(true),
  valueType: executiveTimeLogValueTypeEnum("value_type").notNull().default("support"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  taskIdx: index("idx_executive_task_time_logs_task").on(table.taskId),
  userIdx: index("idx_executive_task_time_logs_user").on(table.userId),
}));

export type ExecutiveTaskTimeLog = typeof executiveTaskTimeLogs.$inferSelect;
export type InsertExecutiveTaskTimeLog = typeof executiveTaskTimeLogs.$inferInsert;

export const insertExecutiveTaskTimeLogSchema = createInsertSchema(executiveTaskTimeLogs).omit({
  id: true,
  createdAt: true,
});

export const executiveTaskProofs = pgTable("executive_task_proofs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  taskId: varchar("task_id")
    .notNull()
    .references(() => executiveCommandTasks.id),
  submittedByUserId: varchar("submitted_by_user_id")
    .notNull()
    .references(() => users.id),
  reviewedByUserId: varchar("reviewed_by_user_id").references(() => users.id),
  label: varchar("label").notNull(),
  proofType: varchar("proof_type").notNull().default("link"),
  proofUrl: text("proof_url").notNull(),
  notes: text("notes"),
  status: executiveProofStatusEnum("status").notNull().default("submitted"),
  rejectionReason: text("rejection_reason"),
  submittedAt: timestamp("submitted_at").defaultNow().notNull(),
  reviewedAt: timestamp("reviewed_at"),
}, (table) => ({
  taskIdx: index("idx_executive_task_proofs_task").on(table.taskId),
  submitterIdx: index("idx_executive_task_proofs_submitter").on(table.submittedByUserId),
}));

export type ExecutiveTaskProof = typeof executiveTaskProofs.$inferSelect;
export type InsertExecutiveTaskProof = typeof executiveTaskProofs.$inferInsert;

export const insertExecutiveTaskProofSchema = createInsertSchema(executiveTaskProofs).omit({
  id: true,
  submittedAt: true,
  reviewedAt: true,
  reviewedByUserId: true,
});

export const executiveWeeklyRecords = pgTable("executive_weekly_records", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  weekStartDate: timestamp("week_start_date").notNull(),
  recordType: executiveWeeklyRecordTypeEnum("record_type").notNull(),
  department: executiveDepartmentEnum("department"),
  createdByUserId: varchar("created_by_user_id")
    .notNull()
    .references(() => users.id),
  title: varchar("title").notNull(),
  summary: text("summary").notNull(),
  keyDecisions: text("key_decisions"),
  risks: text("risks"),
  nextDirections: text("next_directions"),
  needsAttention: text("needs_attention"),
  sourceTaskIds: jsonb("source_task_ids").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  payload: jsonb("payload").notNull().default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  weekIdx: index("idx_executive_weekly_records_week").on(table.weekStartDate),
  typeIdx: index("idx_executive_weekly_records_type").on(table.recordType),
}));

export type ExecutiveWeeklyRecord = typeof executiveWeeklyRecords.$inferSelect;
export type InsertExecutiveWeeklyRecord = typeof executiveWeeklyRecords.$inferInsert;

export const insertExecutiveWeeklyRecordSchema = createInsertSchema(executiveWeeklyRecords).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  payload: z.record(z.any()).optional(),
});
