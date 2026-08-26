var __makeTemplateObject = (this && this.__makeTemplateObject) || function (cooked, raw) {
    if (Object.defineProperty) { Object.defineProperty(cooked, "raw", { value: raw }); } else { cooked.raw = raw; }
    return cooked;
};
import { sql } from "drizzle-orm";
import { pgTable, varchar, text, timestamp, boolean, integer, jsonb, pgEnum, index, real, serial, bigint, decimal, } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
// ============================================
// ENUMS
// ============================================
// Client Portal: parent, student
// Affiliate Portal: affiliate, od (outreach director)
// Operational Portal: tutor, td (territory director)
// Executive Portal: coo, hr, ceo
export var roleEnum = pgEnum("role", [
    "parent",
    "student",
    "tutor",
    "td",
    "affiliate",
    "od",
    "coo",
    "hr",
    "ceo",
]);
export var podTypeEnum = pgEnum("pod_type", ["training", "paid"]);
export var vehicleEnum = pgEnum("vehicle", ["4_seater", "5_seater", "6_seater"]);
export var phaseEnum = pgEnum("phase", ["foundation", "scale_test"]);
export var podStatusEnum = pgEnum("pod_status", ["active", "completed"]);
export var certificationStatusEnum = pgEnum("certification_status", [
    "pending",
    "passed",
    "failed",
]);
export var verificationStatusEnum = pgEnum("verification_status", [
    "pending",
    "verified",
    "rejected",
]);
export var visibilityEnum = pgEnum("visibility", ["all", "tds", "tutors", "parents", "students", "affiliates", "od", "hr", "ceo"]);
export var applicationStatusEnum = pgEnum("application_status", [
    "pending",
    "approved",
    "rejected",
]);
export var enrollmentStatusEnum = pgEnum("enrollment_status", [
    "not_enrolled",
    "awaiting_assignment",
    "assigned",
    "proposal_sent",
    "session_booked",
    "report_received",
    "confirmed",
]);
export var reportTypeEnum = pgEnum("report_type", ["weekly", "monthly"]);
// ============================================
// SESSION STORAGE (Required for Replit Auth)
// ============================================
export var sessions = pgTable("sessions", {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
}, function (table) { return [index("IDX_session_expire").on(table.expire)]; });
// ============================================
// USERS TABLE
// ============================================
export var users = pgTable("users", {
    id: varchar("id").primaryKey().default(sql(templateObject_1 || (templateObject_1 = __makeTemplateObject(["gen_random_uuid()"], ["gen_random_uuid()"])))),
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
export var upsertUserSchema = createInsertSchema(users).pick({
    id: true,
    email: true,
    firstName: true,
    lastName: true,
    profileImageUrl: true,
});
export var updateUserProfileSchema = createInsertSchema(users).pick({
    name: true,
    role: true,
    grade: true,
    school: true,
});
// ============================================
// PODS TABLE
// ============================================
export var pods = pgTable("pods", {
    id: varchar("id").primaryKey().default(sql(templateObject_2 || (templateObject_2 = __makeTemplateObject(["gen_random_uuid()"], ["gen_random_uuid()"])))),
    podName: varchar("pod_name").notNull(),
    podType: podTypeEnum("pod_type").notNull().default("training"),
    vehicle: vehicleEnum("vehicle").notNull().default("4_seater"),
    phase: phaseEnum("phase").notNull().default("foundation"),
    tdId: varchar("td_id").references(function () { return users.id; }),
    status: podStatusEnum("status").notNull().default("active"),
    startDate: timestamp("start_date"),
    endDate: timestamp("end_date"),
    deletedAt: timestamp("deleted_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});
export var insertPodSchema = createInsertSchema(pods).omit({
    id: true,
    createdAt: true,
});
// ============================================
// TUTOR ASSIGNMENTS TABLE
// ============================================
export var tutorAssignments = pgTable("tutor_assignments", {
    id: varchar("id").primaryKey().default(sql(templateObject_3 || (templateObject_3 = __makeTemplateObject(["gen_random_uuid()"], ["gen_random_uuid()"])))),
    tutorId: varchar("tutor_id")
        .notNull()
        .references(function () { return users.id; }),
    podId: varchar("pod_id")
        .notNull()
        .references(function () { return pods.id; }),
    studentCount: integer("student_count").notNull().default(1),
    certificationStatus: certificationStatusEnum("certification_status")
        .notNull()
        .default("pending"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});
export var insertTutorAssignmentSchema = createInsertSchema(tutorAssignments).omit({
    id: true,
    createdAt: true,
});
// ============================================
// STUDENTS TABLE
// ============================================
export var students = pgTable("students", {
    id: varchar("id").primaryKey().default(sql(templateObject_4 || (templateObject_4 = __makeTemplateObject(["gen_random_uuid()"], ["gen_random_uuid()"])))),
    name: varchar("name").notNull(),
    grade: varchar("grade").notNull(),
    tutorId: varchar("tutor_id")
        .notNull()
        .references(function () { return users.id; }),
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
export var insertStudentSchema = createInsertSchema(students).omit({
    id: true,
    createdAt: true,
    sessionProgress: true,
});
// ============================================
// SESSIONS TABLE
// ============================================
export var sessionsTable = pgTable("tutoring_sessions", {
    id: varchar("id").primaryKey().default(sql(templateObject_5 || (templateObject_5 = __makeTemplateObject(["gen_random_uuid()"], ["gen_random_uuid()"])))),
    tutorId: varchar("tutor_id")
        .notNull()
        .references(function () { return users.id; }),
    studentId: varchar("student_id")
        .notNull()
        .references(function () { return students.id; }),
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
export var insertSessionSchema = createInsertSchema(sessionsTable).omit({
    id: true,
    createdAt: true,
});
// ============================================
// REFLECTIONS TABLE
// ============================================
export var reflections = pgTable("reflections", {
    id: varchar("id").primaryKey().default(sql(templateObject_6 || (templateObject_6 = __makeTemplateObject(["gen_random_uuid()"], ["gen_random_uuid()"])))),
    tutorId: varchar("tutor_id")
        .notNull()
        .references(function () { return users.id; }),
    date: timestamp("date").notNull(),
    reflectionText: text("reflection_text").notNull(),
    habitScore: integer("habit_score"), // 1-10 scale
    createdAt: timestamp("created_at").defaultNow().notNull(),
});
export var insertReflectionSchema = createInsertSchema(reflections).omit({
    id: true,
    createdAt: true,
});
// ============================================
// WEEKLY CHECK-INS TABLE (Tutor Weekly Reports)
// ============================================
export var weeklyCheckIns = pgTable("weekly_check_ins", {
    id: varchar("id").primaryKey().default(sql(templateObject_7 || (templateObject_7 = __makeTemplateObject(["gen_random_uuid()"], ["gen_random_uuid()"])))),
    tutorId: varchar("tutor_id")
        .notNull()
        .references(function () { return users.id; }),
    podId: varchar("pod_id")
        .notNull()
        .references(function () { return pods.id; }),
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
export var insertWeeklyCheckInSchema = createInsertSchema(weeklyCheckIns).omit({
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
export var academicProfiles = pgTable("academic_profiles", {
    id: varchar("id").primaryKey().default(sql(templateObject_8 || (templateObject_8 = __makeTemplateObject(["gen_random_uuid()"], ["gen_random_uuid()"])))),
    studentId: varchar("student_id")
        .notNull()
        .references(function () { return students.id; })
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
export var insertAcademicProfileSchema = createInsertSchema(academicProfiles).omit({
    id: true,
    createdAt: true,
    updatedAt: true,
});
// ============================================
// STRUGGLE TARGETS TABLE (Target Center)
// ============================================
export var struggleTargets = pgTable("struggle_targets", {
    id: varchar("id").primaryKey().default(sql(templateObject_9 || (templateObject_9 = __makeTemplateObject(["gen_random_uuid()"], ["gen_random_uuid()"])))),
    studentId: varchar("student_id")
        .notNull()
        .references(function () { return students.id; }),
    subject: varchar("subject").notNull(),
    topicConcept: varchar("topic_concept").notNull(),
    myStruggle: text("my_struggle").notNull(),
    strategy: text("strategy").notNull(),
    consolidationDate: timestamp("consolidation_date"),
    overcame: boolean("overcame").notNull().default(false),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export var insertStruggleTargetSchema = createInsertSchema(struggleTargets).omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    overcame: true,
});
// ============================================
// VERIFICATION DOCS TABLE
// ============================================
export var verificationDocs = pgTable("verification_docs", {
    id: varchar("id").primaryKey().default(sql(templateObject_10 || (templateObject_10 = __makeTemplateObject(["gen_random_uuid()"], ["gen_random_uuid()"])))),
    tutorId: varchar("tutor_id")
        .notNull()
        .references(function () { return users.id; }),
    fileUrlAgreement: varchar("file_url_agreement"),
    fileUrlConsent: varchar("file_url_consent"),
    status: verificationStatusEnum("status").notNull().default("pending"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export var insertVerificationDocSchema = createInsertSchema(verificationDocs).omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    status: true,
});
// ============================================
// TUTOR APPLICATIONS TABLE
// ============================================
export var tutorApplications = pgTable("tutor_applications", {
    id: varchar("id").primaryKey().default(sql(templateObject_11 || (templateObject_11 = __makeTemplateObject(["gen_random_uuid()"], ["gen_random_uuid()"])))),
    userId: varchar("user_id").notNull().references(function () { return users.id; }),
    // Personal & Environmental Profile
    fullNames: varchar("full_names").notNull(),
    age: integer("age").notNull(),
    phoneNumber: varchar("phone_number").notNull(),
    email: varchar("email").notNull(),
    city: varchar("city").notNull(),
    currentStatus: varchar("current_status").notNull(), // High School Student, University Student, etc.
    whoInfluences: text("who_influences"),
    environment: text("environment"),
    // Mindset & Mission (stored as JSONB for flexibility)
    mindsetData: jsonb("mindset_data"), // Contains: whyTutor, whatIsConfidenceMentor, resilienceStory, reactionToStudent, beliefInConfidence, pressureWeak, motivationQuote
    // Academic Confidence
    gradesEquipped: text("grades_equipped").array().notNull(), // Array of grades: Grade 6, 7, 8, 9
    canExplainClearly: varchar("can_explain_clearly").notNull(), // Yes definitely, I think so, I'd need guidance
    toolConfidence: jsonb("tool_confidence"), // Ratings for Google Meet, OneNote, Screen Sharing
    studentNotImproving: varchar("student_not_improving"), // A/B/C/D choice
    // Psychological Fit (stored as JSONB)
    psychologicalData: jsonb("psychological_data"), // Contains: statementHits, feedbackResponse, quitReason, teamMeaning, whatScares
    // Vision & Long-term
    visionData: jsonb("vision_data"), // Contains: futurePersonality, earningsUse, studentRemembrance, impactVsScale
    // Video Introduction
    videoUrl: varchar("video_url"),
    // Availability & Commitment
    bootcampAvailable: varchar("bootcamp_available").notNull(), // Yes, Maybe, No
    commitToTrial: boolean("commit_to_trial").notNull(),
    referralSource: varchar("referral_source"), // School, Friend, Social Media, WhatsApp, Other
    // Application Status
    status: applicationStatusEnum("status").notNull().default("pending"),
    reviewedBy: varchar("reviewed_by").references(function () { return users.id; }), // COO who approved/rejected
    reviewedAt: timestamp("reviewed_at"),
    rejectionReason: text("rejection_reason"),
    // Onboarding Documents
    trialAgreementUrl: varchar("trial_agreement_url"),
    trialAgreementUploadedAt: timestamp("trial_agreement_uploaded_at"),
    trialAgreementVerified: boolean("trial_agreement_verified").default(false),
    trialAgreementVerifiedBy: varchar("trial_agreement_verified_by").references(function () { return users.id; }),
    trialAgreementVerifiedAt: timestamp("trial_agreement_verified_at"),
    parentConsentUrl: varchar("parent_consent_url"),
    parentConsentUploadedAt: timestamp("parent_consent_uploaded_at"),
    parentConsentVerified: boolean("parent_consent_verified").default(false),
    parentConsentVerifiedBy: varchar("parent_consent_verified_by").references(function () { return users.id; }),
    parentConsentVerifiedAt: timestamp("parent_consent_verified_at"),
    onboardingCompletedAt: timestamp("onboarding_completed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export var insertTutorApplicationSchema = createInsertSchema(tutorApplications).omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    reviewedBy: true,
    reviewedAt: true,
    rejectionReason: true,
});
// ============================================
// BROADCASTS TABLE
// ============================================
export var broadcasts = pgTable("broadcasts", {
    id: varchar("id").primaryKey().default(sql(templateObject_12 || (templateObject_12 = __makeTemplateObject(["gen_random_uuid()"], ["gen_random_uuid()"])))),
    subject: varchar("subject"),
    message: text("message").notNull(),
    senderRole: roleEnum("sender_role").notNull(),
    visibility: visibilityEnum("visibility").notNull().default("all"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});
export var insertBroadcastSchema = z.object({
    subject: z.string().min(1, "Subject is required"),
    message: z.string().min(1, "Message is required"),
    senderRole: z.enum(["parent", "student", "tutor", "td", "affiliate", "od", "coo", "hr", "ceo"]),
    visibility: z.enum(["all", "tds", "tutors", "parents", "students", "affiliates", "od", "hr", "ceo"]),
});
// ============================================
// BROADCAST READS TABLE (Track which broadcasts users have read)
// ============================================
export var broadcastReads = pgTable("broadcast_reads", {
    id: varchar("id").primaryKey().default(sql(templateObject_13 || (templateObject_13 = __makeTemplateObject(["gen_random_uuid()"], ["gen_random_uuid()"])))),
    userId: varchar("user_id")
        .notNull()
        .references(function () { return users.id; }),
    broadcastId: varchar("broadcast_id")
        .notNull()
        .references(function () { return broadcasts.id; }),
    readAt: timestamp("read_at").defaultNow().notNull(),
});
export var roleAuthorizationSchema = z.object({
    email: z.string().email(),
    role: z.enum(["td", "coo", "od"]),
    assignedPodId: z.string().nullable().optional(),
});
// ============================================
// EGP CREWS
// ============================================
export var egpCrewStatusEnum = pgEnum("egp_crew_status", ["active", "archived"]);
export var egpCrewMemberRoleEnum = pgEnum("egp_crew_member_role", ["member", "crew_lead"]);
export var egpCrews = pgTable("egp_crews", {
    id: varchar("id").primaryKey().default(sql(templateObject_36 || (templateObject_36 = __makeTemplateObject(["gen_random_uuid()"], ["gen_random_uuid()"])))),
    crewName: varchar("crew_name").notNull(),
    territory: varchar("territory"),
    status: egpCrewStatusEnum("status").notNull().default("active"),
    createdBy: varchar("created_by").references(function () { return users.id; }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export var egpCrewMembers = pgTable("egp_crew_members", {
    id: varchar("id").primaryKey().default(sql(templateObject_37 || (templateObject_37 = __makeTemplateObject(["gen_random_uuid()"], ["gen_random_uuid()"])))),
    crewId: varchar("crew_id")
        .notNull()
        .references(function () { return egpCrews.id; }),
    egpId: varchar("egp_id")
        .notNull()
        .references(function () { return users.id; }),
    role: egpCrewMemberRoleEnum("role").notNull().default("member"),
    joinedAt: timestamp("joined_at").defaultNow().notNull(),
    removedAt: timestamp("removed_at"),
});
export var insertEgpCrewSchema = createInsertSchema(egpCrews).omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    createdBy: true,
});
export var insertEgpCrewMemberSchema = createInsertSchema(egpCrewMembers).omit({
    id: true,
    joinedAt: true,
    removedAt: true,
});
// ============================================
// AFFILIATE PROSPECTING SYSTEM
// ============================================
// Enums for affiliate prospecting
export var encounterStatusEnum = pgEnum("encounter_status", [
    "prospect",
    "objected",
]);
// Affiliate Codes - Unique code for each affiliate to give to parents
export var affiliateCodes = pgTable("affiliate_codes", {
    id: varchar("id").primaryKey().default(sql(templateObject_14 || (templateObject_14 = __makeTemplateObject(["gen_random_uuid()"], ["gen_random_uuid()"])))),
    affiliateId: varchar("affiliate_id")
        .notNull()
        .references(function () { return users.id; }),
    code: varchar("code").notNull().unique(), // e.g., "AFIX001"
    type: varchar("type", { length: 16 }), // 'person' or 'entity'
    personName: varchar("person_name", { length: 128 }),
    entityName: varchar("entity_name", { length: 128 }),
    schoolType: varchar("school_type", { length: 16 }), // 'primary' or 'high'
    createdAt: timestamp("created_at").defaultNow().notNull(),
});
export var insertAffiliateCodeSchema = createInsertSchema(affiliateCodes).omit({
    id: true,
    createdAt: true,
});
// Encounters - Parent meets affiliate, gets their code
export var encounters = pgTable("encounters", {
    id: varchar("id").primaryKey().default(sql(templateObject_15 || (templateObject_15 = __makeTemplateObject(["gen_random_uuid()"], ["gen_random_uuid()"])))),
    affiliateId: varchar("affiliate_id")
        .notNull()
        .references(function () { return users.id; }),
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
export var insertEncounterSchema = createInsertSchema(encounters)
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
    dateMet: z.string().optional().transform(function (val) { return val ? new Date(val) : undefined; }),
    contactMethod: z.string().optional(),
    discoveryOutcome: z.string().optional(),
    deliveryNotes: z.string().optional(),
    finalOutcome: z.string().optional(),
    result: z.string().optional(),
    confidenceRating: z.number().min(1).max(5).optional(),
    myThoughts: z.string().optional(),
});
// Leads - Parent created account with affiliate's code
export var leads = pgTable("leads", {
    id: varchar("id").primaryKey().default(sql(templateObject_16 || (templateObject_16 = __makeTemplateObject(["gen_random_uuid()"], ["gen_random_uuid()"])))),
    affiliateId: varchar("affiliate_id")
        .notNull()
        .references(function () { return users.id; }),
    userId: varchar("user_id")
        .notNull()
        .references(function () { return users.id; })
        .unique(), // One lead per parent
    encounterId: varchar("encounter_id").references(function () { return encounters.id; }),
    // Tracking fields - how lead was acquired
    trackingSource: varchar("tracking_source"), // "affiliate", "blog", "school", "media", "organic"
    trackingCampaign: varchar("tracking_campaign"), // Campaign identifier (for analytics)
    convertedAt: timestamp("converted_at").defaultNow().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});
export var insertLeadSchema = createInsertSchema(leads).omit({
    id: true,
    convertedAt: true,
    createdAt: true,
});
// Closes - Parent committed to tutoring journey (assigned tutor)
export var closes = pgTable("closes", {
    id: serial("id").primaryKey(),
    affiliateId: varchar("affiliate_id")
        .notNull()
        .references(function () { return users.id; }),
    parentId: varchar("parent_id").references(function () { return users.id; }),
    leadId: bigint("lead_id", { mode: "number" }).references(function () { return leads.id; }),
    childId: bigint("child_id", { mode: "number" }).references(function () { return students.id; }),
    podAssignmentId: bigint("pod_assignment_id", { mode: "number" }),
    commissionAmount: decimal("commission_amount", { precision: 10, scale: 2 }),
    commissionStatus: varchar("commission_status", { length: 50 }).default("pending"),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});
export var insertCloseSchema = createInsertSchema(closes).omit({
    id: true,
    closedAt: true,
    createdAt: true,
});
// Affiliate Reflections - Reflections on first read of Sales Psychology blueprint
export var affiliateReflections = pgTable("affiliate_reflections", {
    id: varchar("id").primaryKey().default(sql(templateObject_17 || (templateObject_17 = __makeTemplateObject(["gen_random_uuid()"], ["gen_random_uuid()"])))),
    affiliateId: varchar("affiliate_id")
        .notNull()
        .references(function () { return users.id; })
        .unique(), // One set of initial reflections per affiliate
    reflectionText: text("reflection_text").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export var insertAffiliateReflectionSchema = createInsertSchema(affiliateReflections).omit({
    id: true,
    createdAt: true,
    updatedAt: true,
});
// ============================================
// FUTURE EXPANSION PLACEHOLDERS (6-Seater)
// ============================================
// These fields anticipate 6-Seater + DDAN integration
// but stay dormant in Phase 1
export var futureExpansionFields = pgTable("future_expansion", {
    id: varchar("id").primaryKey().default(sql(templateObject_18 || (templateObject_18 = __makeTemplateObject(["gen_random_uuid()"], ["gen_random_uuid()"])))),
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
export var leadershipPilotRequests = pgTable("leadership_pilot_requests", {
    id: varchar("id").primaryKey().default(sql(templateObject_19 || (templateObject_19 = __makeTemplateObject(["gen_random_uuid()"], ["gen_random_uuid()"])))),
    schoolName: varchar("school_name").notNull(),
    contactPersonName: varchar("contact_person_name"),
    contactPersonPhone: varchar("contact_person_phone"),
    contactPersonRole: varchar("contact_person_role").notNull(),
    email: varchar("email").notNull(),
    submittedBy: varchar("submitted_by").references(function () { return users.id; }),
    submitterName: varchar("submitter_name"),
    submitterRole: varchar("submitter_role"),
    status: varchar("status").notNull().default("new"),
    submittedAt: timestamp("submitted_at").defaultNow().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});
export var insertLeadershipPilotRequestSchema = createInsertSchema(leadershipPilotRequests).omit({
    id: true,
    createdAt: true,
    submittedAt: true,
    submittedBy: true,
    status: true,
});
// Early Intervention Pilot Requests
export var earlyInterventionRequests = pgTable("early_intervention_requests", {
    id: varchar("id").primaryKey().default(sql(templateObject_20 || (templateObject_20 = __makeTemplateObject(["gen_random_uuid()"], ["gen_random_uuid()"])))),
    schoolName: varchar("school_name").notNull(),
    contactPersonName: varchar("contact_person_name"),
    contactPersonPhone: varchar("contact_person_phone"),
    contactPersonRole: varchar("contact_person_role").notNull(),
    email: varchar("email").notNull(),
    submittedBy: varchar("submitted_by").references(function () { return users.id; }),
    submitterName: varchar("submitter_name"),
    submitterRole: varchar("submitter_role"),
    status: varchar("status").notNull().default("new"),
    submittedAt: timestamp("submitted_at").defaultNow().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});
export var insertEarlyInterventionRequestSchema = createInsertSchema(earlyInterventionRequests).omit({
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
export var parentEnrollments = pgTable("parent_enrollments", {
    id: varchar("id").primaryKey().default(sql(templateObject_21 || (templateObject_21 = __makeTemplateObject(["gen_random_uuid()"], ["gen_random_uuid()"])))),
    parentId: varchar("parent_id")
        .notNull()
        .references(function () { return users.id; }),
    // Parent Info
    parentFullName: varchar("parent_full_name").notNull(),
    parentPhone: varchar("parent_phone").notNull(),
    parentEmail: varchar("parent_email").notNull(),
    parentCity: varchar("parent_city").notNull(),
    // Student Info
    studentFullName: varchar("student_full_name").notNull(),
    studentGrade: varchar("student_grade").notNull(),
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
    assignedTutorId: varchar("assigned_tutor_id").references(function () { return users.id; }),
    assignedStudentId: varchar("assigned_student_id").references(function () { return students.id; }),
    proposalId: varchar("proposal_id"),
    assignedAt: timestamp("assigned_at"),
    proposalSentAt: timestamp("proposal_sent_at"),
    confirmedAt: timestamp("confirmed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export var insertParentEnrollmentSchema = createInsertSchema(parentEnrollments).omit({
    id: true,
    createdAt: true,
    updatedAt: true,
});
// ============================================
// ONBOARDING PROPOSALS TABLE
// ============================================
// Stores tutor-created parent onboarding proposals
export var onboardingProposals = pgTable("onboarding_proposals", {
    id: varchar("id").primaryKey().default(sql(templateObject_22 || (templateObject_22 = __makeTemplateObject(["gen_random_uuid()"], ["gen_random_uuid()"])))),
    enrollmentId: varchar("enrollment_id")
        .notNull()
        .references(function () { return parentEnrollments.id; }),
    tutorId: varchar("tutor_id")
        .notNull()
        .references(function () { return users.id; }),
    studentId: varchar("student_id")
        .notNull()
        .references(function () { return students.id; }),
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
export var insertOnboardingProposalSchema = createInsertSchema(onboardingProposals).omit({
    id: true,
    createdAt: true,
    updatedAt: true,
});
// ============================================
// STUDENT USERS TABLE (Student Authentication)
// ============================================
export var studentUsers = pgTable("student_users", {
    id: varchar("id").primaryKey().default(sql(templateObject_23 || (templateObject_23 = __makeTemplateObject(["gen_random_uuid()"], ["gen_random_uuid()"])))),
    email: varchar("email").unique().notNull(),
    password: varchar("password").notNull(), // Hashed password
    firstName: varchar("first_name"),
    lastName: varchar("last_name"),
    studentId: varchar("student_id").references(function () { return students.id; }),
    parentCode: varchar("parent_code", { length: 8 }).references(function () { return onboardingProposals.parentCode; }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    lastLogin: timestamp("last_login"),
});
export var insertStudentUserSchema = createInsertSchema(studentUsers).omit({
    id: true,
    createdAt: true,
    lastLogin: true,
});
// ============================================
// STUDENT COMMITMENTS TABLE
// ============================================
// Stores student's goals/habits/commitments
export var studentCommitments = pgTable("student_commitments", {
    id: varchar("id").primaryKey().default(sql(templateObject_24 || (templateObject_24 = __makeTemplateObject(["gen_random_uuid()"], ["gen_random_uuid()"])))),
    studentId: varchar("student_id")
        .notNull()
        .references(function () { return students.id; }),
    name: varchar("name").notNull(),
    description: text("description"),
    whyCommitment: text("why_commitment"), // Why this commitment matters
    dailyAction: text("daily_action"), // What to do daily
    streakCount: integer("streak_count").notNull().default(0),
    lastCompletedDate: timestamp("last_completed_date"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});
export var insertStudentCommitmentSchema = createInsertSchema(studentCommitments).omit({
    id: true,
    createdAt: true,
    streakCount: true,
    lastCompletedDate: true,
});
// ============================================
// COMMITMENT LOGS TABLE
// ============================================
// Tracks daily completion of commitments
export var commitmentLogs = pgTable("commitment_logs", {
    id: varchar("id").primaryKey().default(sql(templateObject_25 || (templateObject_25 = __makeTemplateObject(["gen_random_uuid()"], ["gen_random_uuid()"])))),
    commitmentId: varchar("commitment_id")
        .notNull()
        .references(function () { return studentCommitments.id; }),
    studentId: varchar("student_id")
        .notNull()
        .references(function () { return students.id; }),
    completedDate: timestamp("completed_date").notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});
export var insertCommitmentLogSchema = createInsertSchema(commitmentLogs).omit({
    id: true,
    createdAt: true,
});
// ============================================
// STUDENT REFLECTIONS TABLE
// ============================================
// Student's personal reflections (similar to tutor reflections)
export var studentReflections = pgTable("student_reflections", {
    id: varchar("id").primaryKey().default(sql(templateObject_26 || (templateObject_26 = __makeTemplateObject(["gen_random_uuid()"], ["gen_random_uuid()"])))),
    studentId: varchar("student_id")
        .notNull()
        .references(function () { return students.id; }),
    date: timestamp("date").notNull(),
    reflectionText: text("reflection_text").notNull(),
    mood: varchar("mood"), // Optional: student's mood
    tags: text("tags"), // Comma-separated tags
    createdAt: timestamp("created_at").defaultNow().notNull(),
});
export var insertStudentReflectionSchema = createInsertSchema(studentReflections).omit({
    id: true,
    createdAt: true,
});
// ============================================
// ASSIGNMENTS TABLE
// ============================================
// Practice problems assigned by tutor to student
export var assignments = pgTable("assignments", {
    id: varchar("id").primaryKey().default(sql(templateObject_27 || (templateObject_27 = __makeTemplateObject(["gen_random_uuid()"], ["gen_random_uuid()"])))),
    tutorId: varchar("tutor_id")
        .notNull()
        .references(function () { return users.id; }),
    studentId: varchar("student_id")
        .notNull()
        .references(function () { return students.id; }),
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
export var insertAssignmentSchema = createInsertSchema(assignments).omit({
    id: true,
    createdAt: true,
    completedAt: true,
    isCompleted: true,
});
// ============================================
// PARENT REPORTS TABLE
// ============================================
// Weekly/Monthly reports sent by tutor to parent
export var parentReports = pgTable("parent_reports", {
    id: varchar("id").primaryKey().default(sql(templateObject_28 || (templateObject_28 = __makeTemplateObject(["gen_random_uuid()"], ["gen_random_uuid()"])))),
    tutorId: varchar("tutor_id")
        .notNull()
        .references(function () { return users.id; }),
    studentId: varchar("student_id")
        .notNull()
        .references(function () { return students.id; }),
    parentId: varchar("parent_id")
        .notNull()
        .references(function () { return users.id; }),
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
export var insertParentReportSchema = createInsertSchema(parentReports).omit({
    id: true,
    createdAt: true,
    parentFeedbackAt: true,
});
// ============================================
// BRAIN MODULE: PEOPLE REGISTRY
// ============================================
// Single Source of Truth for organizational identity
export var personStatusEnum = pgEnum("person_status", ["active", "paused", "exiting"]);
export var peopleRegistry = pgTable("people_registry", {
    id: varchar("id").primaryKey().default(sql(templateObject_29 || (templateObject_29 = __makeTemplateObject(["gen_random_uuid()"], ["gen_random_uuid()"])))),
    userId: varchar("user_id").references(function () { return users.id; }), // Optional link to users table
    fullName: varchar("full_name").notNull(),
    roleTitle: varchar("role_title").notNull(),
    roleDescription: text("role_description"), // What winning looks like
    shortBio: text("short_bio"), // How they see themselves
    podId: varchar("pod_id").references(function () { return pods.id; }), // Pod/team association
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
export var insertPersonRegistrySchema = createInsertSchema(peopleRegistry).omit({
    id: true,
    createdAt: true,
    updatedAt: true,
});
// ============================================
// BRAIN MODULE: DETAILS (Weekly Execution Layer)
// ============================================
export var detailStatusEnum = pgEnum("detail_status", ["pending", "done", "missed"]);
export var details = pgTable("details", {
    id: varchar("id").primaryKey().default(sql(templateObject_30 || (templateObject_30 = __makeTemplateObject(["gen_random_uuid()"], ["gen_random_uuid()"])))),
    personId: varchar("person_id").notNull().references(function () { return peopleRegistry.id; }),
    description: text("description").notNull(),
    dueDate: timestamp("due_date").notNull(),
    status: detailStatusEnum("status").notNull().default("pending"),
    weekNumber: integer("week_number"), // Optional: track by week
    fulfilledAt: timestamp("fulfilled_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    createdBy: varchar("created_by").references(function () { return users.id; }),
});
export var insertDetailSchema = createInsertSchema(details).omit({
    id: true,
    createdAt: true,
    fulfilledAt: true,
});
// ============================================
// BRAIN MODULE: CAMPAIGNS / PROJECTS
// ============================================
export var projectStatusEnum = pgEnum("project_status", ["active", "at_risk", "completed"]);
export var projectHorizonEnum = pgEnum("project_horizon", ["30", "60", "90"]);
export var projects = pgTable("projects", {
    id: varchar("id").primaryKey().default(sql(templateObject_31 || (templateObject_31 = __makeTemplateObject(["gen_random_uuid()"], ["gen_random_uuid()"])))),
    name: varchar("name").notNull(),
    ownerId: varchar("owner_id").notNull().references(function () { return peopleRegistry.id; }), // Single throat to choke
    horizon: projectHorizonEnum("horizon").notNull().default("30"),
    objective: text("objective").notNull(), // 1 sentence max
    status: projectStatusEnum("status").notNull().default("active"),
    startDate: timestamp("start_date").defaultNow(),
    endDate: timestamp("end_date"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    createdBy: varchar("created_by").references(function () { return users.id; }),
});
export var insertProjectSchema = createInsertSchema(projects).omit({
    id: true,
    createdAt: true,
});
// Link details to projects
export var projectDetails = pgTable("project_details", {
    id: varchar("id").primaryKey().default(sql(templateObject_32 || (templateObject_32 = __makeTemplateObject(["gen_random_uuid()"], ["gen_random_uuid()"])))),
    projectId: varchar("project_id").notNull().references(function () { return projects.id; }),
    detailId: varchar("detail_id").notNull().references(function () { return details.id; }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});
// ============================================
// BRAIN MODULE: IDEAS / STRATEGIES
// ============================================
export var ideaStatusEnum = pgEnum("idea_status", ["new", "reviewed", "approved", "archived"]);
export var pillarEnum = pgEnum("pillar", ["revenue", "reputation", "systems", "culture", "other"]);
export var ideas = pgTable("ideas", {
    id: varchar("id").primaryKey().default(sql(templateObject_33 || (templateObject_33 = __makeTemplateObject(["gen_random_uuid()"], ["gen_random_uuid()"])))),
    title: varchar("title").notNull(),
    description: text("description").notNull(), // 3-5 sentences
    pillar: pillarEnum("pillar").notNull().default("other"),
    problemSolved: text("problem_solved"), // Optional: What problem does this solve?
    status: ideaStatusEnum("status").notNull().default("new"),
    submittedBy: varchar("submitted_by").references(function () { return users.id; }),
    submitterName: varchar("submitter_name"), // In case user doesn't exist
    submitterRole: varchar("submitter_role"),
    reviewedBy: varchar("reviewed_by").references(function () { return users.id; }),
    reviewedAt: timestamp("reviewed_at"),
    reviewNotes: text("review_notes"),
    convertedToProjectId: varchar("converted_to_project_id").references(function () { return projects.id; }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});
export var insertIdeaSchema = createInsertSchema(ideas).omit({
    id: true,
    createdAt: true,
    reviewedAt: true,
    convertedToProjectId: true,
});
// ============================================
// DISPUTES MODULE: ISSUE LOGGING
// ============================================
export var disputeTypeEnum = pgEnum("dispute_type", [
    "miscommunication",
    "missed_responsibility",
    "disrespect",
    "performance_concern",
]);
export var disputeOutcomeEnum = pgEnum("dispute_outcome", [
    "clarity",
    "apology",
    "decision",
    "separation",
]);
export var disputeStatusEnum = pgEnum("dispute_status", [
    "open",
    "under_review",
    "resolved",
    "escalated",
]);
export var disputes = pgTable("disputes", {
    id: varchar("id").primaryKey().default(sql(templateObject_34 || (templateObject_34 = __makeTemplateObject(["gen_random_uuid()"], ["gen_random_uuid()"])))),
    loggedBy: varchar("logged_by").references(function () { return users.id; }),
    loggedByName: varchar("logged_by_name"), // In case user doesn't exist
    involvedParties: jsonb("involved_parties").$type(), // Array of person IDs from registry
    involvedPartyNames: jsonb("involved_party_names").$type(), // Names for display
    disputeType: disputeTypeEnum("dispute_type").notNull(),
    description: text("description").notNull(), // Max 300 words enforced on frontend
    desiredOutcome: disputeOutcomeEnum("desired_outcome").notNull(),
    status: disputeStatusEnum("status").notNull().default("open"),
    // Visibility - only HR + CEO by default
    visibleTo: jsonb("visible_to").$type().default(["hr", "ceo"]),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});
export var insertDisputeSchema = createInsertSchema(disputes).omit({
    id: true,
    createdAt: true,
});
// ============================================
// DISPUTES MODULE: RESOLUTIONS
// ============================================
export var resolutionActionEnum = pgEnum("resolution_action", [
    "clarification_requested",
    "mediated_discussion",
    "warning_issued",
    "role_change_recommended",
    "exit_recommended",
]);
export var disputeResolutions = pgTable("dispute_resolutions", {
    id: varchar("id").primaryKey().default(sql(templateObject_35 || (templateObject_35 = __makeTemplateObject(["gen_random_uuid()"], ["gen_random_uuid()"])))),
    disputeId: varchar("dispute_id").notNull().references(function () { return disputes.id; }),
    action: resolutionActionEnum("action").notNull(),
    summary: text("summary").notNull(),
    decision: text("decision").notNull(),
    followUpDate: timestamp("follow_up_date"),
    resolvedBy: varchar("resolved_by").references(function () { return users.id; }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});
export var insertDisputeResolutionSchema = createInsertSchema(disputeResolutions).omit({
    id: true,
    createdAt: true,
});
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5, templateObject_6, templateObject_7, templateObject_8, templateObject_9, templateObject_10, templateObject_11, templateObject_12, templateObject_13, templateObject_14, templateObject_15, templateObject_16, templateObject_17, templateObject_18, templateObject_19, templateObject_20, templateObject_21, templateObject_22, templateObject_23, templateObject_24, templateObject_25, templateObject_26, templateObject_27, templateObject_28, templateObject_29, templateObject_30, templateObject_31, templateObject_32, templateObject_33, templateObject_34, templateObject_35, templateObject_36, templateObject_37;
