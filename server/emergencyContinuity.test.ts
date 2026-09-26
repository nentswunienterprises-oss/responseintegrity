import { mergeTutorApplicationOnboardingState } from "./storage";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "fs";
import { resolve } from "path";
import {
  buildEmergencyParentStudentStats,
  getEmergencyBroadcastVisibilities,
  mapEmergencyBroadcast,
  mapEmergencyNotification,
  resolveEmergencyTutorMode,
  mapEmergencyTutorParentReport,
} from "./routes";
import { normalizeEvidenceLedgerTimestamp } from "./responseIntegrityEvidenceLedger";
import bcrypt from "bcryptjs";
import {
  createEmergencyFileBundle,
  decryptEmergencyFileBundle,
  emergencyExpectedRoleMatches,
  parseEmergencyDocumentEncryptionKey,
  verifyEmergencyCredential,
  verifyEmergencyPasswordForUser,
} from "./emergencyAuth";
import { buildExecutiveRosterFromRows } from "./routes/executiveCommandRhythm";
import { toJsonbParam, transformSnakeToCamel } from "./storage";
import { formatApplicationDate } from "../client/src/lib/application-date";
import {
  buildPayfastCheckoutSignature,
  withPayfastSignature,
} from "./payfast";

test("emergency topic activation stays on direct PostgreSQL and never falls through to Supabase", () => {
  const routesSource = readFileSync(resolve(process.cwd(), "server/routes.ts"), "utf8");
  const routeStart = routesSource.indexOf('app.post("/api/tutor/students/:studentId/topic-conditioning"');
  const routeEnd = routesSource.indexOf("ensureStudentForEnrollment = async", routeStart);
  const routeSource = routesSource.slice(routeStart, routeEnd);
  const emergencyStart = routeSource.indexOf("if (isEmergencyDbMode())");
  const normalStart = routeSource.indexOf('const { data: existingActivations', emergencyStart);
  const emergencyBranch = routeSource.slice(emergencyStart, normalStart);

  assert.ok(routeStart >= 0);
  assert.ok(routeEnd > routeStart);
  assert.match(emergencyBranch, /pool\.query/);
  assert.match(emergencyBranch, /INSERT INTO public\.topic_conditioning_activations/);
  assert.doesNotMatch(emergencyBranch, /supabase\./);
  assert.match(routeSource, /storage\.getStudent\(studentId\)/);
  assert.match(routeSource, /Unauthorized: Student does not belong to this tutor/);
});

test("emergency tutor mode prefers the exact assignment certification mode", () => {
  assert.equal(resolveEmergencyTutorMode({ assignmentMode: "training", certificationMode: "sandbox" }), "sandbox");
  assert.equal(resolveEmergencyTutorMode({ assignmentMode: "training" }), "training");
});

test("emergency tracking report mapping preserves parent report contract", () => {
  assert.deepEqual(mapEmergencyTutorParentReport({
    id: "report-1",
    tutor_id: "tutor-1",
    student_id: "student-1",
    parent_id: "parent-1",
    report_type: "weekly",
    week_number: 2,
    summary: "summary",
    parent_feedback: "Keep going",
    sent_at: "2026-09-08T00:00:00.000Z",
  }, { weekStartDate: "2026-09-01" }), {
    id: "report-1",
    tutorId: "tutor-1",
    studentId: "student-1",
    parentId: "parent-1",
    reportType: "weekly",
    weekNumber: 2,
    monthName: undefined,
    summary: "summary",
    topicsLearned: undefined,
    strengths: undefined,
    areasForGrowth: undefined,
    bossBattlesCompleted: undefined,
    solutionsUnlocked: undefined,
    confidenceGrowth: undefined,
    nextSteps: undefined,
    parentFeedback: "Keep going",
    parentFeedbackAt: undefined,
    sentAt: "2026-09-08T00:00:00.000Z",
    createdAt: undefined,
    structuredData: { weekStartDate: "2026-09-01" },
  });
});

test("emergency evidence ledger normalizes browser timezone timestamps to UTC ISO", () => {
  assert.equal(
    normalizeEvidenceLedgerTimestamp("Tue Sep 08 2026 12:00:00 GMT+0200 (South Africa Standard Time)"),
    "2026-09-08T10:00:00.000Z",
  );
});

test("Render emergency runtime shares a bounded PostgreSQL pool and uses transaction-mode Supabase pooling", () => {
  const dbSource = readFileSync(resolve(process.cwd(), "server/db.ts"), "utf8");
  const authSource = readFileSync(resolve(process.cwd(), "server/supabaseAuth.ts"), "utf8");

  assert.match(dbSource, /DB_POOL_MAX/);
  assert.match(dbSource, /max:\s*poolMax/);
  assert.match(dbSource, /pooler\\\.supabase\\\.com\)\(\?:\:5432\)\?/);
  assert.match(dbSource, /"\$1:6543"/);
  assert.match(dbSource, /process\.env\.DATABASE_URL\s*=\s*runtimeDatabaseUrl/);
  assert.match(dbSource, /application_name:\s*"response-integrity-api"/);
  assert.doesNotMatch(authSource, /new\s+pg\.Pool/);
  assert.match(authSource, /new PgSession\(\{[\s\S]*?pool,/);
});

test("emergency student auth reads and writes the production database directly", () => {
  const routesSource = readFileSync(resolve(process.cwd(), "server/routes.ts"), "utf8");

  const signupStart = routesSource.indexOf('app.post("/api/student/signup"');
  const signinStart = routesSource.indexOf('app.post("/api/student/signin"', signupStart);
  const meStart = routesSource.indexOf('app.get("/api/student/me"', signinStart);
  const communicationsStart = routesSource.indexOf('app.get("/api/student/communications"', meStart);

  const signupSource = routesSource.slice(signupStart, signinStart);
  const signinSource = routesSource.slice(signinStart, meStart);
  const meSource = routesSource.slice(meStart, communicationsStart);

  assert.match(signupSource, /if \(isEmergencyDbMode\(\)\)/);
  assert.match(signupSource, /FROM public\.onboarding_proposals/);
  assert.match(signupSource, /INSERT INTO public\.student_users/);
  assert.match(signupSource, /upper\(parent_code\) = \$1/);

  assert.match(signinSource, /FROM public\.student_users/);
  assert.match(signinSource, /UPDATE public\.student_users/);

  assert.match(meSource, /FROM public\.student_users/);
  assert.match(meSource, /LEFT JOIN public\.tutor_assignments/);
  assert.match(meSource, /LEFT JOIN public\.pods/);
});

test("emergency student dashboard reads canonical student state from production PostgreSQL", () => {
  const routesSource = readFileSync(resolve(process.cwd(), "server/routes.ts"), "utf8");

  const statsStart = routesSource.indexOf('app.get("/api/student/stats"');
  const commitmentsStart = routesSource.indexOf('app.get("/api/student/commitments"', statsStart);
  const topicStateStart = routesSource.indexOf('app.get("/api/student/topic-conditioning-state"');
  const topicStatesStart = routesSource.indexOf('app.get("/api/student/topic-conditioning-states"', topicStateStart);
  const parentStart = routesSource.indexOf("// PARENT PORTAL ROUTES", topicStatesStart);

  const statsSource = routesSource.slice(statsStart, commitmentsStart);
  const topicStateSource = routesSource.slice(topicStateStart, topicStatesStart);
  const topicStatesSource = routesSource.slice(topicStatesStart, parentStart);

  assert.match(routesSource, /const resolveStudentIdForPortalSession/);
  assert.match(statsSource, /resolveStudentIdForPortalSession\(studentUserId\)/);
  assert.match(topicStateSource, /resolveStudentIdForPortalSession\(studentUserId\)/);
  assert.match(topicStatesSource, /resolveStudentIdForPortalSession\(studentUserId\)/);
  assert.match(topicStateSource, /FROM public\.topic_conditioning_activations/);

  const helperStart = routesSource.indexOf("const getStudentDashboardStats");
  const helperEnd = routesSource.indexOf("const getTTScheduledSessionsByStudent", helperStart);
  const helperSource = routesSource.slice(helperStart, helperEnd);
  assert.match(helperSource, /FROM public\.intro_session_drills/);
  assert.match(helperSource, /FROM public\.training_session_runs/);
  assert.match(helperSource, /FROM public\.student_commitments/);
});

test("emergency parent student stats return stable zero-value contract when no canonical student is linked", () => {
  assert.deepEqual(buildEmergencyParentStudentStats({ sessionCount: 0, commitmentCount: 0 }), {
    introDiagnosisCompleted: 0,
    bossBattlesCompleted: 0,
    solutionsUnlocked: 0,
    confidenceGrowth: 50,
    sessionsCompleted: 0,
    trainingSessionsCompleted: 0,
    currentStreak: 0,
    totalCommitments: 0,
  });
});

test("emergency parent student stats keep canonical drill and training counts", () => {
  assert.deepEqual(buildEmergencyParentStudentStats({
    sessionCount: 7,
    commitmentCount: 2,
    currentStreak: 3,
    introDiagnosisCount: 10,
    trainingSessionCount: 10,
    bossBattlesCompleted: 12,
    solutionsUnlocked: 10,
  }), {
    introDiagnosisCompleted: 10,
    bossBattlesCompleted: 12,
    solutionsUnlocked: 10,
    confidenceGrowth: 50,
    sessionsCompleted: 7,
    trainingSessionsCompleted: 10,
    currentStreak: 3,
    totalCommitments: 2,
  });
});

test("emergency Updates contracts preserve notification history and role visibility", () => {
  assert.deepEqual(mapEmergencyNotification({
    id: "notification-1",
    recipient_user_id: "tutor-1",
    actor_user_id: "parent-1",
    channel: "informational",
    title: "Message",
    message: "A message",
    entity_type: "student_communication",
    entity_id: "message-1",
    is_read: true,
    created_at: "2026-09-08T00:00:00.000Z",
  }), {
    id: "notification-1",
    recipientUserId: "tutor-1",
    actorUserId: "parent-1",
    channel: "informational",
    title: "Message",
    message: "A message",
    link: undefined,
    entityType: "student_communication",
    entityId: "message-1",
    isRead: true,
    readAt: undefined,
    createdAt: "2026-09-08T00:00:00.000Z",
  });
  assert.deepEqual(getEmergencyBroadcastVisibilities("tutor"), ["all", "tutors"]);
  assert.equal(getEmergencyBroadcastVisibilities("tutor").includes("tds"), false);
  assert.deepEqual(mapEmergencyBroadcast({
    id: "broadcast-1",
    subject: null,
    message: "Broadcast",
    sender_role: "coo",
    visibility: "tutors",
    channel: "informational",
    created_at: "2026-09-08T00:00:00.000Z",
  }), {
    id: "broadcast-1",
    subject: "(No Subject)",
    message: "Broadcast",
    senderRole: "coo",
    visibility: "tutors",
    channel: "informational",
    createdAt: "2026-09-08T00:00:00.000Z",
  });
});

test("emergency tutor credential verification accepts bcrypt credentials and rejects plaintext", async () => {
  const hash = await bcrypt.hash("StrongPass!123", 10);
  assert.equal(await verifyEmergencyCredential(hash, "StrongPass!123"), true);
  assert.equal(await verifyEmergencyCredential(hash, "wrong-pass"), false);
  assert.equal(await verifyEmergencyPasswordForUser(hash, "StrongPass!123"), true);
  assert.equal(await verifyEmergencyPasswordForUser(hash, "StrongPass!123\n"), false);
});

test("emergency encrypted document bundles round-trip and detect tampering", async () => {
  const testKey = "0123456789abcdef0123456789abcdef";

  const bundle = createEmergencyFileBundle(
    Buffer.from("sensitive file content"),
    testKey,
  );

  assert.equal(
    bundle.sha256,
    "10d4d5e5ad0d78e62cb35a3ad13bbcf9b273ee1b84ab10578b0605c81c2fd3f0",
  );

  const decrypted = decryptEmergencyFileBundle(bundle, testKey);
  assert.equal(decrypted.toString("utf8"), "sensitive file content");

  const tampered = {
    ...bundle,
    ciphertext: Buffer.concat([
      bundle.ciphertext.subarray(0, 4),
      Buffer.from([0, 0, 0, 0]),
      bundle.ciphertext.subarray(8),
    ]),
  };

  assert.throws(() =>
    decryptEmergencyFileBundle(tampered as any, testKey),
  );
});

test("emergency signin rejects an expectedRole mismatch", () => {
  assert.equal(emergencyExpectedRoleMatches("tutor", "parent"), false);
  assert.equal(emergencyExpectedRoleMatches("tutor", "tutor"), true);
});

test("non-tutor emergency signup is rejected", () => {
  const authSource = readFileSync(resolve(process.cwd(), "server/supabaseAuth.ts"), "utf8");
  assert.match(authSource, /if \(role !== "tutor"\) \{[\s\S]*?status\(503\)/);
});

test("emergency tutor signup cannot invoke Supabase HTTP", () => {
  const authSource = readFileSync(resolve(process.cwd(), "server/supabaseAuth.ts"), "utf8");
  const emergencyBranch = authSource.slice(
    authSource.indexOf("if (isEmergencyDbMode()) {", authSource.indexOf('app.post("/api/auth/signup"')),
    authSource.indexOf("// Create user in Supabase Auth with metadata"),
  );
  assert.doesNotMatch(emergencyBranch, /supabase\.(auth|from)|fetch\(/);
  assert.match(emergencyBranch, /createEmergencyTutorAccount\(/);
});

test("client emergency signup and login do not invoke Supabase Auth", () => {
  const authFormSource = readFileSync(
    resolve(process.cwd(), "client/src/components/auth/auth-form.tsx"),
    "utf8",
  );
  const signupBranch = authFormSource.slice(
    authFormSource.indexOf('if (mode === "signup")'),
    authFormSource.indexOf('if (mode === "login")'),
  );
  const emergencySignupBlock = signupBranch.slice(
    signupBranch.indexOf("if (emergencyDbMode)"),
    signupBranch.indexOf("const response = await fetch"),
  );
  assert.doesNotMatch(emergencySignupBlock, /supabase\.auth/);
  assert.match(authFormSource, /if \(!emergencyDbMode\) \{[\s\S]*?supabase\.auth\.signInWithPassword/);
});

test("emergency tutor application submission cannot invoke Supabase HTTP", () => {
  const routesSource = readFileSync(resolve(process.cwd(), "server/routes.ts"), "utf8");
  const applicationRouteStart = routesSource.indexOf('"/api/tutor/application"');
  const emergencyBranchStart = routesSource.indexOf("if (isEmergencyDbMode())", applicationRouteStart);
  const normalBranchStart = routesSource.indexOf("let durableProductionCode", emergencyBranchStart);
  const emergencyBranch = routesSource.slice(emergencyBranchStart, normalBranchStart);

  assert.match(emergencyBranch, /createTutorApplicationEmergency\(/);
  assert.doesNotMatch(emergencyBranch, /supabase\.|createTutorApplication\(/);
  assert.match(emergencyBranch, /userId/);
});

test("emergency application submission matches normal duplicate insert semantics", () => {
  const routesSource = readFileSync(resolve(process.cwd(), "server/routes.ts"), "utf8");
  const storageSource = readFileSync(resolve(process.cwd(), "server/storage.ts"), "utf8");
  const applicationRouteStart = routesSource.indexOf('"/api/tutor/application"');
  const normalStorageStart = storageSource.indexOf("async createTutorApplication(application: any)");
  const emergencyStorageStart = storageSource.indexOf("async createTutorApplicationEmergency(application: any)");
  const normalStorage = storageSource.slice(normalStorageStart, emergencyStorageStart);
  const emergencyStorage = storageSource.slice(emergencyStorageStart, storageSource.indexOf("async getTutorApplicationsByUser", emergencyStorageStart));

  assert.match(routesSource.slice(applicationRouteStart, routesSource.indexOf("let durableProductionCode", applicationRouteStart)), /getTutorApplicationsByUser\(userId\)/);
  assert.match(normalStorage, /\.from\("tutor_applications"\)\s*\n\s*\.insert\(/);
  assert.doesNotMatch(normalStorage, /\.upsert\(|\.update\(/);
  assert.equal((emergencyStorage.match(/INSERT INTO public\.tutor_applications/g) || []).length, 1);
  assert.match(emergencyStorage, /RETURNING \*/);
});

test("emergency executive gateway cannot invoke Supabase HTTP", () => {
  const source = readFileSync(resolve(process.cwd(), "server/routes/executiveCommandRhythm.ts"), "utf8");
  const gatewayStart = source.indexOf('"/api/executive/gateway"');
  const gatewayEnd = source.indexOf('app.put(', gatewayStart);
  const gatewaySource = source.slice(gatewayStart, gatewayEnd);
  assert.doesNotMatch(gatewaySource, /supabase\.|\.storage\.|fetch\(/);
  assert.match(source, /FROM public\.users/);
  assert.match(source, /FROM public\.executive_role_appointments/);
});

test("COO Production Link creation keeps the authoritative server session usable without a client Supabase token", () => {
  const source = readFileSync(resolve(process.cwd(), "client/src/pages/executive/coo/dashboard.tsx"), "utf8");
  const start = source.indexOf("const handleCreateAffiliate");
  const end = source.indexOf("// Delete pilot request mutation", start);
  const handler = source.slice(start, end);

  assert.doesNotMatch(handler, /if \(!accessToken\) throw/);
  assert.match(handler, /credentials:\s*"include"/);
  assert.match(handler, /if \(accessToken\) \{[\s\S]*headers\.Authorization/);
});

test("executive dashboard queries do not poll restricted emergency endpoints", () => {
  const metricsSource = readFileSync(resolve(process.cwd(), "client/src/pages/executive/hr/dashboard.tsx"), "utf8");
  const trafficSource = readFileSync(resolve(process.cwd(), "client/src/pages/executive/hr/traffic.tsx"), "utf8");
  const cooDashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/executive/coo/dashboard.tsx"), "utf8");
  const cooApplicationsSource = readFileSync(resolve(process.cwd(), "client/src/pages/executive/coo/applications.tsx"), "utf8");
  const gatewaySource = readFileSync(resolve(process.cwd(), "client/src/pages/executive/gateway.tsx"), "utf8");
  const ceoBoardSource = readFileSync(resolve(process.cwd(), "client/src/pages/executive/ceo/board.tsx"), "utf8");
  const layoutSource = readFileSync(resolve(process.cwd(), "client/src/components/layout/dashboard-layout.tsx"), "utf8");

  for (const source of [metricsSource, trafficSource, cooDashboardSource, cooApplicationsSource, gatewaySource, ceoBoardSource, layoutSource]) {
    assert.doesNotMatch(source, /refetchInterval:\s*10000/);
    assert.doesNotMatch(source, /refetchInterval:\s*5000/);
    assert.doesNotMatch(source, /refetchInterval:\s*60000/);
    assert.doesNotMatch(source, /refetchIntervalInBackground:\s*true/);
    assert.doesNotMatch(source, /refetchOnWindowFocus:\s*true/);
    assert.doesNotMatch(source, /retry:\s*undefined/);
  }

  assert.match(metricsSource, /refetchInterval:\s*false/);
  assert.match(trafficSource, /refetchInterval:\s*false/);
  assert.match(cooDashboardSource, /refetchInterval:\s*false/);
  assert.match(cooApplicationsSource, /refetchInterval:\s*false/);
  assert.match(gatewaySource, /refetchInterval:\s*false/);
  assert.match(ceoBoardSource, /refetchInterval:\s*false/);
  assert.match(layoutSource, /refetchInterval:\s*false/);
});

test("appointed COO resolves as current user from the canonical appointment", () => {
  const roster = buildExecutiveRosterFromRows(
    "coo-1",
    "coo",
    [{ id: "coo-1", email: "coo@example.com", name: "COO", role: "coo", createdAt: null, updatedAt: null }],
    [{
      id: "appointment-1",
      role: "coo",
      appointedUserId: "coo-1",
      appointedByUserId: "ceo-1",
      notes: null,
      appointedAt: null,
      createdAt: null,
      updatedAt: null,
    }],
  );
  assert.equal(roster.isCurrentUserAppointed, true);
});

test("unappointed executive remains unappointed even when public role is executive", () => {
  const roster = buildExecutiveRosterFromRows(
    "coo-1",
    "coo",
    [{ id: "coo-1", email: "coo@example.com", name: "COO", role: "coo", createdAt: null, updatedAt: null }],
    [],
  );
  assert.equal(roster.isCurrentUserAppointed, false);
});

test("emergency executive gateway roster preserves the normal response contract", () => {
  const roster = buildExecutiveRosterFromRows("coo-1", "coo", [], []);
  const response = {
    executiveRoleOptions: ["ceo", "coo", "hr", "cto", "cmo"].map((role) => ({ role })),
    currentUser: roster.currentUser,
    mySeat: null,
    bootstrapMode: roster.bootstrapMode,
    canManageAppointments: roster.canManageAppointments,
    dashboardRoute: "/executive/coo/dashboard",
    seats: roster.seats,
  };
  assert.deepEqual(Object.keys(response), [
    "executiveRoleOptions",
    "currentUser",
    "mySeat",
    "bootstrapMode",
    "canManageAppointments",
    "dashboardRoute",
    "seats",
  ]);
  assert.equal(response.seats.length, 5);
});

test("emergency tutor-applications list uses direct PostgreSQL without Supabase HTTP", () => {
  const storageSource = readFileSync(resolve(process.cwd(), "server/storage.ts"), "utf8");
  const listStart = storageSource.indexOf("async getTutorApplications(application");
  const allListStart = storageSource.indexOf("async getTutorApplications(): Promise", listStart);
  const statusListStart = storageSource.indexOf("async getTutorApplicationsByStatus", allListStart);
  const allList = storageSource.slice(allListStart, statusListStart);
  const statusListEnd = storageSource.indexOf("async approveTutorApplication", statusListStart);
  const statusList = storageSource.slice(statusListStart, statusListEnd);

  assert.match(allList, /if \(isEmergencyDbMode\(\)\)/);
  assert.match(statusList, /FROM public\.tutor_applications/);
  assert.doesNotMatch(allList.slice(0, allList.indexOf("const { data, error }")), /supabase\./);
  assert.doesNotMatch(statusList.slice(0, statusList.indexOf("const { data, error }")), /supabase\./);
  assert.match(allList, /ORDER BY created_at DESC/);
  assert.match(statusList, /WHERE status = \$1[\s\S]*ORDER BY created_at DESC/);
});

test("pending Specialist application appears in the emergency review list", () => {
  const rows = [
    { id: "application-1", user_id: "tutor-1", status: "pending", created_at: "2026-09-09T10:00:00.000Z" },
  ];
  const pending = rows.filter((row) => row.status === "pending").sort((left, right) =>
    right.created_at.localeCompare(left.created_at),
  );
  assert.equal(pending[0]?.id, "application-1");
});

test("emergency Specialist approval uses direct PostgreSQL and exact Step-1 state", () => {
  const storageSource = readFileSync(resolve(process.cwd(), "server/storage.ts"), "utf8");
  const approveStart = storageSource.indexOf("async approveTutorApplication");
  const approveEnd = storageSource.indexOf("async rejectTutorApplication", approveStart);
  const approveMethod = storageSource.slice(approveStart, approveEnd);
  assert.match(approveMethod, /if \(isEmergencyDbMode\(\)\)/);
  assert.match(approveMethod, /UPDATE public\.tutor_applications/);
  assert.match(approveMethod, /status = 'approved'/);
  assert.match(approveMethod, /reviewed_by = \$2/);
  assert.match(approveMethod, /reviewed_at = now\(\)/);
  assert.match(approveMethod, /document_submission_step = 1/);
  assert.match(approveMethod, /documents_status = \$3::jsonb/);
  assert.match(approveMethod, /updated_at = now\(\)/);
  assert.equal((approveMethod.match(/UPDATE public\.tutor_applications/g) || []).length, 1);
  assert.doesNotMatch(approveMethod.slice(0, approveMethod.indexOf("const { data, error }")), /supabase\./);
});

test("only COO authorization can reach Specialist application review routes", () => {
  const routesSource = readFileSync(resolve(process.cwd(), "server/routes.ts"), "utf8");
  const reviewStart = routesSource.indexOf('"/api/coo/tutor-applications/:id/approve"');
  const reviewEnd = routesSource.indexOf("// EGP / AFFILIATE GATEWAY ROUTES", reviewStart);
  const reviewRoutes = routesSource.slice(reviewStart, reviewEnd);
  assert.match(reviewRoutes, /requireRole\(\["coo"\]\)/g);
  assert.doesNotMatch(reviewRoutes, /requireRole\(\["tutor"\]\)/);
});

test("snake-to-camel conversion preserves PostgreSQL application timestamps", () => {
  const converted = transformSnakeToCamel({
    created_at: new Date("2026-09-09T04:18:17.567Z"),
  });
  assert.equal(converted.createdAt, "2026-09-09T04:18:17.567Z");
  assert.notDeepEqual(converted.createdAt, {});
});

test("malformed Specialist application dates render a safe fallback", () => {
  assert.equal(formatApplicationDate(null), "Date unavailable");
  assert.equal(formatApplicationDate("not-a-date"), "Date unavailable");
  assert.match(formatApplicationDate("2026-09-09T04:18:17.567Z"), /2026/);
});

test("emergency Step 2 COO review uses direct PostgreSQL and preserves the false-404 regression contract", () => {
  const storageSource = readFileSync(resolve(process.cwd(), "server/storage.ts"), "utf8");
  const methodStart = storageSource.indexOf("async reviewTutorSequentialDocument(");
  const methodEnd = storageSource.indexOf("async completeTutorOnboarding", methodStart);
  const method = storageSource.slice(methodStart, methodEnd);

  assert.match(method, /if \(isEmergencyDbMode\(\)\)/);
  assert.match(method, /FROM public\.tutor_applications/);
  assert.match(method, /FOR UPDATE/);
  assert.match(method, /await client\.query\("BEGIN"\)/);
  assert.match(method, /await client\.query\("ROLLBACK"\)/);
  assert.match(method, /Emergency database read failed/i);
  assert.match(method, /WHERE id = \$1[\s\S]*FOR UPDATE/);
  assert.doesNotMatch(method, /supabase\.(from|auth)|\.storage\./);
});

test("emergency Step 2 COO review state transitions preserve the canonical review semantics", () => {
  const storageSource = readFileSync(resolve(process.cwd(), "server/storage.ts"), "utf8");
  const methodStart = storageSource.indexOf("async reviewTutorSequentialDocument(");
  const methodEnd = storageSource.indexOf("async completeTutorOnboarding", methodStart);
  const method = storageSource.slice(methodStart, methodEnd);
  const emergencyBranchStart = method.indexOf("if (isEmergencyDbMode())");
  const emergencyBranchEnd = method.indexOf("const { data: existing", emergencyBranchStart);
  const emergencyBranch = method.slice(emergencyBranchStart, emergencyBranchEnd);

  assert.match(method, /updatedDocumentsStatus\[docStep\.toString\(\)\] = "approved"/);
  assert.match(method, /updatedDocumentsStatus\[nextStep\] = "pending_upload"/);
  assert.match(method, /targetStep = approved \? \(docStep < 6 \? docStep \+ 1 : 6\) : docStep/);
  assert.match(method, /documents_status = \$1::jsonb/);
  assert.match(method, /document_submission_step = \$2::integer/);
  assert.match(method, /\$\{fields\.verified\} = \$\$\{nextPlaceholder\}::boolean/);
  assert.match(method, /const verifiedByCast = docStep === 6 \? "uuid" : "varchar"/);
  assert.match(method, /\$\{fields\.verifiedBy\} = \$\$\{nextPlaceholder \+ 1\}::\$\{verifiedByCast\}/);
  assert.match(method, /\$\{fields\.rejectionReason\} = \$\$\{nextPlaceholder \+ 1\}::text/);
  assert.doesNotMatch(emergencyBranch, /completedTemplateUploadedAt/);
  assert.doesNotMatch(emergencyBranch, /completedTemplateUploadedBy/);
});

test("emergency Step 2/6 COO review binds reviewer ids with the correct schema casts", () => {
  const storageSource = readFileSync(resolve(process.cwd(), "server/storage.ts"), "utf8");
  const methodStart = storageSource.indexOf("async reviewTutorSequentialDocument(");
  const methodEnd = storageSource.indexOf("async completeTutorOnboarding", methodStart);
  const method = storageSource.slice(methodStart, methodEnd);

  assert.match(method, /const verifiedByCast = docStep === 6 \? "uuid" : "varchar"/);
  assert.match(method, /docStep === 6 \? "uuid" : "varchar"/);
  assert.doesNotMatch(method, /::varchar\s*\n\s*\$\$\{fields\.verifiedBy\} = \$\$\{nextPlaceholder \+ 1\}::varchar/);
  assert.doesNotMatch(method, /::uuid\s*\n\s*\$\$\{fields\.verifiedBy\} = \$\$\{nextPlaceholder \+ 1\}::uuid/);
});

test("emergency Step 2/6 COO review binds reviewer ids with the correct schema casts", () => {
  const storageSource = readFileSync(resolve(process.cwd(), "server/storage.ts"), "utf8");
  const methodStart = storageSource.indexOf("async reviewTutorSequentialDocument(");
  const methodEnd = storageSource.indexOf("async completeTutorOnboarding", methodStart);
  const method = storageSource.slice(methodStart, methodEnd);
  const emergencyBranchStart = method.indexOf("if (isEmergencyDbMode())");
  const emergencyBranchEnd = method.indexOf("const { data: existing", emergencyBranchStart);
  const emergencyBranch = method.slice(emergencyBranchStart, emergencyBranchEnd);

  assert.match(method, /const verifiedByCast = docStep === 6 \? "uuid" : "varchar"/);
  assert.match(method, /\$\{fields\.verifiedBy\} = \$\$\{nextPlaceholder \+ 1\}::\$\{verifiedByCast\}/);
  assert.doesNotMatch(emergencyBranch, /completedTemplateUploadedAt/);
  assert.doesNotMatch(emergencyBranch, /completedTemplateUploadedBy/);
});

test("emergency Step 1 acceptance uses direct PostgreSQL only", () => {
  const storageSource = readFileSync(resolve(process.cwd(), "server/storage.ts"), "utf8");
  const methodStart = storageSource.indexOf("async createTutorOnboardingAcceptance(");
  const emergencyStart = storageSource.indexOf("if (isEmergencyDbMode())", methodStart);
  const normalStart = storageSource.indexOf("const { data: existing", emergencyStart);
  const emergencyMethod = storageSource.slice(emergencyStart, normalStart);
  assert.match(emergencyMethod, /BEGIN/);
  assert.match(emergencyMethod, /COMMIT/);
  assert.match(emergencyMethod, /ROLLBACK/);
  assert.doesNotMatch(emergencyMethod, /supabase\.|\.storage\.|fetch\(/);
});

test("emergency Step 2 acceptance uses explicit SQL casts and keeps Step 2 pending upload", () => {
  const storageSource = readFileSync(resolve(process.cwd(), "server/storage.ts"), "utf8");
  const methodStart = storageSource.indexOf("async createTutorOnboardingAcceptance(");
  const emergencyStart = storageSource.indexOf("if (isEmergencyDbMode())", methodStart);
  const normalStart = storageSource.indexOf("const { data: existing", emergencyStart);
  const emergencyMethod = storageSource.slice(emergencyStart, normalStart);

  assert.match(emergencyMethod, /documentsStatus\[input\.documentStep\.toString\(\)\] = isAcceptanceOnlyStep \? "approved" : "pending_upload"/);
  assert.match(emergencyMethod, /documents_status = \$1::jsonb/);
  assert.match(emergencyMethod, /document_submission_step = \$2::integer/);
  assert.match(emergencyMethod, /updated_at = \$3::timestamptz/);
  assert.match(emergencyMethod, /WHERE id = \$4/);
  assert.doesNotMatch(emergencyMethod, /doc_2_submission_verified_by = \$5::varchar/);
});

test("emergency Step 2 upload requires Step 2 acceptance and never calls Supabase Storage", () => {
  const routesSource = readFileSync(resolve(process.cwd(), "server/routes.ts"), "utf8");
  const uploadRouteStart = routesSource.indexOf('"/api/tutor/onboarding-documents/upload"');
  const emergencyBranchStart = routesSource.indexOf("if (isEmergencyDbMode())", uploadRouteStart);
  const nonEmergencyStart = routesSource.indexOf("// Decode base64 file data", emergencyBranchStart);
  const emergencyBranch = routesSource.slice(emergencyBranchStart, nonEmergencyStart);

  assert.match(routesSource, /You must accept Response Integrity-EQV-002 in app before uploading your certified Matric certificate\./);
  assert.match(emergencyBranch, /private\.emergency_tutor_onboarding_files/);
  assert.match(emergencyBranch, /createEmergencyFileBundle\(/);
  assert.match(emergencyBranch, /documentsStatus\["2"\] = "pending_review"/);
  assert.match(emergencyBranch, /documentsStatus\["3"\] = "not_started"/);
  assert.doesNotMatch(emergencyBranch, /supabase\.storage|fetch\(/);
});

test("emergency Step 6 upload uses direct PostgreSQL state guards and does not require a fake acceptance row", () => {
  const routesSource = readFileSync(resolve(process.cwd(), "server/routes.ts"), "utf8");
  const uploadRouteStart = routesSource.indexOf('"/api/tutor/onboarding-documents/upload"');
  const emergencyBranchStart = routesSource.indexOf("if (isEmergencyDbMode())", uploadRouteStart);
  const nonEmergencyStart = routesSource.indexOf("// Decode base64 file data", emergencyBranchStart);
  const emergencyBranch = routesSource.slice(emergencyBranchStart, nonEmergencyStart);

  assert.match(emergencyBranch, /parsedDocStep === 6/);
  assert.match(emergencyBranch, /Steps 1 through 5 must all be approved/i);
  assert.match(emergencyBranch, /document_submission_step = 6/);
  assert.match(emergencyBranch, /documentsStatus\["6"\] = "pending_review"/);
  assert.match(emergencyBranch, /onboarding_completed_at = NULL/);
  assert.match(emergencyBranch, /doc_6_submission_url = \$2/);
  assert.match(emergencyBranch, /doc_6_submission_uploaded_at = now\(\)/);
  assert.match(emergencyBranch, /doc_6_submission_verified = false/);
  assert.match(emergencyBranch, /doc_6_submission_verified_by = NULL/);
  assert.match(emergencyBranch, /doc_6_submission_verified_at = NULL/);
  assert.match(emergencyBranch, /doc_6_submission_rejection_reason = NULL/);
  assert.doesNotMatch(emergencyBranch, /onboardingAcceptanceMap\?\.\["6"\]/);
  assert.doesNotMatch(emergencyBranch, /Supabase.*Storage|fetch\(/);
});

test("emergency protected file retrieval normalizes bytea and verifies decrypted SHA-256", () => {
  const routesSource = readFileSync(resolve(process.cwd(), "server/routes.ts"), "utf8");
  const getFileRouteStart = routesSource.indexOf('"/api/tutor/onboarding-documents/:docStep/file"');
  const getFileRouteEnd = routesSource.indexOf('app.get(', getFileRouteStart);
  const getFileRoute = routesSource.slice(getFileRouteStart, getFileRouteEnd);

  assert.match(getFileRoute, /normalizeBytea/);
  assert.match(getFileRoute, /createHash\("sha256"\)/);
  assert.match(getFileRoute, /Emergency document integrity check failed: SHA-256 mismatch\./);
  assert.ok(getFileRoute.includes("rawFileName.split(/[\\\\/]/).pop()"));
  assert.ok(getFileRoute.includes('safeFilename.replace(/[\\r\\n"]/g, "_")'));
  assert.match(getFileRoute, /Cache-Control", "private, no-store"/);
});

test("emergency Step 1 acceptance enforces ownership, approval, current step, and duplicate protection", () => {
  const storageSource = readFileSync(resolve(process.cwd(), "server/storage.ts"), "utf8");
  const methodStart = storageSource.indexOf("async createTutorOnboardingAcceptance(");
  const emergencyStart = storageSource.indexOf("if (isEmergencyDbMode())", methodStart);
  const normalStart = storageSource.indexOf("const { data: existing", emergencyStart);
  const emergencyMethod = storageSource.slice(emergencyStart, normalStart);
  assert.match(emergencyMethod, /AND user_id = \$2/);
  assert.match(emergencyMethod, /existing\.status !== "approved"/);
  assert.match(emergencyMethod, /currentStep/);
  assert.match(emergencyMethod, /already been accepted/);
  assert.match(emergencyMethod, /FOR UPDATE/);
});

test("emergency Step 1 acceptance writes evidence atomically and advances exactly to Step 2", () => {

  test("emergency application hydration rehydrates persisted Step 1 acceptance for Step 2", () => {
    const acceptedAt = "2026-09-09T04:18:17.567Z";
    const application = mergeTutorApplicationOnboardingState(
      {
        id: "application-1",
        userId: "tutor-1",
        status: "approved",
        documentSubmissionStep: 2,
        documentsStatus: { "1": "approved", "2": "pending_upload" },
      } as any,
      [{
        documentStep: 1,
        acceptedAt,
        formSnapshotJson: { idType: "passport" },
        acceptedClausesJson: ["platform_rules"],
        documentChecksum: "checksum-1",
        typedFullName: "Testie Tester",
      }],
    );

    assert.equal(application.onboardingAcceptanceMap["1"].acceptedAt, acceptedAt);
    assert.equal(application.onboardingAcceptanceMap["1"].formSnapshotJson.idType, "passport");
    assert.equal(application.documentsStatus["1"], "approved");
    assert.equal(application.documentSubmissionStep, 2);
  });

  test("emergency application hydration path uses PostgreSQL acceptance reads without Supabase", () => {
    const storageSource = readFileSync(resolve(process.cwd(), "server/storage.ts"), "utf8");
    const emergencyHydrationStart = storageSource.indexOf("async function hydrateTutorApplicationsWithOnboardingStateEmergency");
    const emergencyHydrationEnd = storageSource.indexOf("export function mergeTutorApplicationOnboardingState", emergencyHydrationStart);
    const emergencyHydration = storageSource.slice(emergencyHydrationStart, emergencyHydrationEnd);
    assert.match(emergencyHydration, /FROM public\.tutor_onboarding_acceptances/);
    assert.doesNotMatch(emergencyHydration, /supabase\.|fetch\(/);
  });
  const storageSource = readFileSync(resolve(process.cwd(), "server/storage.ts"), "utf8");
  const methodStart = storageSource.indexOf("async createTutorOnboardingAcceptance(");
  const emergencyStart = storageSource.indexOf("if (isEmergencyDbMode())", methodStart);
  const normalStart = storageSource.indexOf("const { data: existing", emergencyStart);
  const emergencyMethod = storageSource.slice(emergencyStart, normalStart);
  assert.match(emergencyMethod, /tutor_onboarding_acceptances/);
  assert.match(emergencyMethod, /tutor_onboarding_clause_acknowledgements/);
  assert.match(emergencyMethod, /tutor_onboarding_acceptance_events/);
  assert.match(emergencyMethod, /documentsStatus\[input\.documentStep\.toString\(\)\] = isAcceptanceOnlyStep \? "approved"/);
  assert.match(emergencyMethod, /input\.documentStep \+ 1/);
  assert.equal((emergencyMethod.match(/INSERT INTO public\./g) || []).length, 3);
  assert.match(emergencyMethod, /UPDATE public\.tutor_applications/);
  assert.match(emergencyMethod, /finally \{[\s\S]*client\.release\(\)/);
});

test("emergency Step 1 JSONB parameters are JSON strings, not PostgreSQL arrays", () => {
  const acceptedClauses = toJsonbParam(["platform_rules", "evidence_integrity"]);
  const formSnapshot = toJsonbParam({ idType: "passport", dateOfBirth: "" });
  const documentStatus = toJsonbParam({ "1": "approved", "2": "pending_upload" });

  assert.equal(typeof acceptedClauses, "string");
  assert.equal(acceptedClauses, '["platform_rules","evidence_integrity"]');
  assert.equal(acceptedClauses.startsWith("{"), false);
  assert.deepEqual(JSON.parse(acceptedClauses), ["platform_rules", "evidence_integrity"]);
  assert.deepEqual(JSON.parse(formSnapshot), { idType: "passport", dateOfBirth: "" });
  assert.deepEqual(JSON.parse(documentStatus), { "1": "approved", "2": "pending_upload" });
});

test("emergency encryption rejects invalid keys and preserves the failure-closed contract", () => {
  assert.throws(
    () => parseEmergencyDocumentEncryptionKey(""),
    /EMERGENCY_DOCUMENT_ENCRYPTION_KEY is required/i,
  );
  assert.throws(
    () => createEmergencyFileBundle(Buffer.from("abc"), "not-a-32-byte-key"),
    /EMERGENCY_DOCUMENT_ENCRYPTION_KEY must resolve to exactly 32 bytes/i,
  );
});

test("signin keeps account-existence details server-side while returning enumeration-safe public copy", () => {
  const authSource = readFileSync(resolve(process.cwd(), "server/supabaseAuth.ts"), "utf8");
  assert.match(authSource, /internalReason: result\.reason/);
  assert.match(authSource, /Email or password is incorrect/);
  assert.match(authSource, /Too many login attempts\. Please wait a few minutes and try again\./);
  assert.doesNotMatch(authSource, /res\.status\(401\)\.json\(\{ message: "Account not found"/);
  assert.doesNotMatch(authSource, /res\.status\(401\)\.json\(\{ message: "Wrong password"/);
});


test("emergency mode drift self-heals assignment only in Vercel Preview", () => {
  const routesSource = readFileSync(resolve(process.cwd(), "server/routes.ts"), "utf8");
  const modeStart = routesSource.indexOf("async function getTutorCertificationMode");
  const modeEnd = routesSource.indexOf("async function getTutorSandboxReadiness", modeStart);
  const modeSource = routesSource.slice(modeStart, modeEnd);

  assert.match(modeSource, /process\.env\.VERCEL_ENV === "preview"/);
  assert.match(modeSource, /UPDATE public\.tutor_assignments/);
  assert.match(modeSource, /SET operational_mode = \$1/);
  assert.match(modeSource, /AND tutor_id = \$3/);
  assert.match(modeSource, /operational_mode <> \$1/);
  assert.match(modeSource, /preview assignment repaired/);
  assert.match(modeSource, /return resolveEmergencyTutorMode\(\{ assignmentMode, certificationMode \}\)/);
});


test("training shadow comparison maps legacy snake-case transition before comparing", () => {
  const routesSource = readFileSync(resolve(process.cwd(), "server/routes.ts"), "utf8");
  const summaryStart = routesSource.indexOf("const computeTrainingSessionSummary");
  const summaryEnd = routesSource.indexOf("const mapDrillRowToDeterministicSession", summaryStart);
  const summarySource = routesSource.slice(summaryStart, summaryEnd);

  assert.match(summarySource, /nextPhase: transition\.next_phase/);
  assert.match(summarySource, /nextStability: transition\.next_stability/);
  assert.match(summarySource, /transitionReason: normalizeTransitionReason\(transition\.transition_reason\)/);
  assert.doesNotMatch(summarySource, /legacyTransition: transition,/);
});

test("training shadow recovery can call transition reason normalization before its source declaration", () => {
  const routesSource = readFileSync(resolve(process.cwd(), "server/routes.ts"), "utf8");
  const recoveryStart = routesSource.indexOf("const repairRecentPreviewTrainingShadowComparison");
  const helperStart = routesSource.indexOf("function normalizeTransitionReason");

  assert.ok(recoveryStart >= 0);
  assert.ok(helperStart > recoveryStart);
  assert.match(routesSource, /function normalizeTransitionReason\(value: unknown\): TransitionReason/);
  assert.doesNotMatch(routesSource, /const normalizeTransitionReason =/);
});

test("preview startup repairs one recent real training shadow row in normal or emergency auth mode", () => {
  const routesSource = readFileSync(resolve(process.cwd(), "server/routes.ts"), "utf8");
  const repairStart = routesSource.indexOf("const repairRecentPreviewTrainingShadowComparison");
  const repairEnd = routesSource.indexOf("type NormalizedEvidenceSet", repairStart);
  const repairSource = routesSource.slice(repairStart, repairEnd);

  assert.match(repairSource, /process\.env\.VERCEL_ENV !== "preview"/);
  assert.doesNotMatch(
    repairSource,
    /VERCEL_ENV !== "preview"\s*\|\|\s*!isEmergencyDbMode\(\)/,
  );
  assert.match(repairSource, /if \(isEmergencyDbMode\(\)\)/);
  assert.match(repairSource, /d\.submitted_at >= NOW\(\) - INTERVAL '8 hours'/);
  assert.match(repairSource, /\.from\("intro_session_drills"\)/);
  assert.match(repairSource, /\.from\("training_evidence_shadow_comparisons"\)/);
  assert.match(repairSource, /\.gte\("submitted_at", cutoff\)/);
  assert.match(repairSource, /candidateDrill\?\.drillType !== "training"/);
  assert.match(repairSource, /evidenceShadow\?\.status !== "evaluated"/);
  assert.match(repairSource, /compareTrainingEvidenceShadowToLegacy/);
  assert.match(repairSource, /await persistTrainingShadowComparison/);
  assert.match(repairSource, /LIMIT 1/);
  assert.match(repairSource, /previewTrainingShadowRecoveryStatus/);
  assert.match(repairSource, /\/api\/proof\/training-shadow-recovery-status/);
  const diagnosticRouteStart = repairSource.indexOf(
    '"/api/proof/training-shadow-recovery-status"',
  );
  const diagnosticRouteSource = repairSource.slice(
    diagnosticRouteStart,
    repairSource.indexOf("type NormalizedEvidenceSet", diagnosticRouteStart),
  );
  assert.doesNotMatch(diagnosticRouteSource, /isAuthenticated/);
  assert.match(diagnosticRouteSource, /candidateFound/);
  assert.match(diagnosticRouteSource, /comparisonCreated/);
  assert.match(diagnosticRouteSource, /failureKind/);
  assert.doesNotMatch(diagnosticRouteSource, /\.\.\.previewTrainingShadowRecoveryStatus/);
  assert.match(repairSource, /VERCEL_GIT_COMMIT_SHA/);
});


test("sandbox family scheduling keeps payment authority separate from sandbox quota state", () => {
  const routesSource = readFileSync(resolve(process.cwd(), "server/routes.ts"), "utf8");

  const accessStart = routesSource.indexOf("async function ensurePremiumAccessForParent");
  const accessEnd = routesSource.indexOf("async function ensurePremiumAccessForStudent", accessStart);
  const accessSource = routesSource.slice(accessStart, accessEnd);

  assert.ok(accessStart >= 0);
  assert.ok(accessEnd > accessStart);
  assert.doesNotMatch(accessSource, /hasActiveSandboxMembership/);
  assert.doesNotMatch(accessSource, /onboardingType:\s*"sandbox"/);

  const billingStart = routesSource.indexOf("async function getParentBillingModel");
  const billingEnd = routesSource.indexOf("function parseStoredDrillPayload", billingStart);
  const billingSource = routesSource.slice(billingStart, billingEnd);
  assert.match(billingSource, /if \(isEmergencyDbMode\(\)\)/);
  assert.match(billingSource, /FROM public\.parents/);
  assert.match(billingSource, /FROM public\.parent_enrollments/);
  assert.match(billingSource, /is_sandbox_account/);
  assert.match(billingSource, /demand_flow_version/);
  assert.match(billingSource, /enrollmentEntryType/);

  const paidParentStart = routesSource.indexOf("async function getLatestPaidPaymentForParent");
  const paidParentEnd = routesSource.indexOf("const RESCHEDULE_LIMIT_PER_SESSION_PER_MONTH", paidParentStart);
  const paidParentSource = routesSource.slice(paidParentStart, paidParentEnd);
  assert.match(paidParentSource, /if \(isEmergencyDbMode\(\)\)/);
  assert.match(paidParentSource, /FROM public\.payment_transactions/);
  assert.match(paidParentSource, /parent_id::text = \$1::text/);
  assert.match(paidParentSource, /student_id::text = \$2::text/);

  const quotaStart = routesSource.indexOf("async function getMonthlySessionQuotaSnapshot");
  const quotaEnd = routesSource.indexOf("async function resolveEnrollmentIdForSession", quotaStart);
  const quotaSource = routesSource.slice(quotaStart, quotaEnd);

  assert.match(quotaSource, /WITH completed_keys AS/);
  assert.match(quotaSource, /public\.training_session_runs/);
  assert.match(quotaSource, /public\.intro_session_drills/);
  assert.match(quotaSource, /public\.session_billing_events/);
  assert.match(quotaSource, /student_renewal/);
  assert.match(quotaSource, /parent_renewal/);
  assert.match(quotaSource, /event_type = 'renewal_payment'/);
  assert.match(quotaSource, /usageWindowStart/);
  assert.match(quotaSource, /raw_payload @> '\{"renewal": true\}'::jsonb/);
  assert.match(quotaSource, /sessions_remaining: sessionsRemaining/);

  const acceptStart = routesSource.indexOf('app.post("/api/parent/proposal/accept"');
  const acceptEnd = routesSource.indexOf('app.post("/api/parent/proposal/decline"', acceptStart);
  const acceptSource = routesSource.slice(acceptStart, acceptEnd);

  assert.match(acceptSource, /\.in\("status", \["proposal_sent", "session_booked"\]\)/);
  assert.match(acceptSource, /payfastSandboxForEnrollment/);
  assert.match(acceptSource, /PAYFAST_PUBLIC_SANDBOX_MERCHANT_ID/);
  assert.match(acceptSource, /payfastSandboxForEnrollment\s*\?\s*withPayfastSignature/);
  assert.doesNotMatch(
    acceptSource.slice(
      acceptSource.indexOf("const payfastFields = payfastSandboxForEnrollment"),
      acceptSource.indexOf("return res.json", acceptSource.indexOf("const payfastFields = payfastSandboxForEnrollment")),
    ),
    /custom_str1/,
  );
  assert.match(acceptSource, /if \(isEmergencyDbMode\(\)\)/);
  assert.match(acceptSource, /public\.payment_transactions/);
  assert.match(acceptSource, /ON CONFLICT \(merchant_reference\)/);

  const sandboxConfirmStart = routesSource.indexOf(
    'app.post("/api/parent/payments/payfast/sandbox-confirm"',
  );
  const sandboxConfirmEnd = routesSource.indexOf(
    '// Generate student code for accepted proposal',
    sandboxConfirmStart,
  );
  const sandboxConfirmSource = routesSource.slice(
    sandboxConfirmStart,
    sandboxConfirmEnd,
  );

  assert.ok(sandboxConfirmStart >= 0);
  assert.ok(sandboxConfirmEnd > sandboxConfirmStart);
  assert.match(sandboxConfirmSource, /if \(isEmergencyDbMode\(\)\)/);
  assert.match(sandboxConfirmSource, /public\.payment_transactions/);
  assert.match(sandboxConfirmSource, /finalizeAcceptedProposalFromPayment/);

  const finalizeStart = routesSource.indexOf(
    "async function finalizeAcceptedProposalFromPayment",
  );
  const finalizeEnd = routesSource.indexOf(
    "async function ",
    finalizeStart + "async function finalizeAcceptedProposalFromPayment".length,
  );
  const finalizeSource = routesSource.slice(finalizeStart, finalizeEnd);

  assert.ok(finalizeStart >= 0);
  assert.ok(finalizeEnd > finalizeStart);
  assert.match(finalizeSource, /if \(isEmergencyDbMode\(\)\)/);
  assert.match(finalizeSource, /FOR UPDATE/);
  assert.match(finalizeSource, /UPDATE public\.parent_enrollments/);
  assert.match(finalizeSource, /UPDATE public\.onboarding_proposals/);
});

test("specialist High Maintenance prep stays in the current phase until confirmation", () => {
  const source = readFileSync(
    resolve(process.cwd(), "client/src/components/tutor/StudentTopicConditioningDialog.tsx"),
    "utf8",
  );

  const prepStart = source.indexOf("function nextPrepPhaseFor");
  const prepEnd = source.indexOf("function actionGuidanceFor", prepStart);
  const prepSource = source.slice(prepStart, prepEnd);

  assert.ok(prepStart >= 0);
  assert.ok(prepEnd > prepStart);
  assert.match(prepSource, /if \(stability === "High Maintenance"\) return phase;/);
  assert.doesNotMatch(source, /Advance Threshold Met/);
  assert.match(source, /Maintenance Confirmation/);
  assert.match(
    source,
    /Confirm it in a later qualifying Controlled Discomfort drill before progressing into Time Pressure Stability\./,
  );
});

test("PayFast sandbox config never falls back to live merchant credentials", () => {
  const routesSource = readFileSync(resolve(process.cwd(), "server/routes.ts"), "utf8");
  const configStart = routesSource.indexOf("const PAYFAST_PUBLIC_SANDBOX_MERCHANT_ID");
  const configEnd = routesSource.indexOf("function buildPackagePaymentDescription", configStart);
  const configSource = routesSource.slice(configStart, configEnd);

  assert.ok(configStart >= 0);
  assert.ok(configEnd > configStart);
  assert.match(configSource, /PAYFAST_PUBLIC_SANDBOX_MERCHANT_ID = "10004002"/);
  assert.match(configSource, /PAYFAST_PUBLIC_SANDBOX_MERCHANT_KEY = "q1cd2rdny4a53"/);
  assert.match(configSource, /PAYFAST_PUBLIC_SANDBOX_PASSPHRASE = "payfast"/);
  assert.doesNotMatch(configSource, /PAYFAST_SANDBOX_MERCHANT_ID/);
  assert.doesNotMatch(configSource, /PAYFAST_SANDBOX_MERCHANT_KEY/);
  assert.match(configSource, /merchantId: PAYFAST_PUBLIC_SANDBOX_MERCHANT_ID/);
  assert.match(configSource, /merchantKey: PAYFAST_PUBLIC_SANDBOX_MERCHANT_KEY/);
  assert.match(configSource, /passphrase: PAYFAST_PUBLIC_SANDBOX_PASSPHRASE/);
  assert.match(configSource, /isValidPayfastMerchantId\(config\.merchantId\)/);
  assert.match(configSource, /isValidPayfastMerchantKey\(config\.merchantKey\)/);
});

test("PayFast sandbox checkout signature matches the documented shared account and minimal field set", () => {
  const values = {
    merchant_id: "10004002",
    merchant_key: "q1cd2rdny4a53",
    return_url: "https://app.responseintegrity.co.za/client/parent/gateway?payfast=return&merchantReference=response-integrity-package-test",
    cancel_url: "https://app.responseintegrity.co.za/client/parent/gateway?payfast=cancelled&merchantReference=response-integrity-package-test",
    m_payment_id: "response-integrity-package-test",
    amount: "1600.00",
    item_name: "8-Session Monthly Package",
  };

  assert.equal(
    buildPayfastCheckoutSignature(values, "payfast"),
    "e20fe96ad84f685cb1c78c0a410eff04",
  );

  const signed = withPayfastSignature(values, "payfast");
  assert.deepEqual(Object.keys(signed), [
    "merchant_id",
    "merchant_key",
    "return_url",
    "cancel_url",
    "m_payment_id",
    "amount",
    "item_name",
    "signature",
  ]);
  assert.equal(signed.signature, "e20fe96ad84f685cb1c78c0a410eff04");
});

test("Sandbox PayFast return uses a public relay and returns to the initiating app origin", () => {
  const routesSource = readFileSync(resolve(process.cwd(), "server/routes.ts"), "utf8");
  const relaySource = readFileSync(
    resolve(process.cwd(), "client/public/payfast-sandbox-return.html"),
    "utf8",
  );

  const helperStart = routesSource.indexOf("const PAYFAST_SANDBOX_BRANCH_RELAY_BASE_URL");
  const helperEnd = routesSource.indexOf("function usePayfastSandbox", helperStart);
  const helperSource = routesSource.slice(helperStart, helperEnd);

  assert.ok(helperStart >= 0);
  assert.ok(helperEnd > helperStart);
  assert.match(
    helperSource,
    /tt-confidence-hub-git-feat-evi-31b8c6-relief-works-technologies\.vercel\.app/,
  );
  assert.match(helperSource, /req\.get\("origin"\)/);
  assert.match(helperSource, /targetOrigin/);
  assert.match(helperSource, /buildPayfastSandboxReturnUrl/);
  assert.match(helperSource, /hostname === "localhost"/);
  assert.match(helperSource, /hostname\.endsWith\("\.vercel\.app"\)/);

  const acceptStart = routesSource.indexOf('app.post("/api/parent/proposal/accept"');
  const acceptEnd = routesSource.indexOf('app.post("/api/parent/proposal/decline"', acceptStart);
  const acceptSource = routesSource.slice(acceptStart, acceptEnd);

  assert.match(
    acceptSource,
    /return_url: buildPayfastSandboxReturnUrl\(req, "return", merchantReference\)/,
  );
  assert.match(
    acceptSource,
    /cancel_url: buildPayfastSandboxReturnUrl\(req, "cancelled", merchantReference\)/,
  );

  assert.match(relaySource, /targetOrigin/);
  assert.match(relaySource, /window\.location\.replace\(destination\.toString\(\)\)/);
  assert.match(relaySource, /host === "localhost"/);
  assert.match(relaySource, /host\.endsWith\("\.vercel\.app"\)/);
  assert.match(relaySource, /"\/client\/parent\/gateway"/);
});

test("Sandbox payment gate stays actionable from Parent Sessions and returns there after checkout", () => {
  const sessionsSource = readFileSync(
    resolve(process.cwd(), "client/src/pages/client/parent/sessions.tsx"),
    "utf8",
  );
  const gatewaySource = readFileSync(
    resolve(process.cwd(), "client/src/pages/client/parent/gateway.tsx"),
    "utf8",
  );

  assert.match(sessionsSource, /\/api\/parent\/proposal\/accept/);
  assert.match(sessionsSource, /Complete Sandbox Payment/);
  assert.match(sessionsSource, /submitExternalPaymentForm\(payload\.checkoutUrl, payload\.formFields\)/);
  assert.match(sessionsSource, /PAYFAST_RETURN_PATH_STORAGE_KEY/);
  assert.match(sessionsSource, /"\/client\/parent\/sessions"/);
  assert.match(gatewaySource, /const returnPath = window\.sessionStorage\.getItem\(PAYFAST_RETURN_PATH_STORAGE_KEY\)/);
  assert.match(gatewaySource, /navigate\(returnPath, \{ replace: true \}\)/);
  assert.match(gatewaySource, /assertPayfastCheckoutFields\(data\.formFields, data\?\.sandbox === true\)/);
});

test("assignment acceptance refreshes the canonical workflow query immediately", () => {
  const hookSource = readFileSync(
    resolve(process.cwd(), "client/src/hooks/useStudentWorkflowState.ts"),
    "utf8",
  );
  const cardSource = readFileSync(
    resolve(process.cwd(), "client/src/components/tutor/StudentCard.tsx"),
    "utf8",
  );

  assert.match(
    hookSource,
    /const studentWorkflowQueryKey = \([\s\S]*?\[apiBasePath, "students", studentId, "workflow-state"\] as const;/,
  );
  assert.match(
    hookSource,
    /useRespondToAssignment[\s\S]*?refetchQueries\(\{[\s\S]*?queryKey: studentWorkflowQueryKey\(studentId\)/,
  );
  assert.doesNotMatch(
    cardSource,
    /assignmentAccepted:\s*student\.pendingTutorAcceptance\s*\?/,
  );
});

test("emergency assignment acceptance advances the enrollment on the direct DB path", () => {
  const routesSource = readFileSync(resolve(process.cwd(), "server/routes.ts"), "utf8");
  const routeStart = routesSource.indexOf(
    'app.post(\n    "/api/tutor/students/:studentId/workflow/assignment-decision"',
  );
  const routeEnd = routesSource.indexOf(
    'app.post(\n    "/api/tutor/students/:studentId/workflow/intro-completed"',
    routeStart,
  );
  const routeSource = routesSource.slice(routeStart, routeEnd);

  assert.ok(routeStart >= 0);
  assert.ok(routeEnd > routeStart);
  assert.match(routeSource, /if \(isEmergencyDbMode\(\)\) \{[\s\S]*?UPDATE public\.parent_enrollments/);
  assert.match(routeSource, /status = \$3,[\s\S]*?current_step = \$4/);
  assert.match(routeSource, /RETURNING id, user_id, status, current_step, assigned_tutor_id/);
});

test("training session reads select recent rows before historical rows", () => {
  const routesSource = readFileSync(resolve(process.cwd(), "server/routes.ts"), "utf8");

  const parentGetStart = routesSource.indexOf('app.get("/api/parent/training-sessions"');
  const parentScheduleStart = routesSource.indexOf(
    'app.post("/api/parent/training-sessions/schedule-week"',
    parentGetStart,
  );
  const parentSource = routesSource.slice(parentGetStart, parentScheduleStart);
  assert.match(parentSource, /ORDER BY scheduled_time DESC\s+LIMIT 12/);
  assert.match(parentSource, /\.order\("scheduled_time", \{ ascending: false \}\)\s*\.limit\(12\)/);
  assert.match(parentSource, /const recentSessions = \[\.\.\./);

  const tutorGetStart = routesSource.indexOf(
    '"/api/tutor/students/:studentId/training-sessions"',
  );
  const tutorPostStart = routesSource.indexOf(
    '"/api/tutor/students/:studentId/training-sessions",',
    tutorGetStart + 10,
  );
  const tutorSource = routesSource.slice(tutorGetStart, tutorPostStart);
  assert.match(tutorSource, /ORDER BY scheduled_time DESC\s+LIMIT 12/);
  assert.match(tutorSource, /\.order\("scheduled_time", \{ ascending: false \}\)\s*\.limit\(12\)/);
  assert.match(tutorSource, /const recentSessions = \[\.\.\./);
});

test("preview training sessions use the direct Proof database without enabling emergency auth", () => {
  const routesSource = readFileSync(resolve(process.cwd(), "server/routes.ts"), "utf8");
  const emergencyModeSource = readFileSync(resolve(process.cwd(), "server/emergencyMode.ts"), "utf8");

  assert.match(
    routesSource,
    /function usesDirectProofSessionDatabase\(\) \{[\s\S]*?isEmergencyDbMode\(\) \|\| process\.env\.VERCEL_ENV === "preview"/,
  );
  assert.match(
    emergencyModeSource,
    /if \(process\.env\.VERCEL_ENV === "preview"\) \{[\s\S]*?return false;/,
  );

  const parentScheduleStart = routesSource.indexOf(
    'app.post("/api/parent/training-sessions/schedule-week"',
  );
  const parentRespondStart = routesSource.indexOf(
    'app.post("/api/parent/training-sessions/respond"',
    parentScheduleStart,
  );
  const parentScheduleSource = routesSource.slice(parentScheduleStart, parentRespondStart);
  assert.match(parentScheduleSource, /usesDirectProofSessionDatabase\(\)/);
  assert.match(parentScheduleSource, /INSERT INTO public\.scheduled_sessions/);

  const parentGetStart = routesSource.indexOf('app.get("/api/parent/training-sessions"');
  const parentGetSource = routesSource.slice(parentGetStart, parentScheduleStart);
  assert.match(parentGetSource, /usesDirectProofSessionDatabase\(\)/);
  assert.match(parentGetSource, /FROM public\.scheduled_sessions/);

  const weeklyStart = routesSource.indexOf('"/api/tutor/weekly-schedule"');
  const weeklyEnd = routesSource.indexOf('"/api/tutor/scheduled-sessions/:sessionId/log"', weeklyStart);
  const weeklySource = routesSource.slice(weeklyStart, weeklyEnd);
  assert.match(weeklySource, /usesDirectProofSessionDatabase\(\)/);
  assert.match(weeklySource, /FROM public\.scheduled_sessions/);
});

test("emergency weekly training scheduling and Specialist confirmation stay on direct PostgreSQL", () => {
  const routesSource = readFileSync(resolve(process.cwd(), "server/routes.ts"), "utf8");

  const parentGetStart = routesSource.indexOf('app.get("/api/parent/training-sessions"');
  const parentScheduleStart = routesSource.indexOf(
    'app.post("/api/parent/training-sessions/schedule-week"',
    parentGetStart,
  );
  const parentRespondStart = routesSource.indexOf(
    'app.post("/api/parent/training-sessions/respond"',
    parentScheduleStart,
  );

  const parentGetSource = routesSource.slice(parentGetStart, parentScheduleStart);
  const parentScheduleSource = routesSource.slice(parentScheduleStart, parentRespondStart);

  assert.ok(parentGetStart >= 0);
  assert.ok(parentScheduleStart > parentGetStart);
  assert.match(parentGetSource, /if \(isEmergencyDbMode\(\)\)/);
  assert.match(parentGetSource, /FROM public\.scheduled_sessions/);
  assert.match(parentScheduleSource, /if \(isEmergencyDbMode\(\)\)/);
  assert.match(parentScheduleSource, /FROM public\.scheduled_sessions/);
  assert.match(parentScheduleSource, /INSERT INTO public\.scheduled_sessions/);
  assert.match(parentScheduleSource, /await client\.query\("BEGIN"\)/);
  assert.match(parentScheduleSource, /await client\.query\("COMMIT"\)/);

  const tutorConfirmStart = routesSource.indexOf(
    '"/api/tutor/students/:studentId/training-sessions/:sessionId/confirm"',
  );
  const tutorRespondStart = routesSource.indexOf(
    '"/api/tutor/students/:studentId/training-sessions/:sessionId/respond"',
    tutorConfirmStart,
  );
  const tutorConfirmSource = routesSource.slice(tutorConfirmStart, tutorRespondStart);

  assert.ok(tutorConfirmStart >= 0);
  assert.ok(tutorRespondStart > tutorConfirmStart);
  assert.match(tutorConfirmSource, /if \(isEmergencyDbMode\(\)\)/);
  assert.match(tutorConfirmSource, /FROM public\.scheduled_sessions/);
  assert.match(tutorConfirmSource, /UPDATE public\.scheduled_sessions/);
});

test("parent intro proposal uses direct PostgreSQL in emergency mode", () => {
  const routesSource = readFileSync(resolve(process.cwd(), "server/routes.ts"), "utf8");
  const routeStart = routesSource.indexOf('app.post("/api/parent/intro-session/propose"');
  const routeEnd = routesSource.indexOf("// Parent intro session confirmation status", routeStart);
  const routeSource = routesSource.slice(routeStart, routeEnd);

  assert.ok(routeStart >= 0);
  assert.ok(routeEnd > routeStart);
  assert.match(routeSource, /if \(isEmergencyDbMode\(\)\)/);
  assert.match(routeSource, /SELECT \*[\s\S]*?FROM public\.parent_enrollments/);
  assert.match(routeSource, /INSERT INTO public\.scheduled_sessions/);
  assert.match(routeSource, /UPDATE public\.parent_enrollments[\s\S]*?intro_session_booked/);
  assert.match(routeSource, /return res\.status\(200\)\.json/);
});

test("proposal surfaces ignore partial evidence-native diagnosis artifacts", () => {
  const routesSource = readFileSync(resolve(process.cwd(), "server/routes.ts"), "utf8");
  const runnerSource = readFileSync(
    resolve(process.cwd(), "client/src/components/tutor/EvidenceCompleteDiagnosisRunner.tsx"),
    "utf8",
  );

  const latestStart = routesSource.indexOf(
    'app.get("/api/tutor/students/:studentId/latest-intro-drill"',
  );
  const latestEnd = routesSource.indexOf(
    '// Tutor: Activate a topic for a student',
    latestStart,
  );
  const latestRoute = routesSource.slice(latestStart, latestEnd);

  assert.ok(latestStart >= 0);
  assert.ok(latestEnd > latestStart);
  assert.match(latestRoute, /response_integrity_diagnosis_runs/);
  assert.match(latestRoute, /r\.status = 'completed'/);
  assert.match(latestRoute, /r\.source_drill_id::text = d\.id::text/);

  const proposalStart = routesSource.indexOf('app.post("/api/tutor/proposal"');
  const proposalEnd = routesSource.indexOf(
    "// Parent: Get proposal",
    proposalStart,
  );
  const proposalRoute = routesSource.slice(proposalStart, proposalEnd);

  assert.ok(proposalStart >= 0);
  assert.match(proposalRoute, /Diagnosis finalization is incomplete/);
  assert.match(proposalRoute, /status = 'completed'/);

  assert.match(
    runnerSource,
    /!state\.finalized && state\.decision\?\.complete[\s\S]*?postHistory\(id, state\.probeHistory\)/,
  );
});


test("package quota is authoritative for Specialist training launch and submission", () => {
  const routesSource = readFileSync(resolve(process.cwd(), "server/routes.ts"), "utf8");
  const dialogSource = readFileSync(
    resolve(process.cwd(), "client/src/components/tutor/StudentTopicConditioningDialog.tsx"),
    "utf8",
  );

  const accessStart = routesSource.indexOf(
    '"/api/tutor/students/:studentId/drill-session-access"',
  );
  const accessEnd = routesSource.indexOf(
    "app.get(",
    accessStart + 10,
  );
  const accessSource = routesSource.slice(
    accessStart,
    accessEnd > accessStart ? accessEnd : accessStart + 30000,
  );
  assert.ok(accessStart >= 0);
  assert.match(accessSource, /getTrainingPackageQuotaAuthority/);
  assert.match(accessSource, /PACKAGE_QUOTA_EXHAUSTED/);
  assert.match(accessSource, /reconcileTrainingSessionCompletionFromRun/);

  const submitStart = routesSource.indexOf(
    'app.post("/api/tutor/training-session-drill"',
  );
  const submitEnd = routesSource.indexOf(
    "app.get(",
    submitStart,
  );
  const submitSource = routesSource.slice(
    submitStart,
    submitEnd > submitStart ? submitEnd : submitStart + 50000,
  );
  assert.ok(submitStart >= 0);
  assert.match(submitSource, /getTrainingPackageQuotaAuthority/);
  assert.match(submitSource, /reconcileTrainingSessionCompletionFromRun/);
  assert.match(submitSource, /status\(409\)/);

  assert.match(dialogSource, /packageQuotaBlocked/);
  assert.match(dialogSource, /Package exhausted — awaiting renewal/);
  assert.match(
    dialogSource,
    /disabled=\{!assignmentAccepted \|\| packageQuotaBlocked\}/,
  );
});


test("Specialist Training tab distinguishes no booking from payment or renewal", () => {
  const routesSource = readFileSync(resolve(process.cwd(), "server/routes.ts"), "utf8");
  const dialogSource = readFileSync(
    resolve(process.cwd(), "client/src/components/tutor/StudentTopicConditioningDialog.tsx"),
    "utf8",
  );

  const tutorSessionsStart = routesSource.indexOf(
    '"/api/tutor/students/:studentId/training-sessions"',
  );
  const tutorSessionsEnd = routesSource.indexOf(
    'app.post(',
    tutorSessionsStart,
  );
  const tutorSessionsSource = routesSource.slice(
    tutorSessionsStart,
    tutorSessionsEnd > tutorSessionsStart
      ? tutorSessionsEnd
      : tutorSessionsStart + 30000,
  );

  assert.ok(tutorSessionsStart >= 0);
  assert.match(tutorSessionsSource, /premiumAccess\.status === 402/);
  assert.match(tutorSessionsSource, /paymentRequired: true/);
  assert.match(tutorSessionsSource, /commercialState: resolveTrainingTabAvailability/);
  assert.match(tutorSessionsSource, /actionableSessionCount/);

  assert.match(dialogSource, /trainingTabAvailability/);
  assert.match(dialogSource, /No sessions can be booked until the parent completes payment/);
  assert.match(dialogSource, /No more sessions can be booked until the parent renews\/pays/);
  assert.match(dialogSource, /Package capacity is available, but the parent has not booked a current lesson/);
});


test("emergency quota calculation respects package renewal boundaries", () => {
  const routesSource = readFileSync(resolve(process.cwd(), "server/routes.ts"), "utf8");
  const quotaStart = routesSource.indexOf("async function getMonthlySessionQuotaSnapshot");
  const quotaEnd = routesSource.indexOf("// detect whether this parent/student should use sandbox membership row", quotaStart);
  const emergencyQuotaSource = routesSource.slice(quotaStart, quotaEnd);

  assert.ok(quotaStart >= 0);
  assert.ok(quotaEnd > quotaStart);
  assert.match(emergencyQuotaSource, /if \(isEmergencyDbMode\(\)\)/);
  assert.match(emergencyQuotaSource, /student_renewal/);
  assert.match(emergencyQuotaSource, /parent_renewal/);
  assert.match(emergencyQuotaSource, /restore_event/);
  assert.match(emergencyQuotaSource, /usage_window_start/);
  assert.match(emergencyQuotaSource, /usageWindowStart, nowIso/);
  assert.match(emergencyQuotaSource, /public\.intro_session_drills/);
  assert.doesNotMatch(
    emergencyQuotaSource.slice(
      emergencyQuotaSource.indexOf("const usageResult"),
      emergencyQuotaSource.indexOf("const sessionQuota"),
    ),
    /monthStartIso, nextMonthIso/,
  );
});

test("emergency quota uses text-normalized IDs across mixed legacy column types", () => {
  const routesSource = readFileSync(resolve(process.cwd(), "server/routes.ts"), "utf8");
  const quotaStart = routesSource.indexOf("async function getMonthlySessionQuotaSnapshot");
  const quotaEnd = routesSource.indexOf(
    "// detect whether this parent/student should use sandbox membership row",
    quotaStart,
  );
  const emergencyQuotaSource = routesSource.slice(quotaStart, quotaEnd);

  assert.match(emergencyQuotaSource, /parent_id::text = \$1::text/);
  assert.match(emergencyQuotaSource, /student_id::text = \$2::text/);
  assert.match(emergencyQuotaSource, /s\.student_id::text = \$2::text/);
  assert.match(emergencyQuotaSource, /r\.student_id::text = \$2::text/);
  assert.match(emergencyQuotaSource, /d\.student_id::text = \$2::text/);
  assert.doesNotMatch(emergencyQuotaSource, /(?:s|r|d)\.student_id = \$2\b/);
});

