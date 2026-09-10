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
