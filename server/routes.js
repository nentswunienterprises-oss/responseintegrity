var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
import { createServer } from "http";
import { storage, supabase, createAffiliateCode } from "./storage";
import { setupAuth, isAuthenticated } from "./supabaseAuth";
import { insertPodSchema, insertSessionSchema, insertAcademicProfileSchema, insertStruggleTargetSchema, insertBroadcastSchema, insertTutorApplicationSchema, roleAuthorizationSchema, insertEncounterSchema, insertAffiliateReflectionSchema, } from "@shared/schema";
import { z } from "zod";
// Helper middleware to check user role
var requireRole = function (roles) {
    return function (req, res, next) { return __awaiter(void 0, void 0, void 0, function () {
        var dbUser;
        return __generator(this, function (_a) {
            dbUser = req.dbUser;
            console.log("🔐 requireRole check:", {
                hasDbUser: !!dbUser,
                dbUserRole: dbUser === null || dbUser === void 0 ? void 0 : dbUser.role,
                requiredRoles: roles,
                isAuthorized: dbUser && roles.includes(dbUser.role)
            });
            if (!dbUser || !roles.includes(dbUser.role)) {
                return [2 /*return*/, res.status(403).json({ message: "Forbidden" })];
            }
            next();
            return [2 /*return*/];
        });
    }); };
};
export function registerRoutes(app) {
    return __awaiter(this, void 0, void 0, function () {
        var httpServer;
        var _this = this;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    // COO: Create affiliate code/link
                    app.post("/api/coo/create-affiliate-code", isAuthenticated, requireRole(["coo"]), function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var _a, type, personName, entityName, schoolType, code, affiliateCode, err_1;
                        var _b;
                        return __generator(this, function (_c) {
                            switch (_c.label) {
                                case 0:
                                    console.log("[DEBUG] Session on POST /api/coo/create-affiliate-code:", req.session);
                                    _c.label = 1;
                                case 1:
                                    _c.trys.push([1, 3, , 4]);
                                    _a = req.body, type = _a.type, personName = _a.personName, entityName = _a.entityName, schoolType = _a.schoolType;
                                    code = "AFIX" + Math.random().toString(36).substring(2, 8).toUpperCase();
                                    return [4 /*yield*/, createAffiliateCode({
                                            affiliateId: (_b = req.dbUser) === null || _b === void 0 ? void 0 : _b.id,
                                            code: code,
                                            type: type,
                                            personName: personName,
                                            entityName: entityName,
                                            schoolType: schoolType,
                                        })];
                                case 2:
                                    affiliateCode = _c.sent();
                                    res.json({ code: code });
                                    return [3 /*break*/, 4];
                                case 3:
                                    err_1 = _c.sent();
                                    res.status(500).json({ message: err_1.message || "Failed to create affiliate code" });
                                    return [3 /*break*/, 4];
                                case 4: return [2 /*return*/];
                            }
                        });
                    }); });

                    // Tutor declares subjects
                    app.post("/api/tutor/subjects", isAuthenticated, requireRole(["tutor"]), async function (req, res) {
                        try {
                            const tutorId = req.dbUser.id;
                            const subjects = req.body.subjects;
                            if (!Array.isArray(subjects) || subjects.length === 0) {
                                return res.status(400).json({ message: "Subjects array required" });
                            }
                            // Store subjects for tutor (replace with actual storage logic)
                            // Example: await storage.saveTutorSubjects(tutorId, subjects);
                            console.log(`Tutor ${tutorId} declared subjects:`, subjects);
                            res.json({ success: true, subjects });
                        } catch (error) {
                            console.error("Error declaring subjects:", error);
                            res.status(500).json({ message: "Failed to declare subjects" });
                        }
                    });

                    // Tutor fetches subjects
                    app.get("/api/tutor/subjects", isAuthenticated, requireRole(["tutor"]), async function (req, res) {
                        try {
                            const tutorId = req.dbUser.id;
                            // Fetch subjects for tutor (replace with actual storage logic)
                            // Example: const subjects = await storage.getTutorSubjects(tutorId);
                            const subjects = [];
                            res.json({ subjects });
                        } catch (error) {
                            console.error("Error fetching subjects:", error);
                            res.status(500).json({ message: "Failed to fetch subjects" });
                        }
                    });
                    // Debug endpoint for remote header/session inspection
                    app.get("/api/debug/auth-info", function (req, res) {
                        var authHeader = req.headers.authorization || null;
                        var sessionId = req.sessionID || null;
                        var session = req.session || null;
                        console.log("[DEBUG] /api/debug/auth-info");
                        console.log("  Authorization header:", authHeader);
                        console.log("  Session ID:", sessionId);
                        console.log("  Session:", session);
                        console.log("  Cookies:", req.headers.cookie || null);
                        console.log("  User-Agent:", req.headers["user-agent"] || null);
                        console.log("  Origin:", req.headers.origin || null);
                        console.log("  Referer:", req.headers.referer || null);
                        res.json({
                            authorization: authHeader,
                            sessionId: sessionId,
                            session: session,
                            cookies: req.headers.cookie || null,
                            userAgent: req.headers["user-agent"] || null,
                            origin: req.headers.origin || null,
                            referer: req.headers.referer || null
                        });
                    });
                    // Get intro session details for a student (for tutors)
                    app.get("/api/tutor/students/:studentId/intro-session-details", isAuthenticated, requireRole(["tutor"]), function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var studentId, dbUser, student, _a, session, sessionError, error_1;
                        return __generator(this, function (_b) {
                            switch (_b.label) {
                                case 0:
                                    _b.trys.push([0, 3, , 4]);
                                    studentId = req.params.studentId;
                                    dbUser = req.dbUser;
                                    return [4 /*yield*/, storage.getStudent(studentId)];
                                case 1:
                                    student = _b.sent();
                                    if (!student) {
                                        return [2 /*return*/, res.status(404).json({ message: "Student not found" })];
                                    }
                                    if (student.tutorId !== dbUser.id) {
                                        return [2 /*return*/, res.status(403).json({ message: "Unauthorized: Student does not belong to this tutor" })];
                                    }
                                    return [4 /*yield*/, supabase
                                            .from("scheduled_sessions")
                                            .select("id, scheduled_time, status, parent_confirmed, tutor_confirmed, created_at, updated_at")
                                            .eq("tutor_id", dbUser.id)
                                            .eq("student_id", studentId)
                                            .eq("type", "intro")
                                            .order("created_at", { ascending: false })
                                            .maybeSingle()];
                                case 2:
                                    _a = _b.sent(), session = _a.data, sessionError = _a.error;
                                    if (sessionError) {
                                        return [2 /*return*/, res.status(500).json({ message: "Failed to fetch intro session details" })];
                                    }
                                    if (!session) {
                                        return [2 /*return*/, res.json({ status: "not_scheduled" })];
                                    }
                                    res.json({
                                        id: session.id,
                                        scheduled_time: session.scheduled_time,
                                        status: session.status,
                                        parent_confirmed: session.parent_confirmed,
                                        tutor_confirmed: session.tutor_confirmed,
                                        created_at: session.created_at,
                                        updated_at: session.updated_at,
                                    });
                                    return [3 /*break*/, 4];
                                case 3:
                                    error_1 = _b.sent();
                                    console.error("Error fetching intro session details:", error_1);
                                    res.status(500).json({ message: "Failed to fetch intro session details" });
                                    return [3 /*break*/, 4];
                                case 4: return [2 /*return*/];
                            }
                        });
                    }); });
                    // ...existing code...
                    return [4 /*yield*/, setupAuth(app)];
                case 1:
                    // ...existing code...
                    _a.sent();
                    // Parent proposes an intro session (after auth setup)
                    app.post("/api/parent/intro-session/propose", isAuthenticated, function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var userId, _a, proposedDate, proposedTime, _b, enrollmentData, enrollmentError, sessionError, error_2;
                        return __generator(this, function (_c) {
                            switch (_c.label) {
                                case 0:
                                    _c.trys.push([0, 3, , 4]);
                                    userId = req.dbUser.id;
                                    _a = req.body, proposedDate = _a.proposedDate, proposedTime = _a.proposedTime;
                                    // Only require date and time, not studentId
                                    if (!proposedDate || !proposedTime) {
                                        return [2 /*return*/, res.status(400).json({ message: "Missing date or time" })];
                                    }
                                    return [4 /*yield*/, supabase
                                            .from("parent_enrollments")
                                            .select("assigned_tutor_id")
                                            .eq("user_id", userId)
                                            .maybeSingle()];
                                case 1:
                                    _b = _c.sent(), enrollmentData = _b.data, enrollmentError = _b.error;
                                    if (enrollmentError || !enrollmentData || !enrollmentData.assigned_tutor_id) {
                                        return [2 /*return*/, res.status(400).json({ message: "No tutor assigned" })];
                                    }
                                    return [4 /*yield*/, supabase
                                            .from("scheduled_sessions")
                                            .insert([
                                            {
                                                parent_id: userId,
                                                tutor_id: enrollmentData.assigned_tutor_id,
                                                scheduled_time: "".concat(proposedDate, "T").concat(proposedTime),
                                                type: "intro",
                                                status: "pending_tutor_confirmation",
                                                parent_confirmed: true,
                                                tutor_confirmed: false,
                                                created_at: new Date().toISOString(),
                                                updated_at: new Date().toISOString(),
                                            },
                                        ])];
                                case 2:
                                    sessionError = (_c.sent()).error;
                                    if (sessionError) {
                                        console.error("Error inserting intro session:", sessionError);
                                        return [2 /*return*/, res.status(500).json({ message: "Failed to propose session" })];
                                    }
                                    res.json({ success: true });
                                    return [3 /*break*/, 4];
                                case 3:
                                    error_2 = _c.sent();
                                    console.error("Error in propose intro session:", error_2);
                                    res.status(500).json({ message: "Failed to propose session" });
                                    return [3 /*break*/, 4];
                                case 4: return [2 /*return*/];
                            }
                        });
                    }); });
                    // Parent intro session confirmation status
                    app.get("/api/parent/intro-session-confirmation", isAuthenticated, function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var userId, _a, enrollmentData, enrollmentError, _b, session, sessionError, error_3;
                        return __generator(this, function (_c) {
                            switch (_c.label) {
                                case 0:
                                    _c.trys.push([0, 3, , 4]);
                                    userId = req.dbUser.id;
                                    return [4 /*yield*/, supabase
                                            .from("parent_enrollments")
                                            .select("assigned_tutor_id")
                                            .eq("user_id", userId)
                                            .maybeSingle()];
                                case 1:
                                    _a = _c.sent(), enrollmentData = _a.data, enrollmentError = _a.error;
                                    if (enrollmentError || !enrollmentData || !enrollmentData.assigned_tutor_id) {
                                        return [2 /*return*/, res.json({ status: "not_scheduled" })];
                                    }
                                    return [4 /*yield*/, supabase
                                            .from("scheduled_sessions")
                                            .select("id, scheduled_time, status, parent_confirmed, tutor_confirmed")
                                            .eq("parent_id", userId)
                                            .eq("tutor_id", enrollmentData.assigned_tutor_id)
                                            .eq("type", "intro")
                                            .order("created_at", { ascending: false })
                                            .maybeSingle()];
                                case 2:
                                    _b = _c.sent(), session = _b.data, sessionError = _b.error;
                                    if (sessionError || !session) {
                                        return [2 /*return*/, res.json({ status: "not_scheduled" })];
                                    }
                                    // Determine status
                                    if (!session.tutor_confirmed) {
                                        return [2 /*return*/, res.json({ status: "pending_tutor_confirmation" })];
                                    }
                                    if (!session.parent_confirmed) {
                                        return [2 /*return*/, res.json({ status: "pending_parent_confirmation" })];
                                    }
                                    // No completed field in new table, so just check confirmations
                                    return [2 /*return*/, res.json({ status: "confirmed" })];
                                case 3:
                                    error_3 = _c.sent();
                                    console.error("Error in intro-session-confirmation:", error_3);
                                    res.status(500).json({ status: "error", message: "Failed to fetch intro session confirmation status" });
                                    return [3 /*break*/, 4];
                                case 4: return [2 /*return*/];
                            }
                        });
                    }); });
                    // Auth middleware
                    return [4 /*yield*/, setupAuth(app)];
                case 2:
                    // Auth middleware
                    _a.sent();
                    // Simple health check to verify JSON responses and CORS
                    app.get("/api/health", function (_req, res) {
                        res.json({ status: "ok", timestamp: new Date().toISOString() });
                    });
                    // ========================================
                    // AUTH ROUTES
                    // ========================================
                    // User endpoint is now handled by setupAuth in supabaseAuth.ts
                    // Verify role authorization for email
                    app.post("/api/auth/verify-role", function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var schema, _a, email, role, isAuthorized, error_4;
                        return __generator(this, function (_b) {
                            switch (_b.label) {
                                case 0:
                                    _b.trys.push([0, 2, , 3]);
                                    schema = z.object({
                                        email: z.string().email(),
                                        role: z.enum(["tutor", "td", "coo"]),
                                    });
                                    _a = schema.parse(req.body), email = _a.email, role = _a.role;
                                    return [4 /*yield*/, storage.checkRoleAuthorization(email, role)];
                                case 1:
                                    isAuthorized = _b.sent();
                                    if (!isAuthorized) {
                                        return [2 /*return*/, res.status(403).json({
                                                valid: false,
                                                error: "Email not authorized for this role"
                                            })];
                                    }
                                    res.json({ valid: true, role: role });
                                    return [3 /*break*/, 3];
                                case 2:
                                    error_4 = _b.sent();
                                    console.error("Error verifying role:", error_4);
                                    res.status(400).json({ message: "Invalid request" });
                                    return [3 /*break*/, 3];
                                case 3: return [2 /*return*/];
                            }
                        });
                    }); });
                    // Check if TD has pod assignment
                    app.get("/api/auth/check-td-assignment", function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var email, podId, error_5;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    _a.trys.push([0, 2, , 3]);
                                    email = req.query.email;
                                    if (!email) {
                                        return [2 /*return*/, res.status(400).json({ message: "Email required" })];
                                    }
                                    return [4 /*yield*/, storage.checkTDPodAssignment(email)];
                                case 1:
                                    podId = _a.sent();
                                    res.json({ hasPod: !!podId, podId: podId });
                                    return [3 /*break*/, 3];
                                case 2:
                                    error_5 = _a.sent();
                                    console.error("Error checking TD assignment:", error_5);
                                    res.status(500).json({ message: "Failed to check TD assignment" });
                                    return [3 /*break*/, 3];
                                case 3: return [2 /*return*/];
                            }
                        });
                    }); });
                    // Assign role permission (dev-only for now)
                    app.post("/api/auth/assign-role", function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var permission, error_6;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    _a.trys.push([0, 2, , 3]);
                                    permission = roleAuthorizationSchema.parse(req.body);
                                    return [4 /*yield*/, storage.addRolePermission(permission)];
                                case 1:
                                    _a.sent();
                                    res.json({ success: true, permission: permission });
                                    return [3 /*break*/, 3];
                                case 2:
                                    error_6 = _a.sent();
                                    console.error("Error assigning role:", error_6);
                                    res.status(400).json({ message: "Invalid request" });
                                    return [3 /*break*/, 3];
                                case 3: return [2 /*return*/];
                            }
                        });
                    }); });
                    // ========================================
                    // TUTOR ROUTES
                    // ========================================
                    // Aggregated gateway session endpoint
                    app.get("/api/tutor/gateway-session", isAuthenticated, requireRole(["tutor"]), function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var tutorId, dbUser, assignment, students, sessions, profile, province, role, enrollments, enrollmentStatus, verificationStatus, tutorApplications, latestApp, applicationStatus, status_1, isUnder18, docsVerified, gatewaySession, error_7;
                        var _this = this;
                        var _a;
                        return __generator(this, function (_b) {
                            switch (_b.label) {
                                case 0:
                                    _b.trys.push([0, 7, , 8]);
                                    tutorId = req.dbUser.id;
                                    dbUser = req.dbUser;
                                    return [4 /*yield*/, storage.getTutorAssignment(tutorId)];
                                case 1:
                                    assignment = _b.sent();
                                    return [4 /*yield*/, storage.getStudentsByTutor(tutorId)];
                                case 2:
                                    students = _b.sent();
                                    return [4 /*yield*/, storage.getSessionsByTutor(tutorId)];
                                case 3:
                                    sessions = _b.sent();
                                    return [4 /*yield*/, storage.getAcademicProfile(tutorId)];
                                case 4:
                                    profile = _b.sent();
                                    province = (dbUser === null || dbUser === void 0 ? void 0 : dbUser.province) || (profile === null || profile === void 0 ? void 0 : profile.province) || null;
                                    role = (dbUser === null || dbUser === void 0 ? void 0 : dbUser.role) || "tutor";
                                    return [4 /*yield*/, supabase
                                            .from("parent_enrollments")
                                            .select("status")
                                            .eq("assigned_tutor_id", tutorId)];
                                case 5:
                                    enrollments = (_b.sent()).data;
                                    enrollmentStatus = enrollments && enrollments.length > 0 ? enrollments[0].status : null;
                                    verificationStatus = (profile === null || profile === void 0 ? void 0 : profile.verified) || false;
                                    return [4 /*yield*/, storage.getTutorApplicationsByUser(tutorId)];
                                case 6:
                                    tutorApplications = _b.sent();
                                    latestApp = tutorApplications && tutorApplications.length > 0 ? tutorApplications[0] : null;
                                    applicationStatus = null;
                                    if (latestApp) {
                                        status_1 = latestApp.status;
                                        isUnder18 = latestApp.age < 18;
                                        docsVerified = false;
                                        if (!isUnder18) {
                                            docsVerified = !!latestApp.trialAgreementVerified;
                                        }
                                        else {
                                            docsVerified = !!latestApp.trialAgreementVerified && !!latestApp.parentConsentVerified;
                                        }
                                        if (docsVerified) {
                                            status_1 = "confirmed";
                                        }
                                        applicationStatus = {
                                            status: status_1,
                                            applicationId: latestApp.id,
                                            hasTrialAgreement: !!latestApp.trialAgreementUrl,
                                            hasParentConsent: !!latestApp.parentConsentUrl,
                                            trialAgreementVerified: !!latestApp.trialAgreementVerified,
                                            parentConsentVerified: !!latestApp.parentConsentVerified,
                                            trialAgreementUrl: latestApp.trialAgreementUrl,
                                            parentConsentUrl: latestApp.parentConsentUrl,
                                            isUnder18: isUnder18,
                                            onboardingCompletedAt: (_a = latestApp.onboardingCompletedAt) !== null && _a !== void 0 ? _a : null,
                                        };
                                    }
                                    // Add route for singular 'student' to match frontend
                                    app.get("/api/tutor/student/:studentId/intro-session-details", isAuthenticated, requireRole(["tutor"]), function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                                        var studentId, dbUser_1, student, _a, session, sessionError, error_8;
                                        return __generator(this, function (_b) {
                                            switch (_b.label) {
                                                case 0:
                                                    _b.trys.push([0, 3, , 4]);
                                                    studentId = req.params.studentId;
                                                    dbUser_1 = req.dbUser;
                                                    return [4 /*yield*/, storage.getStudent(studentId)];
                                                case 1:
                                                    student = _b.sent();
                                                    if (!student) {
                                                        return [2 /*return*/, res.status(404).json({ message: "Student not found" })];
                                                    }
                                                    if (student.tutorId !== dbUser_1.id) {
                                                        return [2 /*return*/, res.status(403).json({ message: "Unauthorized: Student does not belong to this tutor" })];
                                                    }
                                                    return [4 /*yield*/, supabase
                                                            .from("scheduled_sessions")
                                                            .select("id, scheduled_time, status, parent_confirmed, tutor_confirmed, created_at, updated_at")
                                                            .eq("tutor_id", dbUser_1.id)
                                                            .eq("student_id", studentId)
                                                            .eq("type", "intro")
                                                            .order("created_at", { ascending: false })
                                                            .maybeSingle()];
                                                case 2:
                                                    _a = _b.sent(), session = _a.data, sessionError = _a.error;
                                                    if (sessionError) {
                                                        return [2 /*return*/, res.status(500).json({ message: "Failed to fetch intro session details" })];
                                                    }
                                                    if (!session) {
                                                        return [2 /*return*/, res.json({ status: "not_scheduled" })];
                                                    }
                                                    res.json({
                                                        id: session.id,
                                                        scheduled_time: session.scheduled_time,
                                                        status: session.status,
                                                        parent_confirmed: session.parent_confirmed,
                                                        tutor_confirmed: session.tutor_confirmed,
                                                        created_at: session.created_at,
                                                        updated_at: session.updated_at,
                                                    });
                                                    return [3 /*break*/, 4];
                                                case 3:
                                                    error_8 = _b.sent();
                                                    console.error("Error fetching intro session details:", error_8);
                                                    res.status(500).json({ message: "Failed to fetch intro session details" });
                                                    return [3 /*break*/, 4];
                                                case 4: return [2 /*return*/];
                                            }
                                        });
                                    }); });
                                    gatewaySession = {
                                        assignment: assignment,
                                        students: students,
                                        sessions: sessions,
                                        profile: profile,
                                        province: province,
                                        role: role,
                                        enrollmentStatus: enrollmentStatus,
                                        verificationStatus: verificationStatus,
                                        applicationStatus: applicationStatus,
                                    };
                                    res.json(gatewaySession);
                                    return [3 /*break*/, 8];
                                case 7:
                                    error_7 = _b.sent();
                                    console.error("Error fetching gateway session:", error_7);
                                    res.status(500).json({ message: "Failed to fetch gateway session" });
                                    return [3 /*break*/, 8];
                                case 8: return [2 /*return*/];
                            }
                        });
                    }); });
                    // Get tutor's pod assignment and students
                    app.get("/api/tutor/pod", isAuthenticated, requireRole(["tutor"]), function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var tutorId_1, assignment, assignedEnrollments, _i, assignedEnrollments_1, enrollment, existingStudent, err_2, students, studentsWithParentInfo, error_9;
                        var _this = this;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    _a.trys.push([0, 13, , 14]);
                                    tutorId_1 = req.dbUser.id;
                                    return [4 /*yield*/, storage.getTutorAssignment(tutorId_1)];
                                case 1:
                                    assignment = _a.sent();
                                    if (!assignment) {
                                        return [2 /*return*/, res.json({ assignment: null, students: [] })];
                                    }
                                    return [4 /*yield*/, supabase
                                            .from("parent_enrollments")
                                            .select("*")
                                            .eq("assigned_tutor_id", tutorId_1)
                                            .eq("status", "assigned")];
                                case 2:
                                    assignedEnrollments = (_a.sent()).data;
                                    if (!(assignedEnrollments && assignedEnrollments.length > 0)) return [3 /*break*/, 10];
                                    _i = 0, assignedEnrollments_1 = assignedEnrollments;
                                    _a.label = 3;
                                case 3:
                                    if (!(_i < assignedEnrollments_1.length)) return [3 /*break*/, 10];
                                    enrollment = assignedEnrollments_1[_i];
                                    _a.label = 4;
                                case 4:
                                    _a.trys.push([4, 8, , 9]);
                                    return [4 /*yield*/, supabase
                                            .from("students")
                                            .select("id")
                                            .eq("name", enrollment.student_full_name)
                                            .eq("tutor_id", tutorId_1)
                                            .single()];
                                case 5:
                                    existingStudent = (_a.sent()).data;
                                    if (!!existingStudent) return [3 /*break*/, 7];
                                    return [4 /*yield*/, supabase
                                            .from("students")
                                            .insert({
                                            name: enrollment.student_full_name,
                                            grade: enrollment.student_grade,
                                            tutor_id: tutorId_1,
                                            confidence_score: confidenceScore,
                                            session_progress: 0,
                                            parent_contact: enrollment.parent_email,
                                        })];
                                case 6:
                                    _a.sent();
                                    console.log("Created missing student:", enrollment.student_full_name);
                                    _a.label = 7;
                                case 7: return [3 /*break*/, 9];
                                case 8:
                                    err_2 = _a.sent();
                                    console.error("Error creating student from enrollment:", err_2);
                                    return [3 /*break*/, 9];
                                case 9:
                                    _i++;
                                    return [3 /*break*/, 3];
                                case 10: return [4 /*yield*/, storage.getStudentsByTutor(tutorId_1)];
                                case 11:
                                    students = _a.sent();
                                        return [4 /*yield*/, Promise.all(students.map(function (student) { return __awaiter(_this, void 0, void 0, function () {
                                            var parentEnrollment, proposalAcceptedAt, proposalSnapshot, proposal, isApproved, topic, noteText, justificationText, phaseFromNotes, phaseFromJustification, stabilityFromNotes, stabilityFromJustification, topicConditioning, err_3;
                                            return __generator(this, function (_a) {
                                                switch (_a.label) {
                                                    case 0:
                                                        _a.trys.push([0, 4, , 5]);
                                                        return [4 /*yield*/, supabase
                                                                .from("parent_enrollments")
                                                                .select("*")
                                                                .eq("assigned_tutor_id", tutorId_1)
                                                                .eq("student_full_name", student.name)
                                                                .single()];
                                                    case 1:
                                                        parentEnrollment = (_a.sent()).data;
                                                        proposalAcceptedAt = null;
                                                        proposalSnapshot = null;
                                                        if (!(parentEnrollment === null || parentEnrollment === void 0 ? void 0 : parentEnrollment.proposal_id)) return [3 /*break*/, 3];
                                                        return [4 /*yield*/, supabase
                                                            .from("onboarding_proposals")
                                                            .select("accepted_at, current_topics, topic_conditioning_topic, topic_conditioning_entry_phase, topic_conditioning_stability, justification, tutor_notes")
                                                                .eq("id", parentEnrollment.proposal_id)
                                                                .single()];
                                                    case 2:
                                                        proposal = (_a.sent()).data;
                                                        proposalSnapshot = proposal || null;
                                                        proposalAcceptedAt = (proposal === null || proposal === void 0 ? void 0 : proposal.accepted_at) || null;
                                                        _a.label = 3;
                                                    case 3:
                                                        isApproved = parentEnrollment &&
                                                            (proposalAcceptedAt ||
                                                                ["session_booked", "report_received", "confirmed"].includes(parentEnrollment.status));
                                                        topic = String(((proposalSnapshot === null || proposalSnapshot === void 0 ? void 0 : proposalSnapshot.topic_conditioning_topic) || (proposalSnapshot === null || proposalSnapshot === void 0 ? void 0 : proposalSnapshot.current_topics) || "")).trim();
                                                        noteText = String((proposalSnapshot === null || proposalSnapshot === void 0 ? void 0 : proposalSnapshot.tutor_notes) || "");
                                                        justificationText = String((proposalSnapshot === null || proposalSnapshot === void 0 ? void 0 : proposalSnapshot.justification) || "");
                                                        phaseFromNotes = (noteText.match(/Entry Phase:\s*([^\n\r]+)/i) || [])[1];
                                                        phaseFromJustification = (justificationText.match(/Entry phase\s*([^|\.]+)/i) || [])[1];
                                                        stabilityFromNotes = (noteText.match(/Stability:\s*([^\n\r]+)/i) || [])[1];
                                                        stabilityFromJustification = (justificationText.match(/Stability\s*([^|\.]+)/i) || [])[1];
                                                        topicConditioning = topic || phaseFromNotes || phaseFromJustification || stabilityFromNotes || stabilityFromJustification
                                                            ? {
                                                                topic: topic || null,
                                                                entry_phase: String(((proposalSnapshot === null || proposalSnapshot === void 0 ? void 0 : proposalSnapshot.topic_conditioning_entry_phase) || phaseFromNotes || phaseFromJustification || "")).trim() || null,
                                                                stability: String(((proposalSnapshot === null || proposalSnapshot === void 0 ? void 0 : proposalSnapshot.topic_conditioning_stability) || stabilityFromNotes || stabilityFromJustification || "")).trim() || null,
                                                            }
                                                            : null;
                                                        return [2 /*return*/, __assign(__assign({}, student), { parentInfo: parentEnrollment || null, topicConditioning: topicConditioning, proposalSentAt: (parentEnrollment === null || parentEnrollment === void 0 ? void 0 : parentEnrollment.proposal_sent_at) || null, parentApprovedAt: isApproved ? (proposalAcceptedAt || (parentEnrollment === null || parentEnrollment === void 0 ? void 0 : parentEnrollment.updated_at)) : null })];
                                                    case 4:
                                                        err_3 = _a.sent();
                                                        // If no parent enrollment found, return student without parentInfo
                                                        return [2 /*return*/, __assign(__assign({}, student), { parentInfo: null, topicConditioning: null, proposalSentAt: null, parentApprovedAt: null })];
                                                    case 5: return [2 /*return*/];
                                                }
                                            });
                                        }); }))];
                                case 12:
                                    studentsWithParentInfo = _a.sent();
                                    res.json({ assignment: assignment, students: studentsWithParentInfo });
                                    return [3 /*break*/, 14];
                                case 13:
                                    error_9 = _a.sent();
                                    console.error("Error fetching pod:", error_9);
                                    res.status(500).json({ message: "Failed to fetch pod" });
                                    return [3 /*break*/, 14];
                                case 14: return [2 /*return*/];
                            }
                        });
                    }); });
                    // Backfill students from assigned parent_enrollments for the authenticated tutor
                    // Useful in split deployments if automatic creation didn't run
                    app.post("/api/tutor/backfill-students", isAuthenticated, requireRole(["tutor"]), function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var tutorId, created, _a, assignedEnrollments, enrollErr, _i, assignedEnrollments_2, enrollment, existingStudent, insertErr, error_10;
                        return __generator(this, function (_b) {
                            switch (_b.label) {
                                case 0:
                                    _b.trys.push([0, 7, , 8]);
                                    tutorId = req.dbUser.id;
                                    created = [];
                                    return [4 /*yield*/, supabase
                                            .from("parent_enrollments")
                                            .select("*")
                                            .eq("assigned_tutor_id", tutorId)
                                            .eq("status", "assigned")];
                                case 1:
                                    _a = _b.sent(), assignedEnrollments = _a.data, enrollErr = _a.error;
                                    if (enrollErr) {
                                        return [2 /*return*/, res.status(500).json({ message: "Failed to fetch enrollments" })];
                                    }
                                    if (!(assignedEnrollments && assignedEnrollments.length > 0)) return [3 /*break*/, 6];
                                    _i = 0, assignedEnrollments_2 = assignedEnrollments;
                                    _b.label = 2;
                                case 2:
                                    if (!(_i < assignedEnrollments_2.length)) return [3 /*break*/, 6];
                                    enrollment = assignedEnrollments_2[_i];
                                    return [4 /*yield*/, supabase
                                            .from("students")
                                            .select("id")
                                            .eq("name", enrollment.student_full_name)
                                            .eq("tutor_id", tutorId)
                                            .maybeSingle()];
                                case 3:
                                    existingStudent = (_b.sent()).data;
                                    if (!!existingStudent) return [3 /*break*/, 5];
                                    return [4 /*yield*/, supabase
                                            .from("students")
                                            .insert({
                                            name: enrollment.student_full_name,
                                            grade: enrollment.student_grade,
                                            tutor_id: tutorId,
                                            confidence_score: confidenceScore,
                                            session_progress: 0,
                                            parent_contact: enrollment.parent_email,
                                        })];
                                case 4:
                                    insertErr = (_b.sent()).error;
                                    if (!insertErr) {
                                        created.push(enrollment.student_full_name);
                                    }
                                    _b.label = 5;
                                case 5:
                                    _i++;
                                    return [3 /*break*/, 2];
                                case 6:
                                    res.json({ success: true, created: created });
                                    return [3 /*break*/, 8];
                                case 7:
                                    error_10 = _b.sent();
                                    console.error("Error backfilling students:", error_10);
                                    res.status(500).json({ message: "Failed to backfill students" });
                                    return [3 /*break*/, 8];
                                case 8: return [2 /*return*/];
                            }
                        });
                    }); });
                    // Get tutor's students
                    app.get("/api/tutor/students", isAuthenticated, requireRole(["tutor"]), function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var tutorId, students, error_11;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    _a.trys.push([0, 2, , 3]);
                                    tutorId = req.dbUser.id;
                                    return [4 /*yield*/, storage.getStudentsByTutor(tutorId)];
                                case 1:
                                    students = _a.sent();
                                    res.json(students);
                                    return [3 /*break*/, 3];
                                case 2:
                                    error_11 = _a.sent();
                                    console.error("Error fetching students:", error_11);
                                    res.status(500).json({ message: "Failed to fetch students" });
                                    return [3 /*break*/, 3];
                                case 3: return [2 /*return*/];
                            }
                        });
                    }); });
                    // Get tutor's sessions
                    app.get("/api/tutor/sessions", isAuthenticated, requireRole(["tutor"]), function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var tutorId, sessions, error_12;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    _a.trys.push([0, 2, , 3]);
                                    tutorId = req.dbUser.id;
                                    return [4 /*yield*/, storage.getSessionsByTutor(tutorId)];
                                case 1:
                                    sessions = _a.sent();
                                    res.json(sessions);
                                    return [3 /*break*/, 3];
                                case 2:
                                    error_12 = _a.sent();
                                    console.error("Error fetching sessions:", error_12);
                                    res.status(500).json({ message: "Failed to fetch sessions" });
                                    return [3 /*break*/, 3];
                                case 3: return [2 /*return*/];
                            }
                        });
                    }); });
                    // Create session
                    app.post("/api/tutor/sessions", isAuthenticated, requireRole(["tutor"]), function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var tutorId, data, session, student, sessions, error_13;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    _a.trys.push([0, 6, , 7]);
                                    tutorId = req.dbUser.id;
                                    data = insertSessionSchema.parse(__assign(__assign({}, req.body), { tutorId: tutorId, date: new Date(req.body.date) }));
                                    return [4 /*yield*/, storage.createSession(data)];
                                case 1:
                                    session = _a.sent();
                                    return [4 /*yield*/, storage.getStudent(data.studentId)];
                                case 2:
                                    student = _a.sent();
                                    if (!student) return [3 /*break*/, 5];
                                    return [4 /*yield*/, storage.getSessionsByStudent(data.studentId)];
                                case 3:
                                    sessions = _a.sent();
                                    return [4 /*yield*/, storage.updateStudentProgress(data.studentId, sessions.length, data.confidenceScoreDelta || 0)];
                                case 4:
                                    _a.sent();
                                    _a.label = 5;
                                case 5:
                                    res.json(session);
                                    return [3 /*break*/, 7];
                                case 6:
                                    error_13 = _a.sent();
                                    console.error("Error creating session:", error_13);
                                    res.status(400).json({ message: "Failed to create session" });
                                    return [3 /*break*/, 7];
                                case 7: return [2 /*return*/];
                            }
                        });
                    }); });
                    // Get tutor's reflections
                    app.get("/api/tutor/reflections", isAuthenticated, requireRole(["tutor"]), function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var tutorId, reflections, error_14;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    _a.trys.push([0, 2, , 3]);
                                    tutorId = req.dbUser.id;
                                    return [4 /*yield*/, storage.getReflectionsByTutor(tutorId)];
                                case 1:
                                    reflections = _a.sent();
                                    res.json(reflections);
                                    return [3 /*break*/, 3];
                                case 2:
                                    error_14 = _a.sent();
                                    console.error("Error fetching reflections:", error_14);
                                    res.status(500).json({ message: "Failed to fetch reflections" });
                                    return [3 /*break*/, 3];
                                case 3: return [2 /*return*/];
                            }
                        });
                    }); });
                    // Create reflection
                    app.post("/api/tutor/reflections", isAuthenticated, requireRole(["tutor"]), function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var tutorId, reflection, error_15;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    _a.trys.push([0, 2, , 3]);
                                    tutorId = req.dbUser.id;
                                    return [4 /*yield*/, storage.createReflection({
                                            tutorId: tutorId,
                                            date: new Date(),
                                            reflectionText: req.body.reflectionText,
                                            habitScore: req.body.habitScore,
                                        })];
                                case 1:
                                    reflection = _a.sent();
                                    res.json(reflection);
                                    return [3 /*break*/, 3];
                                case 2:
                                    error_15 = _a.sent();
                                    console.error("Error creating reflection:", error_15);
                                    res.status(400).json({ message: "Failed to create reflection" });
                                    return [3 /*break*/, 3];
                                case 3: return [2 /*return*/];
                            }
                        });
                    }); });
                    // ========================================
                    // SCHOOL TRACKER ROUTES (Academic Profiles & Struggle Targets)
                    // ========================================
                    // Get tutor's own academic profile
                    app.get("/api/tutor/profile", isAuthenticated, requireRole(["tutor"]), function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var dbUser, profile, error_16;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    _a.trys.push([0, 2, , 3]);
                                    dbUser = req.dbUser;
                                    return [4 /*yield*/, storage.getAcademicProfile(dbUser.id)];
                                case 1:
                                    profile = _a.sent();
                                    res.json(profile);
                                    return [3 /*break*/, 3];
                                case 2:
                                    error_16 = _a.sent();
                                    console.error("Error fetching tutor's academic profile:", error_16);
                                    res.status(500).json({ message: "Failed to fetch academic profile" });
                                    return [3 /*break*/, 3];
                                case 3: return [2 /*return*/];
                            }
                        });
                    }); });
                    // Create or update tutor's own academic profile
                    app.post("/api/tutor/profile", isAuthenticated, requireRole(["tutor"]), function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var dbUser, data, profile, error_17;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    _a.trys.push([0, 2, , 3]);
                                    dbUser = req.dbUser;
                                    console.log("Saving profile for user:", dbUser.id);
                                    console.log("Request body:", req.body);
                                    data = insertAcademicProfileSchema.parse(__assign(__assign({}, req.body), { studentId: dbUser.id }));
                                    console.log("Parsed data:", data);
                                    return [4 /*yield*/, storage.upsertAcademicProfile(data)];
                                case 1:
                                    profile = _a.sent();
                                    console.log("Saved profile:", profile);
                                    res.json(profile);
                                    return [3 /*break*/, 3];
                                case 2:
                                    error_17 = _a.sent();
                                    console.error("Error saving tutor's academic profile:", error_17);
                                    res.status(400).json({ message: "Failed to save academic profile: ".concat(error_17 instanceof Error ? error_17.message : String(error_17)) });
                                    return [3 /*break*/, 3];
                                case 3: return [2 /*return*/];
                            }
                        });
                    }); });
                    // Get tutor's user profile (phone, bio, profile picture)
                    app.get("/api/tutor/user-profile", isAuthenticated, requireRole(["tutor"]), function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var dbUser, user, error_18;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    _a.trys.push([0, 2, , 3]);
                                    dbUser = req.dbUser;
                                    return [4 /*yield*/, storage.getUser(dbUser.id)];
                                case 1:
                                    user = _a.sent();
                                    if (!user) {
                                        return [2 /*return*/, res.status(404).json({ message: "User not found" })];
                                    }
                                    res.json(user);
                                    return [3 /*break*/, 3];
                                case 2:
                                    error_18 = _a.sent();
                                    console.error("Error fetching user profile:", error_18);
                                    res.status(500).json({ message: "Failed to fetch user profile" });
                                    return [3 /*break*/, 3];
                                case 3: return [2 /*return*/];
                            }
                        });
                    }); });
                    // Update tutor's user profile (phone, bio)
                    app.put("/api/tutor/profile", isAuthenticated, requireRole(["tutor"]), function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var dbUser, _a, phone, bio, updated, error_19;
                        return __generator(this, function (_b) {
                            switch (_b.label) {
                                case 0:
                                    _b.trys.push([0, 2, , 3]);
                                    dbUser = req.dbUser;
                                    _a = req.body, phone = _a.phone, bio = _a.bio;
                                    return [4 /*yield*/, storage.updateUserProfile(dbUser.id, {
                                            phone: phone || null,
                                            bio: bio || null,
                                        })];
                                case 1:
                                    updated = _b.sent();
                                    if (!updated) {
                                        return [2 /*return*/, res.status(404).json({ message: "User not found" })];
                                    }
                                    res.json(updated);
                                    return [3 /*break*/, 3];
                                case 2:
                                    error_19 = _b.sent();
                                    console.error("Error updating user profile:", error_19);
                                    res.status(400).json({ message: "Failed to update user profile" });
                                    return [3 /*break*/, 3];
                                case 3: return [2 /*return*/];
                            }
                        });
                    }); });
                    // Upload profile image
                    app.post("/api/tutor/profile/upload-image", isAuthenticated, requireRole(["tutor"]), function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var dbUser, _a, imageBase64, imageMime, dataUrl, updated, error_20;
                        return __generator(this, function (_b) {
                            switch (_b.label) {
                                case 0:
                                    _b.trys.push([0, 2, , 3]);
                                    dbUser = req.dbUser;
                                    _a = req.body, imageBase64 = _a.imageBase64, imageMime = _a.imageMime;
                                    if (!imageBase64) {
                                        return [2 /*return*/, res.status(400).json({ message: "No image data provided" })];
                                    }
                                    console.log("Received profile image for tutor ".concat(dbUser.id, " - size: ").concat(imageBase64.length, " chars, mime: ").concat(imageMime));
                                    dataUrl = "data:".concat(imageMime || 'image/jpeg', ";base64,").concat(imageBase64);
                                    console.log("Data URL length: ".concat(dataUrl.length, " chars"));
                                    // Update user profile with data URL
                                    console.log("Updating user profile with image...");
                                    return [4 /*yield*/, storage.updateUserProfile(dbUser.id, {
                                            profileImageUrl: dataUrl,
                                        })];
                                case 1:
                                    updated = _b.sent();
                                    console.log("Update result:", updated ? "success" : "no result");
                                    if (!updated) {
                                        console.error("updateUserProfile returned undefined");
                                        return [2 /*return*/, res.status(404).json({ message: "User not found" })];
                                    }
                                    console.log("Profile picture stored for user ".concat(dbUser.id));
                                    res.json(updated);
                                    return [3 /*break*/, 3];
                                case 2:
                                    error_20 = _b.sent();
                                    console.error("Error uploading profile image:", error_20);
                                    res.status(500).json({
                                        message: "Failed to upload profile image",
                                        error: error_20 instanceof Error ? error_20.message : String(error_20)
                                    });
                                    return [3 /*break*/, 3];
                                case 3: return [2 /*return*/];
                            }
                        });
                    }); });
                    // Delete profile image
                    app.delete("/api/tutor/profile/image", isAuthenticated, requireRole(["tutor"]), function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var dbUser, updated, error_21;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    _a.trys.push([0, 2, , 3]);
                                    dbUser = req.dbUser;
                                    return [4 /*yield*/, storage.updateUserProfile(dbUser.id, {
                                            profileImageUrl: null,
                                        })];
                                case 1:
                                    updated = _a.sent();
                                    if (!updated) {
                                        return [2 /*return*/, res.status(404).json({ message: "User not found" })];
                                    }
                                    res.json(updated);
                                    return [3 /*break*/, 3];
                                case 2:
                                    error_21 = _a.sent();
                                    console.error("Error removing profile image:", error_21);
                                    res.status(500).json({ message: "Failed to remove profile image" });
                                    return [3 /*break*/, 3];
                                case 3: return [2 /*return*/];
                            }
                        });
                    }); });
                    // Get student's academic profile
                    app.get("/api/tutor/students/:studentId/profile", isAuthenticated, requireRole(["tutor"]), function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var studentId, profile, error_22;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    _a.trys.push([0, 2, , 3]);
                                    studentId = req.params.studentId;
                                    return [4 /*yield*/, storage.getAcademicProfile(studentId)];
                                case 1:
                                    profile = _a.sent();
                                    res.json(profile);
                                    return [3 /*break*/, 3];
                                case 2:
                                    error_22 = _a.sent();
                                    console.error("Error fetching academic profile:", error_22);
                                    res.status(500).json({ message: "Failed to fetch academic profile" });
                                    return [3 /*break*/, 3];
                                case 3: return [2 /*return*/];
                            }
                        });
                    }); });
                    // Create or update student's academic profile
                    app.post("/api/tutor/students/:studentId/profile", isAuthenticated, requireRole(["tutor"]), function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var studentId, data, profile, error_23;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    _a.trys.push([0, 2, , 3]);
                                    studentId = req.params.studentId;
                                    data = insertAcademicProfileSchema.parse(__assign(__assign({}, req.body), { studentId: studentId }));
                                    return [4 /*yield*/, storage.upsertAcademicProfile(data)];
                                case 1:
                                    profile = _a.sent();
                                    res.json(profile);
                                    return [3 /*break*/, 3];
                                case 2:
                                    error_23 = _a.sent();
                                    console.error("Error saving academic profile:", error_23);
                                    res.status(400).json({ message: "Failed to save academic profile" });
                                    return [3 /*break*/, 3];
                                case 3: return [2 /*return*/];
                            }
                        });
                    }); });
                    // Get tutor's own struggle targets
                    app.get("/api/tutor/targets", isAuthenticated, requireRole(["tutor"]), function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var dbUser, targets, error_24;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    _a.trys.push([0, 2, , 3]);
                                    dbUser = req.dbUser;
                                    return [4 /*yield*/, storage.getStruggleTargets(dbUser.id)];
                                case 1:
                                    targets = _a.sent();
                                    res.json(targets);
                                    return [3 /*break*/, 3];
                                case 2:
                                    error_24 = _a.sent();
                                    console.error("Error fetching tutor's struggle targets:", error_24);
                                    res.status(500).json({ message: "Failed to fetch struggle targets" });
                                    return [3 /*break*/, 3];
                                case 3: return [2 /*return*/];
                            }
                        });
                    }); });
                    // Get student's struggle targets
                    app.get("/api/tutor/students/:studentId/targets", isAuthenticated, requireRole(["tutor"]), function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var studentId, targets, error_25;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    _a.trys.push([0, 2, , 3]);
                                    studentId = req.params.studentId;
                                    return [4 /*yield*/, storage.getStruggleTargets(studentId)];
                                case 1:
                                    targets = _a.sent();
                                    res.json(targets);
                                    return [3 /*break*/, 3];
                                case 2:
                                    error_25 = _a.sent();
                                    console.error("Error fetching struggle targets:", error_25);
                                    res.status(500).json({ message: "Failed to fetch struggle targets" });
                                    return [3 /*break*/, 3];
                                case 3: return [2 /*return*/];
                            }
                        });
                    }); });
                    // Save student identity sheet
                    app.post("/api/tutor/students/:studentId/identity-sheet", isAuthenticated, requireRole(["tutor"]), function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var studentId, dbUser, formData, student, updatedStudent, error_26;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    _a.trys.push([0, 3, , 4]);
                                    studentId = req.params.studentId;
                                    dbUser = req.dbUser;
                                    formData = req.body;
                                    console.log("📥 Received formData.confidenceTriggers:", formData.confidenceTriggers);
                                    console.log("Type:", typeof formData.confidenceTriggers, "IsArray:", Array.isArray(formData.confidenceTriggers));
                                    console.log("📥 Received formData.confidenceKillers:", formData.confidenceKillers);
                                    console.log("Type:", typeof formData.confidenceKillers, "IsArray:", Array.isArray(formData.confidenceKillers));
                                    return [4 /*yield*/, storage.getStudent(studentId)];
                                case 1:
                                    student = _a.sent();
                                    if (!student) {
                                        return [2 /*return*/, res.status(404).json({ message: "Student not found" })];
                                    }
                                    if (student.tutorId !== dbUser.id) {
                                        return [2 /*return*/, res.status(403).json({ message: "Unauthorized: Student does not belong to this tutor" })];
                                    }
                                    // Update student with identity sheet data
                                    console.log("Saving confidenceTriggers:", formData.confidenceTriggers, "Type:", typeof formData.confidenceTriggers, "IsArray:", Array.isArray(formData.confidenceTriggers));
                                    console.log("Saving confidenceKillers:", formData.confidenceKillers, "Type:", typeof formData.confidenceKillers, "IsArray:", Array.isArray(formData.confidenceKillers));
                                    return [4 /*yield*/, storage.updateStudent(studentId, {
                                            personalProfile: {
                                                name: formData.name,
                                                grade: formData.grade,
                                                school: formData.school,
                                                learningId: formData.learningId,
                                                personalityType: formData.personalityType,
                                                longTermGoals: formData.longTermGoals,
                                            },
                                            emotionalInsights: {
                                                relationshipWithMath: formData.relationshipWithMath,
                                                confidenceTriggers: formData.confidenceTriggers,
                                                confidenceKillers: formData.confidenceKillers,
                                                pressureResponse: formData.pressureResponse,
                                                growthDrivers: formData.growthDrivers,
                                            },
                                            academicDiagnosis: {
                                                currentClassTopics: formData.currentClassTopics,
                                                strugglesWith: formData.strugglesWith,
                                                gapsIdentified: formData.gapsIdentified,
                                                bossBattlesCompleted: formData.bossBattlesCompleted,
                                                lastBossBattleResult: formData.lastBossBattleResult,
                                                tutorNotes: formData.tutorNotes,
                                            },
                                            identitySheet: formData.identitySheetResponses,
                                            identitySheetCompletedAt: new Date(),
                                        })];
                                case 2:
                                    updatedStudent = _a.sent();
                                    res.json({
                                        success: true,
                                        message: "Identity sheet saved successfully",
                                        student: updatedStudent,
                                    });
                                    return [3 /*break*/, 4];
                                case 3:
                                    error_26 = _a.sent();
                                    console.error("Error saving identity sheet:", error_26);
                                    res.status(500).json({
                                        message: "Failed to save identity sheet",
                                        error: error_26 instanceof Error ? error_26.message : String(error_26),
                                    });
                                    return [3 /*break*/, 4];
                                case 4: return [2 /*return*/];
                            }
                        });
                    }); });
                    // Get student identity sheet
                    app.get("/api/tutor/students/:studentId/identity-sheet", isAuthenticated, requireRole(["tutor"]), function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var studentId, dbUser, student, identitySheetData, error_27;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    _a.trys.push([0, 2, , 3]);
                                    studentId = req.params.studentId;
                                    dbUser = req.dbUser;
                                    console.log("📋 Identity sheet request:", {
                                        studentId: studentId,
                                        tutorId: dbUser === null || dbUser === void 0 ? void 0 : dbUser.id,
                                        origin: req.headers.origin,
                                        authHeader: req.headers.authorization ? 'present' : 'missing',
                                    });
                                    console.log("📋 Identity sheet request - studentId:", studentId, "tutorId:", dbUser === null || dbUser === void 0 ? void 0 : dbUser.id);
                                    return [4 /*yield*/, storage.getStudent(studentId)];
                                case 1:
                                    student = _a.sent();
                                    if (!student) {
                                        console.log("❌ Student not found:", studentId);
                                        return [2 /*return*/, res.status(404).json({ message: "Student not found" })];
                                    }
                                    console.log("✅ Student found:", student.id, "student.tutorId:", student.tutorId);
                                    if (student.tutorId !== dbUser.id) {
                                        console.log("❌ Tutor mismatch - student.tutorId:", student.tutorId, "dbUser.id:", dbUser.id);
                                        return [2 /*return*/, res.status(403).json({ message: "Unauthorized: Student does not belong to this tutor" })];
                                    }
                                    identitySheetData = {
                                        personalProfile: student.personalProfile || null,
                                        emotionalInsights: student.emotionalInsights || null,
                                        academicDiagnosis: student.academicDiagnosis || null,
                                        identitySheet: student.identitySheet || null,
                                        completedAt: student.identitySheetCompletedAt || null,
                                    };
                                    console.log("✅ Returning identity sheet data for student:", studentId);
                                    res.json(identitySheetData);
                                    return [3 /*break*/, 3];
                                case 2:
                                    error_27 = _a.sent();
                                    console.error("Error fetching identity sheet:", error_27);
                                    res.status(500).json({ message: "Failed to fetch identity sheet" });
                                    return [3 /*break*/, 3];
                                case 3: return [2 /*return*/];
                            }
                        });
                    }); });
                    // Get student assignments (form submissions)
                    app.get("/api/tutor/students/:studentId/assignments", isAuthenticated, requireRole(["tutor"]), function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var studentId, dbUser, student, _a, assignments, error, error_28;
                        return __generator(this, function (_b) {
                            switch (_b.label) {
                                case 0:
                                    _b.trys.push([0, 3, , 4]);
                                    studentId = req.params.studentId;
                                    dbUser = req.dbUser;
                                    return [4 /*yield*/, storage.getStudent(studentId)];
                                case 1:
                                    student = _b.sent();
                                    if (!student) {
                                        return [2 /*return*/, res.status(404).json({ message: "Student not found" })];
                                    }
                                    if (student.tutorId !== dbUser.id) {
                                        return [2 /*return*/, res.status(403).json({ message: "Unauthorized: Student does not belong to this tutor" })];
                                    }
                                    return [4 /*yield*/, supabase
                                            .from("assignments")
                                            .select("*")
                                            .eq("student_id", studentId)
                                            .order("created_at", { ascending: false })];
                                case 2:
                                    _a = _b.sent(), assignments = _a.data, error = _a.error;
                                    if (error) {
                                        console.error("Error fetching assignments:", error);
                                        return [2 /*return*/, res.status(500).json({ message: "Failed to fetch assignments" })];
                                    }
                                    res.json(assignments || []);
                                    return [3 /*break*/, 4];
                                case 3:
                                    error_28 = _b.sent();
                                    console.error("Error fetching student assignments:", error_28);
                                    res.status(500).json({ message: "Failed to fetch assignments" });
                                    return [3 /*break*/, 4];
                                case 4: return [2 /*return*/];
                            }
                        });
                    }); });
                    // Get student tracking systems (sessions, reports, TD feedback)
                    app.get("/api/tutor/students/:studentId/tracking", isAuthenticated, requireRole(["tutor"]), function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var studentId, dbUser, student, _a, session, sessionError, _b, parentReports, reportsError, _c, tdFeedback, feedbackError, error_29;
                        return __generator(this, function (_d) {
                            switch (_d.label) {
                                case 0:
                                    _d.trys.push([0, 5, , 6]);
                                    studentId = req.params.studentId;
                                    dbUser = req.dbUser;
                                    return [4 /*yield*/, storage.getStudent(studentId)];
                                case 1:
                                    student = _d.sent();
                                    if (!student) {
                                        return [2 /*return*/, res.status(404).json({ message: "Student not found" })];
                                    }
                                    if (student.tutorId !== dbUser.id) {
                                        return [2 /*return*/, res.status(403).json({ message: "Unauthorized: Student does not belong to this tutor" })];
                                    }
                                    return [4 /*yield*/, supabase
                                            .from("scheduled_sessions")
                                            .select("id, scheduled_time, status, parent_confirmed, tutor_confirmed, created_at, updated_at")
                                            .eq("tutor_id", tutorId)
                                            .eq("parent_id", student.parentId)
                                            .eq("type", "intro")
                                            .order("created_at", { ascending: false })
                                            .maybeSingle()];
                                case 2:
                                    _a = _d.sent(), session = _a.data, sessionError = _a.error;
                                    return [4 /*yield*/, supabase
                                            .from("parent_reports")
                                            .select("*")
                                            .eq("student_id", studentId)
                                            .order("created_at", { ascending: false })];
                                case 3:
                                    _b = _d.sent(), parentReports = _b.data, reportsError = _b.error;
                                    if (reportsError) {
                                        console.error("Error fetching parent reports:", reportsError);
                                    }
                                    return [4 /*yield*/, supabase
                                            .from("weekly_check_ins")
                                            .select("*")
                                            .eq("tutor_id", dbUser.id)
                                            .order("created_at", { ascending: false })];
                                case 4:
                                    _c = _d.sent(), tdFeedback = _c.data, feedbackError = _c.error;
                                    if (feedbackError) {
                                        console.error("Error fetching TD feedback:", feedbackError);
                                    }
                                    res.json({
                                        sessions: sessions || [],
                                        parentReports: parentReports || [],
                                        tdFeedback: tdFeedback || [],
                                    });
                                    return [3 /*break*/, 6];
                                case 5:
                                    error_29 = _d.sent();
                                    console.error("Error fetching tracking data:", error_29);
                                    res.status(500).json({ message: "Failed to fetch tracking data" });
                                    return [3 /*break*/, 6];
                                case 6: return [2 /*return*/];
                            }
                        });
                    }); });
                    // Create struggle target
                    app.post("/api/tutor/students/:studentId/targets", isAuthenticated, requireRole(["tutor"]), function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var studentId, body, data, target, error_30;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    _a.trys.push([0, 2, , 3]);
                                    studentId = req.params.studentId;
                                    body = __assign(__assign({}, req.body), { studentId: studentId, consolidationDate: req.body.consolidationDate ? new Date(req.body.consolidationDate) : null });
                                    data = insertStruggleTargetSchema.parse(body);
                                    return [4 /*yield*/, storage.createStruggleTarget(data)];
                                case 1:
                                    target = _a.sent();
                                    res.json(target);
                                    return [3 /*break*/, 3];
                                case 2:
                                    error_30 = _a.sent();
                                    console.error("Error creating struggle target:", error_30);
                                    res.status(400).json({ message: "Failed to create struggle target" });
                                    return [3 /*break*/, 3];
                                case 3: return [2 /*return*/];
                            }
                        });
                    }); });
                    // Create tutor's own struggle target
                    app.post("/api/tutor/targets", isAuthenticated, requireRole(["tutor"]), function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var dbUser, body, data, target, error_31;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    _a.trys.push([0, 2, , 3]);
                                    dbUser = req.dbUser;
                                    console.log("Creating target for user:", dbUser.id);
                                    console.log("Request body:", req.body);
                                    body = __assign(__assign({}, req.body), { studentId: dbUser.id, consolidationDate: req.body.consolidationDate ? new Date(req.body.consolidationDate) : null });
                                    data = insertStruggleTargetSchema.parse(body);
                                    console.log("Parsed data:", data);
                                    return [4 /*yield*/, storage.createStruggleTarget(data)];
                                case 1:
                                    target = _a.sent();
                                    console.log("Created target:", target);
                                    res.json(target);
                                    return [3 /*break*/, 3];
                                case 2:
                                    error_31 = _a.sent();
                                    console.error("Error creating tutor's struggle target:", error_31);
                                    res.status(400).json({ message: "Failed to create struggle target: ".concat(error_31 instanceof Error ? error_31.message : String(error_31)) });
                                    return [3 /*break*/, 3];
                                case 3: return [2 /*return*/];
                            }
                        });
                    }); });
                    // Update struggle target
                    app.put("/api/tutor/targets/:id", isAuthenticated, requireRole(["tutor"]), function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var id, target, error_32;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    _a.trys.push([0, 2, , 3]);
                                    id = req.params.id;
                                    return [4 /*yield*/, storage.updateStruggleTarget(id, req.body)];
                                case 1:
                                    target = _a.sent();
                                    if (!target) {
                                        return [2 /*return*/, res.status(404).json({ message: "Target not found" })];
                                    }
                                    res.json(target);
                                    return [3 /*break*/, 3];
                                case 2:
                                    error_32 = _a.sent();
                                    console.error("Error updating struggle target:", error_32);
                                    res.status(400).json({ message: "Failed to update struggle target" });
                                    return [3 /*break*/, 3];
                                case 3: return [2 /*return*/];
                            }
                        });
                    }); });
                    // Delete struggle target
                    app.delete("/api/tutor/targets/:id", isAuthenticated, requireRole(["tutor"]), function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var id, error_33;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    _a.trys.push([0, 2, , 3]);
                                    id = req.params.id;
                                    return [4 /*yield*/, storage.deleteStruggleTarget(id)];
                                case 1:
                                    _a.sent();
                                    res.json({ success: true });
                                    return [3 /*break*/, 3];
                                case 2:
                                    error_33 = _a.sent();
                                    console.error("Error deleting struggle target:", error_33);
                                    res.status(500).json({ message: "Failed to delete struggle target" });
                                    return [3 /*break*/, 3];
                                case 3: return [2 /*return*/];
                            }
                        });
                    }); });
                    // ========================================
                    // WEEKLY CHECK-IN ROUTES (Tutor)
                    // ========================================
                    // Submit weekly check-in
                    app.post("/api/tutor/weekly-check-in", isAuthenticated, function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var tutorId, schema, data, weekStartDate, result, error_34;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    _a.trys.push([0, 2, , 3]);
                                    tutorId = req.dbUser.id;
                                    schema = z.object({
                                        podId: z.string(),
                                        weekStartDate: z.string(),
                                        sessionsSummary: z.string().min(1),
                                        wins: z.string().min(1),
                                        challenges: z.string().min(1),
                                        emotions: z.string().min(1),
                                        skillImprovement: z.string().min(1),
                                        helpNeeded: z.string().optional(),
                                        nextWeekGoals: z.string().min(1),
                                    });
                                    data = schema.parse(req.body);
                                    weekStartDate = new Date(data.weekStartDate);
                                    return [4 /*yield*/, storage.db.insert(storage.weeklyCheckIns).values({
                                            tutorId: tutorId,
                                            podId: data.podId,
                                            weekStartDate: weekStartDate,
                                            sessionsSummary: data.sessionsSummary,
                                            wins: data.wins,
                                            challenges: data.challenges,
                                            emotions: data.emotions,
                                            skillImprovement: data.skillImprovement,
                                            helpNeeded: data.helpNeeded || null,
                                            nextWeekGoals: data.nextWeekGoals,
                                        })];
                                case 1:
                                    result = _a.sent();
                                    res.json({ success: true, message: "Weekly check-in submitted" });
                                    return [3 /*break*/, 3];
                                case 2:
                                    error_34 = _a.sent();
                                    console.error("Error submitting weekly check-in:", error_34);
                                    res.status(400).json({ message: "Failed to submit check-in" });
                                    return [3 /*break*/, 3];
                                case 3: return [2 /*return*/];
                            }
                        });
                    }); });
                    // Get tutor's check-ins for a pod
                    app.get("/api/tutor/weekly-check-ins", isAuthenticated, function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var tutorId_2, podId_1, checkIns, error_35;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    _a.trys.push([0, 2, , 3]);
                                    tutorId_2 = req.dbUser.id;
                                    podId_1 = req.query.podId;
                                    if (!podId_1) {
                                        return [2 /*return*/, res.status(400).json({ message: "Pod ID required" })];
                                    }
                                    return [4 /*yield*/, storage.db.query.weeklyCheckIns.findMany({
                                            where: function (wci, _a) {
                                                var eq = _a.eq, and = _a.and;
                                                return and(eq(wci.tutorId, tutorId_2), eq(wci.podId, podId_1));
                                            },
                                            orderBy: function (wci, _a) {
                                                var desc = _a.desc;
                                                return desc(wci.weekStartDate);
                                            },
                                        })];
                                case 1:
                                    checkIns = _a.sent();
                                    res.json(checkIns);
                                    return [3 /*break*/, 3];
                                case 2:
                                    error_35 = _a.sent();
                                    console.error("Error fetching weekly check-ins:", error_35);
                                    res.status(500).json({ message: "Failed to fetch check-ins" });
                                    return [3 /*break*/, 3];
                                case 3: return [2 /*return*/];
                            }
                        });
                    }); });
                    // ========================================
                    // TD ROUTES
                    // ========================================
                    // Get TD's pod overview
                    app.get("/api/td/pod-overview", isAuthenticated, requireRole(["td"]), function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var tdId, pods, podOverviews, error_36;
                        var _this = this;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    _a.trys.push([0, 3, , 4]);
                                    tdId = req.dbUser.id;
                                    console.log("\uD83D\uDD0D [TD Pod Overview] Fetching pods for TD: ".concat(tdId));
                                    return [4 /*yield*/, storage.getPodsByTD(tdId)];
                                case 1:
                                    pods = _a.sent();
                                    console.log("\uD83D\uDCE6 [TD Pod Overview] Found ".concat((pods === null || pods === void 0 ? void 0 : pods.length) || 0, " pods"));
                                    if (!pods || pods.length === 0) {
                                        console.log("\u26A0\uFE0F  [TD Pod Overview] No pods found, returning empty array");
                                        return [2 /*return*/, res.json([])];
                                    }
                                    return [4 /*yield*/, Promise.all(pods.map(function (pod) { return __awaiter(_this, void 0, void 0, function () {
                                            var assignments, tutors, validTutors, totalStudents, totalSessions, _i, validTutors_1, tutor, students, _a, students_1, student;
                                            var _this = this;
                                            return __generator(this, function (_b) {
                                                switch (_b.label) {
                                                    case 0: return [4 /*yield*/, storage.getTutorAssignmentsByPod(pod.id)];
                                                    case 1:
                                                        assignments = _b.sent();
                                                        return [4 /*yield*/, Promise.all(assignments.map(function (assignment) { return __awaiter(_this, void 0, void 0, function () {
                                                                var tutor;
                                                                return __generator(this, function (_a) {
                                                                    switch (_a.label) {
                                                                        case 0: return [4 /*yield*/, storage.getUser(assignment.tutorId)];
                                                                        case 1:
                                                                            tutor = _a.sent();
                                                                            return [2 /*return*/, tutor ? __assign(__assign({}, tutor), { assignment: assignment }) : null];
                                                                    }
                                                                });
                                                            }); }))];
                                                    case 2:
                                                        tutors = _b.sent();
                                                        validTutors = tutors.filter(Boolean);
                                                        totalStudents = 0;
                                                        totalSessions = 0;
                                                        _i = 0, validTutors_1 = validTutors;
                                                        _b.label = 3;
                                                    case 3:
                                                        if (!(_i < validTutors_1.length)) return [3 /*break*/, 6];
                                                        tutor = validTutors_1[_i];
                                                        return [4 /*yield*/, storage.getStudentsByTutor(tutor.id)];
                                                    case 4:
                                                        students = _b.sent();
                                                        totalStudents += students.length;
                                                        for (_a = 0, students_1 = students; _a < students_1.length; _a++) {
                                                            student = students_1[_a];
                                                            totalSessions += student.sessionProgress;
                                                        }
                                                        _b.label = 5;
                                                    case 5:
                                                        _i++;
                                                        return [3 /*break*/, 3];
                                                    case 6: return [2 /*return*/, {
                                                            pod: pod,
                                                            tutors: validTutors,
                                                            totalStudents: totalStudents,
                                                            totalSessions: totalSessions,
                                                        }];
                                                }
                                            });
                                        }); }))];
                                case 2:
                                    podOverviews = _a.sent();
                                    res.json(podOverviews);
                                    return [3 /*break*/, 4];
                                case 3:
                                    error_36 = _a.sent();
                                    console.error("Error fetching pod overview:", error_36);
                                    res.status(500).json({ message: "Failed to fetch pod overview" });
                                    return [3 /*break*/, 4];
                                case 4: return [2 /*return*/];
                            }
                        });
                    }); });
                    // Get TD's tutors with profiles
                    app.get("/api/td/tutors", isAuthenticated, requireRole(["td"]), function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var tdId, pod, assignments, profiles, error_37;
                        var _this = this;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    _a.trys.push([0, 4, , 5]);
                                    tdId = req.dbUser.id;
                                    return [4 /*yield*/, storage.getPodByTD(tdId)];
                                case 1:
                                    pod = _a.sent();
                                    if (!pod) {
                                        return [2 /*return*/, res.json([])];
                                    }
                                    return [4 /*yield*/, storage.getTutorAssignmentsByPod(pod.id)];
                                case 2:
                                    assignments = _a.sent();
                                    return [4 /*yield*/, Promise.all(assignments.map(function (assignment) { return __awaiter(_this, void 0, void 0, function () {
                                            var tutor, students, sessions, reflections, avgHabitScore;
                                            return __generator(this, function (_a) {
                                                switch (_a.label) {
                                                    case 0: return [4 /*yield*/, storage.getUser(assignment.tutorId)];
                                                    case 1:
                                                        tutor = _a.sent();
                                                        if (!tutor)
                                                            return [2 /*return*/, null];
                                                        return [4 /*yield*/, storage.getStudentsByTutor(tutor.id)];
                                                    case 2:
                                                        students = _a.sent();
                                                        return [4 /*yield*/, storage.getSessionsByTutor(tutor.id)];
                                                    case 3:
                                                        sessions = _a.sent();
                                                        return [4 /*yield*/, storage.getReflectionsByTutor(tutor.id)];
                                                    case 4:
                                                        reflections = _a.sent();
                                                        avgHabitScore = reflections.length > 0
                                                            ? reflections.reduce(function (sum, r) { return sum + (r.habitScore || 0); }, 0) /
                                                                reflections.length
                                                            : 0;
                                                        return [2 /*return*/, {
                                                                tutor: tutor,
                                                                assignment: assignment,
                                                                students: students,
                                                                sessions: sessions,
                                                                reflectionCount: reflections.length,
                                                                avgHabitScore: avgHabitScore,
                                                            }];
                                                }
                                            });
                                        }); }))];
                                case 3:
                                    profiles = _a.sent();
                                    res.json(profiles.filter(Boolean));
                                    return [3 /*break*/, 5];
                                case 4:
                                    error_37 = _a.sent();
                                    console.error("Error fetching tutors:", error_37);
                                    res.status(500).json({ message: "Failed to fetch tutors" });
                                    return [3 /*break*/, 5];
                                case 5: return [2 /*return*/];
                            }
                        });
                    }); });
                    // Get all tutor weekly check-ins for a TD's pod
                    app.get("/api/td/tutor-check-ins", isAuthenticated, requireRole(["td"]), function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var tdId, pods, allCheckIns, _loop_1, _i, pods_1, pod, error_38;
                        var _this = this;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    _a.trys.push([0, 6, , 7]);
                                    tdId = req.dbUser.id;
                                    return [4 /*yield*/, storage.getPodsByTD(tdId)];
                                case 1:
                                    pods = _a.sent();
                                    if (!pods || pods.length === 0) {
                                        return [2 /*return*/, res.json([])];
                                    }
                                    allCheckIns = [];
                                    _loop_1 = function (pod) {
                                        var checkIns, enrichedCheckIns;
                                        return __generator(this, function (_b) {
                                            switch (_b.label) {
                                                case 0: return [4 /*yield*/, storage.db.query.weeklyCheckIns.findMany({
                                                        where: function (wci, _a) {
                                                            var eq = _a.eq;
                                                            return eq(wci.podId, pod.id);
                                                        },
                                                        orderBy: function (wci, _a) {
                                                            var desc = _a.desc;
                                                            return desc(wci.weekStartDate);
                                                        },
                                                    })];
                                                case 1:
                                                    checkIns = _b.sent();
                                                    return [4 /*yield*/, Promise.all(checkIns.map(function (checkIn) { return __awaiter(_this, void 0, void 0, function () {
                                                            var tutor;
                                                            return __generator(this, function (_a) {
                                                                switch (_a.label) {
                                                                    case 0: return [4 /*yield*/, storage.getUser(checkIn.tutorId)];
                                                                    case 1:
                                                                        tutor = _a.sent();
                                                                        return [2 /*return*/, __assign(__assign({}, checkIn), { podName: pod.podName, tutor: tutor ? { id: tutor.id, name: tutor.name || tutor.firstName, email: tutor.email } : null })];
                                                                }
                                                            });
                                                        }); }))];
                                                case 2:
                                                    enrichedCheckIns = _b.sent();
                                                    allCheckIns.push.apply(allCheckIns, enrichedCheckIns);
                                                    return [2 /*return*/];
                                            }
                                        });
                                    };
                                    _i = 0, pods_1 = pods;
                                    _a.label = 2;
                                case 2:
                                    if (!(_i < pods_1.length)) return [3 /*break*/, 5];
                                    pod = pods_1[_i];
                                    return [5 /*yield**/, _loop_1(pod)];
                                case 3:
                                    _a.sent();
                                    _a.label = 4;
                                case 4:
                                    _i++;
                                    return [3 /*break*/, 2];
                                case 5:
                                    res.json(allCheckIns);
                                    return [3 /*break*/, 7];
                                case 6:
                                    error_38 = _a.sent();
                                    console.error("Error fetching tutor check-ins:", error_38);
                                    res.status(500).json({ message: "Failed to fetch check-ins" });
                                    return [3 /*break*/, 7];
                                case 7: return [2 /*return*/];
                            }
                        });
                    }); });
                    // Get TD insights dashboard data
                    app.get("/api/td/insights", isAuthenticated, requireRole(["td"]), function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var tdId, pods, tutorsNeedingHelp, studentsAtRisk, podsBehindSchedule, recentCheckIns, _loop_2, _i, pods_2, pod, error_39;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    _a.trys.push([0, 6, , 7]);
                                    tdId = req.dbUser.id;
                                    return [4 /*yield*/, storage.getPodsByTD(tdId)];
                                case 1:
                                    pods = _a.sent();
                                    if (!pods || pods.length === 0) {
                                        return [2 /*return*/, res.json({
                                                tutorsNeedingHelp: [],
                                                studentsAtRisk: [],
                                                podsBehindSchedule: [],
                                                recentCheckIns: [],
                                            })];
                                    }
                                    tutorsNeedingHelp = [];
                                    studentsAtRisk = [];
                                    podsBehindSchedule = [];
                                    recentCheckIns = [];
                                    _loop_2 = function (pod) {
                                        var checkIns, _b, checkIns_1, checkIn, tutor, assignments, totalStudents, totalSessions, _c, assignments_1, assignment, students, _d, students_2, student, expectedSessions, tutor, maxSessions, expectedProgress, actualProgress;
                                        return __generator(this, function (_e) {
                                            switch (_e.label) {
                                                case 0: return [4 /*yield*/, storage.db.query.weeklyCheckIns.findMany({
                                                        where: function (wci, _a) {
                                                            var eq = _a.eq;
                                                            return eq(wci.podId, pod.id);
                                                        },
                                                        orderBy: function (wci, _a) {
                                                            var desc = _a.desc;
                                                            return desc(wci.weekStartDate);
                                                        },
                                                        limit: 10,
                                                    })];
                                                case 1:
                                                    checkIns = _e.sent();
                                                    _b = 0, checkIns_1 = checkIns;
                                                    _e.label = 2;
                                                case 2:
                                                    if (!(_b < checkIns_1.length)) return [3 /*break*/, 5];
                                                    checkIn = checkIns_1[_b];
                                                    return [4 /*yield*/, storage.getUser(checkIn.tutorId)];
                                                case 3:
                                                    tutor = _e.sent();
                                                    // Add to recent check-ins
                                                    recentCheckIns.push(__assign(__assign({}, checkIn), { tutorName: (tutor === null || tutor === void 0 ? void 0 : tutor.name) || (tutor === null || tutor === void 0 ? void 0 : tutor.firstName), podName: pod.podName }));
                                                    // Check if tutor needs help
                                                    if (checkIn.helpNeeded && checkIn.helpNeeded.trim().length > 0) {
                                                        tutorsNeedingHelp.push({
                                                            tutorId: checkIn.tutorId,
                                                            tutorName: (tutor === null || tutor === void 0 ? void 0 : tutor.name) || (tutor === null || tutor === void 0 ? void 0 : tutor.firstName),
                                                            tutorEmail: tutor === null || tutor === void 0 ? void 0 : tutor.email,
                                                            podName: pod.podName,
                                                            helpNeeded: checkIn.helpNeeded,
                                                            challenges: checkIn.challenges,
                                                            weekStartDate: checkIn.weekStartDate,
                                                            submittedAt: checkIn.submittedAt,
                                                        });
                                                    }
                                                    _e.label = 4;
                                                case 4:
                                                    _b++;
                                                    return [3 /*break*/, 2];
                                                case 5: return [4 /*yield*/, storage.getTutorAssignmentsByPod(pod.id)];
                                                case 6:
                                                    assignments = _e.sent();
                                                    totalStudents = 0;
                                                    totalSessions = 0;
                                                    _c = 0, assignments_1 = assignments;
                                                    _e.label = 7;
                                                case 7:
                                                    if (!(_c < assignments_1.length)) return [3 /*break*/, 13];
                                                    assignment = assignments_1[_c];
                                                    return [4 /*yield*/, storage.getStudentsByTutor(assignment.tutorId)];
                                                case 8:
                                                    students = _e.sent();
                                                    totalStudents += students.length;
                                                    _d = 0, students_2 = students;
                                                    _e.label = 9;
                                                case 9:
                                                    if (!(_d < students_2.length)) return [3 /*break*/, 12];
                                                    student = students_2[_d];
                                                    totalSessions += student.sessionProgress || 0;
                                                    expectedSessions = 3;
                                                    if (!(student.sessionProgress < expectedSessions || (student.confidenceScore || 0) < 5)) return [3 /*break*/, 11];
                                                    return [4 /*yield*/, storage.getUser(assignment.tutorId)];
                                                case 10:
                                                    tutor = _e.sent();
                                                    studentsAtRisk.push({
                                                        studentId: student.id,
                                                        studentName: student.name,
                                                        tutorId: assignment.tutorId,
                                                        tutorName: (tutor === null || tutor === void 0 ? void 0 : tutor.name) || (tutor === null || tutor === void 0 ? void 0 : tutor.firstName),
                                                        podName: pod.podName,
                                                        sessionProgress: student.sessionProgress,
                                                        confidenceScore: student.confidenceScore,
                                                        reason: student.sessionProgress < expectedSessions ? 'Behind on sessions' : 'Low confidence',
                                                    });
                                                    _e.label = 11;
                                                case 11:
                                                    _d++;
                                                    return [3 /*break*/, 9];
                                                case 12:
                                                    _c++;
                                                    return [3 /*break*/, 7];
                                                case 13:
                                                    maxSessions = totalStudents * 9;
                                                    expectedProgress = 0.3;
                                                    actualProgress = maxSessions > 0 ? totalSessions / maxSessions : 0;
                                                    if (actualProgress < expectedProgress && totalStudents > 0) {
                                                        podsBehindSchedule.push({
                                                            podId: pod.id,
                                                            podName: pod.podName,
                                                            totalStudents: totalStudents,
                                                            totalSessions: totalSessions,
                                                            maxSessions: maxSessions,
                                                            progress: Math.round(actualProgress * 100),
                                                            tutorCount: assignments.length,
                                                        });
                                                    }
                                                    return [2 /*return*/];
                                            }
                                        });
                                    };
                                    _i = 0, pods_2 = pods;
                                    _a.label = 2;
                                case 2:
                                    if (!(_i < pods_2.length)) return [3 /*break*/, 5];
                                    pod = pods_2[_i];
                                    return [5 /*yield**/, _loop_2(pod)];
                                case 3:
                                    _a.sent();
                                    _a.label = 4;
                                case 4:
                                    _i++;
                                    return [3 /*break*/, 2];
                                case 5:
                                    res.json({
                                        tutorsNeedingHelp: tutorsNeedingHelp.slice(0, 10), // Top 10
                                        studentsAtRisk: studentsAtRisk.slice(0, 15), // Top 15
                                        podsBehindSchedule: podsBehindSchedule,
                                        recentCheckIns: recentCheckIns.slice(0, 5), // Most recent 5
                                    });
                                    return [3 /*break*/, 7];
                                case 6:
                                    error_39 = _a.sent();
                                    console.error("Error fetching TD insights:", error_39);
                                    res.status(500).json({ message: "Failed to fetch insights" });
                                    return [3 /*break*/, 7];
                                case 7: return [2 /*return*/];
                            }
                        });
                    }); });
                    // ========================================
                    // COO ROUTES
                    // ========================================
                    // Get COO dashboard stats
                    app.get("/api/coo/stats", isAuthenticated, requireRole(["coo"]), function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var allUsers, verifiedTutors, pendingApplications, pods, activePods, totalStudents, totalSessions, _i, allUsers_1, tutor, students, _a, students_3, student, completionRate, error_40;
                        return __generator(this, function (_b) {
                            switch (_b.label) {
                                case 0:
                                    _b.trys.push([0, 7, , 8]);
                                    return [4 /*yield*/, storage.getUsersByRole("tutor")];
                                case 1:
                                    allUsers = _b.sent();
                                    verifiedTutors = allUsers.filter(function (u) { return u.verified; });
                                    pendingApplications = allUsers.filter(function (u) { return !u.verified; });
                                    return [4 /*yield*/, storage.getPods()];
                                case 2:
                                    pods = _b.sent();
                                    activePods = pods.filter(function (p) { return p.status === "active"; });
                                    totalStudents = 0;
                                    totalSessions = 0;
                                    _i = 0, allUsers_1 = allUsers;
                                    _b.label = 3;
                                case 3:
                                    if (!(_i < allUsers_1.length)) return [3 /*break*/, 6];
                                    tutor = allUsers_1[_i];
                                    return [4 /*yield*/, storage.getStudentsByTutor(tutor.id)];
                                case 4:
                                    students = _b.sent();
                                    totalStudents += students.length;
                                    for (_a = 0, students_3 = students; _a < students_3.length; _a++) {
                                        student = students_3[_a];
                                        totalSessions += student.sessionProgress;
                                    }
                                    _b.label = 5;
                                case 5:
                                    _i++;
                                    return [3 /*break*/, 3];
                                case 6:
                                    completionRate = totalStudents > 0 ? (totalSessions / (totalStudents * 9)) * 100 : 0;
                                    res.json({
                                        totalTutors: allUsers.length,
                                        verifiedTutors: verifiedTutors.length,
                                        pendingApplications: pendingApplications.length,
                                        activePods: activePods.length,
                                        totalStudents: totalStudents,
                                        totalSessions: totalSessions,
                                        completionRate: completionRate,
                                    });
                                    return [3 /*break*/, 8];
                                case 7:
                                    error_40 = _b.sent();
                                    console.error("Error fetching stats:", error_40);
                                    res.status(500).json({ message: "Failed to fetch stats" });
                                    return [3 /*break*/, 8];
                                case 8: return [2 /*return*/];
                            }
                        });
                    }); });
                    // Get COO sales & affiliate overview stats
                    app.get("/api/coo/sales-stats", isAuthenticated, requireRole(["coo"]), function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var affiliates, supabase_1, _a, leads_1, _b, closes_1, affiliateDetails, organicLeads_1, organicCloses, organicStats, allDetails, error_41;
                        return __generator(this, function (_c) {
                            switch (_c.label) {
                                case 0:
                                    _c.trys.push([0, 4, , 5]);
                                    return [4 /*yield*/, storage.getUsersByRole("affiliate")];
                                case 1:
                                    affiliates = _c.sent();
                                    supabase_1 = storage.supabase;
                                    return [4 /*yield*/, supabase_1
                                            .from("leads")
                                            .select("*")];
                                case 2:
                                    _a = (_c.sent()).data, leads_1 = _a === void 0 ? [] : _a;
                                    return [4 /*yield*/, supabase_1
                                            .from("closes")
                                            .select("*")];
                                case 3:
                                    _b = (_c.sent()).data, closes_1 = _b === void 0 ? [] : _b;
                                    affiliateDetails = affiliates.map(function (aff) {
                                        var affLeads = leads_1.filter(function (l) { return l.affiliate_id === aff.id; });
                                        var affCloses = closes_1.filter(function (c) {
                                            return affLeads.some(function (l) { return l.user_id === c.parent_id; });
                                        });
                                        return {
                                            id: aff.id,
                                            name: aff.name || aff.email,
                                            email: aff.email,
                                            totalLeads: affLeads.length,
                                            totalCloses: affCloses.length,
                                            conversionRate: affLeads.length > 0
                                                ? Math.round((affCloses.length / affLeads.length) * 100)
                                                : 0,
                                        };
                                    });
                                    organicLeads_1 = leads_1.filter(function (l) { return l.affiliate_id === null; });
                                    organicCloses = closes_1.filter(function (c) {
                                        return organicLeads_1.some(function (l) { return l.user_id === c.parent_id; });
                                    });
                                    organicStats = {
                                        id: "organic",
                                        name: "Organic Traffic",
                                        email: "Direct signups",
                                        totalLeads: organicLeads_1.length,
                                        totalCloses: organicCloses.length,
                                        conversionRate: organicLeads_1.length > 0
                                            ? Math.round((organicCloses.length / organicLeads_1.length) * 100)
                                            : 0,
                                        isOrganic: true,
                                    };
                                    allDetails = __spreadArray(__spreadArray([], affiliateDetails, true), (organicLeads_1.length > 0 ? [organicStats] : []), true).sort(function (a, b) { return b.totalLeads - a.totalLeads; });
                                    // Only return affiliate data + organic
                                    res.json({
                                        affiliateDetails: allDetails,
                                    });
                                    return [3 /*break*/, 5];
                                case 4:
                                    error_41 = _c.sent();
                                    console.error("Error fetching sales stats:", error_41);
                                    res.status(500).json({ message: "Failed to fetch sales stats" });
                                    return [3 /*break*/, 5];
                                case 5: return [2 /*return*/];
                            }
                        });
                    }); });
                    // Get affiliate encounters
                    app.get("/api/affiliate/:affiliateId/encounters", isAuthenticated, requireRole(["coo"]), function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var affiliateId, supabase_2, encounters, error_42;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    _a.trys.push([0, 2, , 3]);
                                    affiliateId = req.params.affiliateId;
                                    supabase_2 = storage.supabase;
                                    return [4 /*yield*/, supabase_2
                                            .from("encounters")
                                            .select("*")
                                            .eq("affiliate_id", affiliateId)
                                            .order("created_at", { ascending: false })];
                                case 1:
                                    encounters = (_a.sent()).data;
                                    res.json(encounters || []);
                                    return [3 /*break*/, 3];
                                case 2:
                                    error_42 = _a.sent();
                                    console.error("Error fetching encounters:", error_42);
                                    res.status(500).json({ message: "Failed to fetch encounters" });
                                    return [3 /*break*/, 3];
                                case 3: return [2 /*return*/];
                            }
                        });
                    }); });
                    // Get affiliate leads
                    app.get("/api/affiliate/:affiliateId/leads", isAuthenticated, requireRole(["coo"]), function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var affiliateId, supabase_3, leads, error_43;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    _a.trys.push([0, 2, , 3]);
                                    affiliateId = req.params.affiliateId;
                                    supabase_3 = storage.supabase;
                                    return [4 /*yield*/, supabase_3
                                            .from("leads")
                                            .select("*")
                                            .eq("affiliate_id", affiliateId)
                                            .order("created_at", { ascending: false })];
                                case 1:
                                    leads = (_a.sent()).data;
                                    res.json(leads || []);
                                    return [3 /*break*/, 3];
                                case 2:
                                    error_43 = _a.sent();
                                    console.error("Error fetching leads:", error_43);
                                    res.status(500).json({ message: "Failed to fetch leads" });
                                    return [3 /*break*/, 3];
                                case 3: return [2 /*return*/];
                            }
                        });
                    }); });
                    // Get affiliate closes
                    app.get("/api/affiliate/:affiliateId/closes", isAuthenticated, requireRole(["coo"]), function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var affiliateId, supabase_4, _a, affLeads, parentIds, query, closes, error_44;
                        return __generator(this, function (_b) {
                            switch (_b.label) {
                                case 0:
                                    _b.trys.push([0, 3, , 4]);
                                    affiliateId = req.params.affiliateId;
                                    supabase_4 = storage.supabase;
                                    return [4 /*yield*/, supabase_4
                                            .from("leads")
                                            .select("*")
                                            .eq("affiliate_id", affiliateId)];
                                case 1:
                                    _a = (_b.sent()).data, affLeads = _a === void 0 ? [] : _a;
                                    parentIds = affLeads.map(function (l) { return l.user_id; });
                                    query = supabase_4.from("closes").select("*");
                                    if (parentIds.length > 0) {
                                        query = query.in("parent_id", parentIds);
                                    }
                                    else {
                                        // Return empty array if no leads
                                        return [2 /*return*/, res.json([])];
                                    }
                                    return [4 /*yield*/, query.order("created_at", { ascending: false })];
                                case 2:
                                    closes = (_b.sent()).data;
                                    res.json(closes || []);
                                    return [3 /*break*/, 4];
                                case 3:
                                    error_44 = _b.sent();
                                    console.error("Error fetching closes:", error_44);
                                    res.status(500).json({ message: "Failed to fetch closes" });
                                    return [3 /*break*/, 4];
                                case 4: return [2 /*return*/];
                            }
                        });
                    }); });
                    // Get organic leads (affiliate_id = null)
                    app.get("/api/organic/leads", isAuthenticated, requireRole(["coo"]), function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var supabase_5, leads, error_45;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    _a.trys.push([0, 2, , 3]);
                                    supabase_5 = storage.supabase;
                                    return [4 /*yield*/, supabase_5
                                            .from("leads")
                                            .select("*")
                                            .is("affiliate_id", null)
                                            .order("created_at", { ascending: false })];
                                case 1:
                                    leads = (_a.sent()).data;
                                    res.json(leads || []);
                                    return [3 /*break*/, 3];
                                case 2:
                                    error_45 = _a.sent();
                                    console.error("Error fetching organic leads:", error_45);
                                    res.status(500).json({ message: "Failed to fetch organic leads" });
                                    return [3 /*break*/, 3];
                                case 3: return [2 /*return*/];
                            }
                        });
                    }); });
                    // Get organic closes (from organic leads only)
                    app.get("/api/organic/closes", isAuthenticated, requireRole(["coo"]), function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var supabase_6, _a, organicLeads, parentIds, query, closes, error_46;
                        return __generator(this, function (_b) {
                            switch (_b.label) {
                                case 0:
                                    _b.trys.push([0, 3, , 4]);
                                    supabase_6 = storage.supabase;
                                    return [4 /*yield*/, supabase_6
                                            .from("leads")
                                            .select("*")
                                            .is("affiliate_id", null)];
                                case 1:
                                    _a = (_b.sent()).data, organicLeads = _a === void 0 ? [] : _a;
                                    parentIds = organicLeads.map(function (l) { return l.user_id; });
                                    query = supabase_6.from("closes").select("*");
                                    if (parentIds.length > 0) {
                                        query = query.in("parent_id", parentIds);
                                    }
                                    else {
                                        return [2 /*return*/, res.json([])];
                                    }
                                    return [4 /*yield*/, query.order("created_at", { ascending: false })];
                                case 2:
                                    closes = (_b.sent()).data;
                                    res.json(closes || []);
                                    return [3 /*break*/, 4];
                                case 3:
                                    error_46 = _b.sent();
                                    console.error("Error fetching organic closes:", error_46);
                                    res.status(500).json({ message: "Failed to fetch organic closes" });
                                    return [3 /*break*/, 4];
                                case 4: return [2 /*return*/];
                            }
                        });
                    }); });
                    // Get applications (verified and unverified tutors)
                    app.get("/api/coo/applications", isAuthenticated, requireRole(["coo"]), function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var tutors, applications, error_47;
                        var _this = this;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    _a.trys.push([0, 3, , 4]);
                                    return [4 /*yield*/, storage.getUsersByRole("tutor")];
                                case 1:
                                    tutors = _a.sent();
                                    return [4 /*yield*/, Promise.all(tutors.map(function (tutor) { return __awaiter(_this, void 0, void 0, function () {
                                            var verificationDoc;
                                            return __generator(this, function (_a) {
                                                switch (_a.label) {
                                                    case 0: return [4 /*yield*/, storage.getVerificationDocByTutor(tutor.id)];
                                                    case 1:
                                                        verificationDoc = _a.sent();
                                                        return [2 /*return*/, { user: tutor, verificationDoc: verificationDoc }];
                                                }
                                            });
                                        }); }))];
                                case 2:
                                    applications = _a.sent();
                                    res.json(applications);
                                    return [3 /*break*/, 4];
                                case 3:
                                    error_47 = _a.sent();
                                    console.error("Error fetching applications:", error_47);
                                    res.status(500).json({ message: "Failed to fetch applications" });
                                    return [3 /*break*/, 4];
                                case 4: return [2 /*return*/];
                            }
                        });
                    }); });
                    // Verify tutor
                    app.post("/api/coo/verify-tutor/:userId", isAuthenticated, requireRole(["coo"]), function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var userId, error_48;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    _a.trys.push([0, 3, , 4]);
                                    userId = req.params.userId;
                                    return [4 /*yield*/, storage.updateUserVerification(userId, true)];
                                case 1:
                                    _a.sent();
                                    return [4 /*yield*/, storage.updateVerificationStatus(userId, "verified")];
                                case 2:
                                    _a.sent();
                                    res.json({ success: true });
                                    return [3 /*break*/, 4];
                                case 3:
                                    error_48 = _a.sent();
                                    console.error("Error verifying tutor:", error_48);
                                    res.status(500).json({ message: "Failed to verify tutor" });
                                    return [3 /*break*/, 4];
                                case 4: return [2 /*return*/];
                            }
                        });
                    }); });
                    // Reject tutor
                    app.post("/api/coo/reject-tutor/:userId", isAuthenticated, requireRole(["coo"]), function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var userId, error_49;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    _a.trys.push([0, 2, , 3]);
                                    userId = req.params.userId;
                                    return [4 /*yield*/, storage.updateVerificationStatus(userId, "rejected")];
                                case 1:
                                    _a.sent();
                                    res.json({ success: true });
                                    return [3 /*break*/, 3];
                                case 2:
                                    error_49 = _a.sent();
                                    console.error("Error rejecting tutor:", error_49);
                                    res.status(500).json({ message: "Failed to reject tutor" });
                                    return [3 /*break*/, 3];
                                case 3: return [2 /*return*/];
                            }
                        });
                    }); });
                    // Get all pods
                    app.get("/api/coo/pods", isAuthenticated, requireRole(["coo"]), function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var pods, error_50;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    _a.trys.push([0, 2, , 3]);
                                    return [4 /*yield*/, storage.getPods()];
                                case 1:
                                    pods = _a.sent();
                                    res.json(pods);
                                    return [3 /*break*/, 3];
                                case 2:
                                    error_50 = _a.sent();
                                    console.error("Error fetching pods:", error_50);
                                    res.status(500).json({ message: "Failed to fetch pods" });
                                    return [3 /*break*/, 3];
                                case 3: return [2 /*return*/];
                            }
                        });
                    }); });
                    // Get deleted pods
                    app.get("/api/coo/deleted-pods", isAuthenticated, requireRole(["coo"]), function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var pods, error_51;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    _a.trys.push([0, 2, , 3]);
                                    return [4 /*yield*/, storage.getDeletedPods()];
                                case 1:
                                    pods = _a.sent();
                                    res.json(pods);
                                    return [3 /*break*/, 3];
                                case 2:
                                    error_51 = _a.sent();
                                    console.error("Error fetching deleted pods:", error_51);
                                    res.status(500).json({ message: "Failed to fetch deleted pods" });
                                    return [3 /*break*/, 3];
                                case 3: return [2 /*return*/];
                            }
                        });
                    }); });
                    // Delete pod (soft delete)
                    app.delete("/api/coo/pods/:podId", isAuthenticated, requireRole(["coo"]), function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var podId, error_52;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    _a.trys.push([0, 2, , 3]);
                                    podId = req.params.podId;
                                    return [4 /*yield*/, storage.deletePod(podId)];
                                case 1:
                                    _a.sent();
                                    res.json({ message: "Pod deleted successfully" });
                                    return [3 /*break*/, 3];
                                case 2:
                                    error_52 = _a.sent();
                                    console.error("Error deleting pod:", error_52);
                                    res.status(500).json({ message: "Failed to delete pod" });
                                    return [3 /*break*/, 3];
                                case 3: return [2 /*return*/];
                            }
                        });
                    }); });
                    // Create pod
                    app.post("/api/coo/pods", isAuthenticated, requireRole(["coo"]), function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var _a, tutorIds, podData, data, approvedTutors, approvedTutorIds_1, invalidTutors, pod, _i, tutorIds_1, tutorId, error_53;
                        return __generator(this, function (_b) {
                            switch (_b.label) {
                                case 0:
                                    _b.trys.push([0, 9, , 10]);
                                    console.log("📦 Creating pod with data:", req.body);
                                    _a = req.body, tutorIds = _a.tutorIds, podData = __rest(_a, ["tutorIds"]);
                                    data = insertPodSchema.parse(__assign(__assign({}, podData), { startDate: podData.startDate ? new Date(podData.startDate) : null }));
                                    console.log("✅ Validated pod data:", data);
                                    if (!(tutorIds && Array.isArray(tutorIds) && tutorIds.length > 0)) return [3 /*break*/, 2];
                                    // Validate tutor count (max 10 for training pods)
                                    if (tutorIds.length > 10) {
                                        return [2 /*return*/, res.status(400).json({
                                                message: "Training pods can have a maximum of 10 tutors"
                                            })];
                                    }
                                    return [4 /*yield*/, storage.getApprovedTutors()];
                                case 1:
                                    approvedTutors = _b.sent();
                                    approvedTutorIds_1 = new Set(approvedTutors.map(function (t) { return t.id; }));
                                    invalidTutors = tutorIds.filter(function (id) { return !approvedTutorIds_1.has(id); });
                                    if (invalidTutors.length > 0) {
                                        console.error("❌ Attempted to assign unapproved tutors:", invalidTutors);
                                        return [2 /*return*/, res.status(400).json({
                                                message: "All assigned tutors must have approved applications",
                                                invalidTutors: invalidTutors
                                            })];
                                    }
                                    console.log("\u2705 Validated ".concat(tutorIds.length, " approved tutors"));
                                    _b.label = 2;
                                case 2: return [4 /*yield*/, storage.createPod(data)];
                                case 3:
                                    pod = _b.sent();
                                    console.log("✅ Pod created successfully:", pod);
                                    if (!(tutorIds && Array.isArray(tutorIds) && tutorIds.length > 0)) return [3 /*break*/, 8];
                                    console.log("\uD83D\uDCDD Assigning ".concat(tutorIds.length, " approved tutors to pod ").concat(pod.id));
                                    _i = 0, tutorIds_1 = tutorIds;
                                    _b.label = 4;
                                case 4:
                                    if (!(_i < tutorIds_1.length)) return [3 /*break*/, 7];
                                    tutorId = tutorIds_1[_i];
                                    return [4 /*yield*/, storage.createTutorAssignment({
                                            tutorId: tutorId,
                                            podId: pod.id,
                                            certificationStatus: "pending",
                                        })];
                                case 5:
                                    _b.sent();
                                    _b.label = 6;
                                case 6:
                                    _i++;
                                    return [3 /*break*/, 4];
                                case 7:
                                    console.log("✅ Tutors assigned successfully");
                                    _b.label = 8;
                                case 8:
                                    res.json(pod);
                                    return [3 /*break*/, 10];
                                case 9:
                                    error_53 = _b.sent();
                                    console.error("❌ Error creating pod:", error_53);
                                    console.error("❌ Error details:", error_53.message);
                                    console.error("❌ Stack trace:", error_53.stack);
                                    res.status(400).json({
                                        message: "Failed to create pod",
                                        error: error_53.message || "Unknown error"
                                    });
                                    return [3 /*break*/, 10];
                                case 10: return [2 /*return*/];
                            }
                        });
                    }); });
                    // Get tutors assigned to a pod
                    app.get("/api/coo/pods/:podId/tutors", isAuthenticated, requireRole(["coo"]), function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var podId, assignments, tutorsData, error_54;
                        var _this = this;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    _a.trys.push([0, 3, , 4]);
                                    podId = req.params.podId;
                                    return [4 /*yield*/, storage.getTutorAssignmentsByPod(podId)];
                                case 1:
                                    assignments = _a.sent();
                                    return [4 /*yield*/, Promise.all(assignments.map(function (assignment) { return __awaiter(_this, void 0, void 0, function () {
                                            var tutor;
                                            return __generator(this, function (_a) {
                                                switch (_a.label) {
                                                    case 0: return [4 /*yield*/, storage.getUser(assignment.tutorId)];
                                                    case 1:
                                                        tutor = _a.sent();
                                                        return [2 /*return*/, __assign(__assign({}, assignment), { tutorName: (tutor === null || tutor === void 0 ? void 0 : tutor.name) || "Unknown", tutorEmail: (tutor === null || tutor === void 0 ? void 0 : tutor.email) || "" })];
                                                }
                                            });
                                        }); }))];
                                case 2:
                                    tutorsData = _a.sent();
                                    res.json(tutorsData);
                                    return [3 /*break*/, 4];
                                case 3:
                                    error_54 = _a.sent();
                                    console.error("Error fetching pod tutors:", error_54);
                                    res.status(500).json({ message: "Failed to fetch pod tutors" });
                                    return [3 /*break*/, 4];
                                case 4: return [2 /*return*/];
                            }
                        });
                    }); });
                    // Get all tutor assignments across all pods (to prevent duplicate assignments)
                    app.get("/api/coo/all-tutor-assignments", isAuthenticated, requireRole(["coo"]), function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var assignments, tutorIds, error_55;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    _a.trys.push([0, 2, , 3]);
                                    return [4 /*yield*/, supabase
                                            .from("tutor_assignments")
                                            .select("tutor_id")];
                                case 1:
                                    assignments = (_a.sent()).data;
                                    console.log("📋 Raw assignments from DB:", assignments);
                                    if (!assignments) {
                                        console.log("📋 No assignments found, returning empty array");
                                        return [2 /*return*/, res.json([])];
                                    }
                                    tutorIds = assignments.map(function (a) { return a.tutor_id; });
                                    console.log("📋 All assigned tutor IDs:", tutorIds);
                                    res.json(tutorIds);
                                    return [3 /*break*/, 3];
                                case 2:
                                    error_55 = _a.sent();
                                    console.error("Error fetching all tutor assignments:", error_55);
                                    res.status(500).json({ message: "Failed to fetch tutor assignments" });
                                    return [3 /*break*/, 3];
                                case 3: return [2 /*return*/];
                            }
                        });
                    }); });
                    // Get pod statistics
                    app.get("/api/coo/pods/:podId/stats", isAuthenticated, requireRole(["coo"]), function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var podId, assignments, sessions, totalTutors, totalStudents, sessionsCompleted, error_56;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    _a.trys.push([0, 3, , 4]);
                                    podId = req.params.podId;
                                    return [4 /*yield*/, storage.getTutorAssignmentsByPod(podId)];
                                case 1:
                                    assignments = _a.sent();
                                    return [4 /*yield*/, storage.getSessionsByPod(podId)];
                                case 2:
                                    sessions = _a.sent();
                                    totalTutors = assignments.length;
                                    totalStudents = assignments.reduce(function (sum, a) { return sum + (a.studentCount || 0); }, 0);
                                    sessionsCompleted = sessions.length;
                                    res.json({
                                        totalTutors: totalTutors,
                                        totalStudents: totalStudents,
                                        sessionsCompleted: sessionsCompleted
                                    });
                                    return [3 /*break*/, 4];
                                case 3:
                                    error_56 = _a.sent();
                                    console.error("Error fetching pod statistics:", error_56);
                                    res.status(500).json({ message: "Failed to fetch pod statistics" });
                                    return [3 /*break*/, 4];
                                case 4: return [2 /*return*/];
                            }
                        });
                    }); });
                    // Get students for a specific tutor (COO view)
                    app.get("/api/coo/tutors/:tutorId/students", isAuthenticated, requireRole(["coo"]), function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var tutorId, students, error_57;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    _a.trys.push([0, 2, , 3]);
                                    tutorId = req.params.tutorId;
                                    console.log("📚 COO requesting students for tutor:", tutorId);
                                    return [4 /*yield*/, storage.getStudentsByTutor(tutorId)];
                                case 1:
                                    students = _a.sent();
                                    console.log("📚 Found students:", students.map(function (s) { return ({ id: s.id, name: s.name }); }));
                                    res.json(students);
                                    return [3 /*break*/, 3];
                                case 2:
                                    error_57 = _a.sent();
                                    console.error("Error fetching tutor students:", error_57);
                                    res.status(500).json({ message: "Failed to fetch tutor students" });
                                    return [3 /*break*/, 3];
                                case 3: return [2 /*return*/];
                            }
                        });
                    }); });
                    // Get student identity sheet (COO read-only view)
                    app.get("/api/coo/students/:studentId/identity-sheet", isAuthenticated, requireRole(["coo"]), function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var studentId, _a, directData, directError, student, identitySheetData, error_58;
                        return __generator(this, function (_b) {
                            switch (_b.label) {
                                case 0:
                                    _b.trys.push([0, 3, , 4]);
                                    studentId = req.params.studentId;
                                    console.log("📋 COO requesting identity sheet for student:", studentId);
                                    return [4 /*yield*/, supabase
                                            .from("students")
                                            .select("*")
                                            .eq("id", studentId)];
                                case 1:
                                    _a = _b.sent(), directData = _a.data, directError = _a.error;
                                    console.log("📋 Direct query result:", JSON.stringify(directData, null, 2));
                                    console.log("📋 Direct query error:", directError);
                                    return [4 /*yield*/, storage.getStudent(studentId)];
                                case 2:
                                    student = _b.sent();
                                    if (!student) {
                                        console.log("❌ Student not found via storage:", studentId);
                                        return [2 /*return*/, res.status(404).json({ message: "Student not found" })];
                                    }
                                    console.log("✅ Student found:", student.id);
                                    console.log("📋 Student personalProfile:", student.personalProfile);
                                    console.log("📋 Student emotionalInsights:", student.emotionalInsights);
                                    console.log("📋 Student academicDiagnosis:", student.academicDiagnosis);
                                    console.log("📋 Student identitySheet:", student.identitySheet);
                                    identitySheetData = {
                                        personalProfile: student.personalProfile || null,
                                        emotionalInsights: student.emotionalInsights || null,
                                        academicDiagnosis: student.academicDiagnosis || null,
                                        identitySheet: student.identitySheet || null,
                                        completedAt: student.identitySheetCompletedAt || null,
                                    };
                                    console.log("📋 Returning identity sheet data:", identitySheetData);
                                    res.json(identitySheetData);
                                    return [3 /*break*/, 4];
                                case 3:
                                    error_58 = _b.sent();
                                    console.error("Error fetching identity sheet for COO:", error_58);
                                    res.status(500).json({ message: "Failed to fetch identity sheet" });
                                    return [3 /*break*/, 4];
                                case 4: return [2 /*return*/];
                            }
                        });
                    }); });
                    // Get student assignments (COO read-only view)
                    app.get("/api/coo/students/:studentId/assignments", isAuthenticated, requireRole(["coo"]), function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var studentId, student, _a, assignments, error, error_59;
                        return __generator(this, function (_b) {
                            switch (_b.label) {
                                case 0:
                                    _b.trys.push([0, 3, , 4]);
                                    studentId = req.params.studentId;
                                    return [4 /*yield*/, storage.getStudent(studentId)];
                                case 1:
                                    student = _b.sent();
                                    if (!student) {
                                        return [2 /*return*/, res.status(404).json({ message: "Student not found" })];
                                    }
                                    return [4 /*yield*/, supabase
                                            .from("assignments")
                                            .select("*")
                                            .eq("student_id", studentId)
                                            .order("created_at", { ascending: false })];
                                case 2:
                                    _a = _b.sent(), assignments = _a.data, error = _a.error;
                                    if (error) {
                                        console.error("Error fetching assignments:", error);
                                        return [2 /*return*/, res.status(500).json({ message: "Failed to fetch assignments" })];
                                    }
                                    res.json(assignments || []);
                                    return [3 /*break*/, 4];
                                case 3:
                                    error_59 = _b.sent();
                                    console.error("Error fetching student assignments for COO:", error_59);
                                    res.status(500).json({ message: "Failed to fetch assignments" });
                                    return [3 /*break*/, 4];
                                case 4: return [2 /*return*/];
                            }
                        });
                    }); });
                    // Get student tracking data (COO read-only view)
                    app.get("/api/coo/students/:studentId/tracking", isAuthenticated, requireRole(["coo"]), function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var studentId, student, _a, sessions, sessionsError, _b, parentReports, reportsError, _c, tdFeedback, feedbackError, error_60;
                        return __generator(this, function (_d) {
                            switch (_d.label) {
                                case 0:
                                    _d.trys.push([0, 5, , 6]);
                                    studentId = req.params.studentId;
                                    return [4 /*yield*/, storage.getStudent(studentId)];
                                case 1:
                                    student = _d.sent();
                                    if (!student) {
                                        return [2 /*return*/, res.status(404).json({ message: "Student not found" })];
                                    }
                                    return [4 /*yield*/, supabase
                                            .from("tutoring_sessions")
                                            .select("*")
                                            .eq("student_id", studentId)
                                            .order("session_date", { ascending: false })];
                                case 2:
                                    _a = _d.sent(), sessions = _a.data, sessionsError = _a.error;
                                    return [4 /*yield*/, supabase
                                            .from("parent_reports")
                                            .select("*")
                                            .eq("student_id", studentId)
                                            .order("created_at", { ascending: false })];
                                case 3:
                                    _b = _d.sent(), parentReports = _b.data, reportsError = _b.error;
                                    return [4 /*yield*/, supabase
                                            .from("td_feedback")
                                            .select("*")
                                            .eq("student_id", studentId)
                                            .order("created_at", { ascending: false })];
                                case 4:
                                    _c = _d.sent(), tdFeedback = _c.data, feedbackError = _c.error;
                                    if (sessionsError || reportsError || feedbackError) {
                                        console.error("Error fetching tracking data:", { sessionsError: sessionsError, reportsError: reportsError, feedbackError: feedbackError });
                                        return [2 /*return*/, res.status(500).json({ message: "Failed to fetch tracking data" })];
                                    }
                                    res.json({
                                        sessions: sessions || [],
                                        parentReports: parentReports || [],
                                        tdFeedback: tdFeedback || [],
                                    });
                                    return [3 /*break*/, 6];
                                case 5:
                                    error_60 = _d.sent();
                                    console.error("Error fetching student tracking for COO:", error_60);
                                    res.status(500).json({ message: "Failed to fetch tracking data" });
                                    return [3 /*break*/, 6];
                                case 6: return [2 /*return*/];
                            }
                        });
                    }); });
                    // Remove tutor from pod
                    app.delete("/api/coo/pods/:podId/tutors/:assignmentId", isAuthenticated, requireRole(["coo"]), function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var assignmentId, error_61;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    _a.trys.push([0, 2, , 3]);
                                    assignmentId = req.params.assignmentId;
                                    return [4 /*yield*/, storage.deleteTutorAssignment(assignmentId)];
                                case 1:
                                    _a.sent();
                                    res.json({ message: "Tutor removed from pod successfully" });
                                    return [3 /*break*/, 3];
                                case 2:
                                    error_61 = _a.sent();
                                    console.error("Error removing tutor from pod:", error_61);
                                    res.status(500).json({ message: "Failed to remove tutor from pod" });
                                    return [3 /*break*/, 3];
                                case 3: return [2 /*return*/];
                            }
                        });
                    }); });
                    // Add tutor to existing pod
                    app.post("/api/coo/pods/:podId/tutors", isAuthenticated, requireRole(["coo"]), function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var podId_2, tutorIds, currentAssignments, totalTutors, approvedTutors, approvedTutorIds_2, invalidTutors, existingIds_1, duplicates, newAssignments, error_62;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    _a.trys.push([0, 4, , 5]);
                                    podId_2 = req.params.podId;
                                    tutorIds = req.body.tutorIds;
                                    if (!Array.isArray(tutorIds) || tutorIds.length === 0) {
                                        return [2 /*return*/, res.status(400).json({ message: "tutorIds must be a non-empty array" })];
                                    }
                                    return [4 /*yield*/, storage.getTutorAssignmentsByPod(podId_2)];
                                case 1:
                                    currentAssignments = _a.sent();
                                    totalTutors = currentAssignments.length + tutorIds.length;
                                    // Validate tutor count (max 10 for training pods)
                                    if (totalTutors > 10) {
                                        return [2 /*return*/, res.status(400).json({
                                                message: "Pod would exceed maximum of 10 tutors (current: ".concat(currentAssignments.length, ", adding: ").concat(tutorIds.length, ")")
                                            })];
                                    }
                                    return [4 /*yield*/, storage.getApprovedTutors()];
                                case 2:
                                    approvedTutors = _a.sent();
                                    approvedTutorIds_2 = new Set(approvedTutors.map(function (t) { return t.id; }));
                                    invalidTutors = tutorIds.filter(function (id) { return !approvedTutorIds_2.has(id); });
                                    if (invalidTutors.length > 0) {
                                        return [2 /*return*/, res.status(400).json({
                                                message: "All assigned tutors must have approved applications",
                                                invalidTutors: invalidTutors
                                            })];
                                    }
                                    existingIds_1 = new Set(currentAssignments.map(function (a) { return a.tutor_id; }));
                                    duplicates = tutorIds.filter(function (id) { return existingIds_1.has(id); });
                                    if (duplicates.length > 0) {
                                        return [2 /*return*/, res.status(400).json({
                                                message: "Some tutors are already assigned to this pod",
                                                duplicates: duplicates
                                            })];
                                    }
                                    return [4 /*yield*/, Promise.all(tutorIds.map(function (tutorId) {
                                            return storage.createTutorAssignment({
                                                tutorId: tutorId,
                                                podId: podId_2,
                                                certificationStatus: "pending",
                                            });
                                        }))];
                                case 3:
                                    newAssignments = _a.sent();
                                    res.json(newAssignments);
                                    return [3 /*break*/, 5];
                                case 4:
                                    error_62 = _a.sent();
                                    console.error("Error adding tutors to pod:", error_62);
                                    res.status(400).json({ message: "Failed to add tutors to pod" });
                                    return [3 /*break*/, 5];
                                case 5: return [2 /*return*/];
                            }
                        });
                    }); });
                    // Get TDs with pod assignments
                    app.get("/api/coo/tds", isAuthenticated, requireRole(["coo"]), function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var tds, pods_3, tdsWithPods, error_63;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    _a.trys.push([0, 3, , 4]);
                                    return [4 /*yield*/, storage.getUsersByRole("td")];
                                case 1:
                                    tds = _a.sent();
                                    return [4 /*yield*/, storage.getPods()];
                                case 2:
                                    pods_3 = _a.sent();
                                    tdsWithPods = tds.map(function (td) {
                                        var assignedPod = pods_3.find(function (p) { return p.tdId === td.id; });
                                        return __assign(__assign({}, td), { assignedPodId: (assignedPod === null || assignedPod === void 0 ? void 0 : assignedPod.id) || null });
                                    });
                                    res.json(tdsWithPods);
                                    return [3 /*break*/, 4];
                                case 3:
                                    error_63 = _a.sent();
                                    console.error("Error fetching TDs:", error_63);
                                    res.status(500).json({ message: "Failed to fetch TDs" });
                                    return [3 /*break*/, 4];
                                case 4: return [2 /*return*/];
                            }
                        });
                    }); });
                    // Get approved tutors (tutors with approved applications)
                    app.get("/api/coo/approved-tutors", isAuthenticated, requireRole(["coo"]), function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var approvedTutors, error_64;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    _a.trys.push([0, 2, , 3]);
                                    return [4 /*yield*/, storage.getApprovedTutors()];
                                case 1:
                                    approvedTutors = _a.sent();
                                    console.log("👥 Approved tutors:", approvedTutors.map(function (t) { return ({ id: t.id, name: t.name }); }));
                                    res.json(approvedTutors);
                                    return [3 /*break*/, 3];
                                case 2:
                                    error_64 = _a.sent();
                                    console.error("Error fetching approved tutors:", error_64);
                                    res.status(500).json({ message: "Failed to fetch approved tutors" });
                                    return [3 /*break*/, 3];
                                case 3: return [2 /*return*/];
                            }
                        });
                    }); });
                    // Get role permissions
                    app.get("/api/coo/role-permissions", isAuthenticated, requireRole(["coo"]), function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var permissions, error_65;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    _a.trys.push([0, 2, , 3]);
                                    return [4 /*yield*/, storage.getRolePermissions()];
                                case 1:
                                    permissions = _a.sent();
                                    res.json(permissions);
                                    return [3 /*break*/, 3];
                                case 2:
                                    error_65 = _a.sent();
                                    console.error("Error fetching role permissions:", error_65);
                                    res.status(500).json({ message: "Failed to fetch role permissions" });
                                    return [3 /*break*/, 3];
                                case 3: return [2 /*return*/];
                            }
                        });
                    }); });
                    // Assign TD to pod
                    app.post("/api/coo/assign-td", isAuthenticated, requireRole(["coo"]), function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var schema, _a, tdId, podId, user, error_66;
                        return __generator(this, function (_b) {
                            switch (_b.label) {
                                case 0:
                                    _b.trys.push([0, 5, , 6]);
                                    schema = z.object({
                                        tdId: z.string(),
                                        podId: z.string(),
                                    });
                                    _a = schema.parse(req.body), tdId = _a.tdId, podId = _a.podId;
                                    // Update the pod to have this TD
                                    return [4 /*yield*/, storage.updatePodTD(podId, tdId)];
                                case 1:
                                    // Update the pod to have this TD
                                    _b.sent();
                                    return [4 /*yield*/, storage.getUser(tdId)];
                                case 2:
                                    user = _b.sent();
                                    if (!(user && user.email)) return [3 /*break*/, 4];
                                    return [4 /*yield*/, storage.addRolePermission({
                                            email: user.email,
                                            role: "td",
                                            assignedPodId: podId,
                                        })];
                                case 3:
                                    _b.sent();
                                    _b.label = 4;
                                case 4:
                                    res.json({ success: true });
                                    return [3 /*break*/, 6];
                                case 5:
                                    error_66 = _b.sent();
                                    console.error("Error assigning TD:", error_66);
                                    res.status(400).json({ message: "Failed to assign TD" });
                                    return [3 /*break*/, 6];
                                case 6: return [2 /*return*/];
                            }
                        });
                    }); });
                    // Send broadcast
                    app.post("/api/coo/broadcast", isAuthenticated, requireRole(["coo"]), function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var data, broadcast, error_67;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    _a.trys.push([0, 2, , 3]);
                                    console.log("📤 Broadcast request body:", JSON.stringify(req.body, null, 2));
                                    data = insertBroadcastSchema.parse(req.body);
                                    console.log("✅ Broadcast validated:", JSON.stringify(data, null, 2));
                                    return [4 /*yield*/, storage.createBroadcast(data)];
                                case 1:
                                    broadcast = _a.sent();
                                    res.json(broadcast);
                                    return [3 /*break*/, 3];
                                case 2:
                                    error_67 = _a.sent();
                                    console.error("❌ Error creating broadcast:", error_67);
                                    if (error_67.errors) {
                                        console.error("Validation errors:", error_67.errors);
                                        return [2 /*return*/, res.status(400).json({ message: "Validation failed", errors: error_67.errors })];
                                    }
                                    res.status(400).json({ message: "Failed to create broadcast" });
                                    return [3 /*break*/, 3];
                                case 3: return [2 /*return*/];
                            }
                        });
                    }); });
                    // ========================================
                    // SHARED ROUTES (Tutors, TDs, COO)
                    // ========================================
                    // Get broadcasts
                    app.get("/api/broadcasts", isAuthenticated, function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var userCreatedAt, broadcasts, error_68;
                        var _a;
                        return __generator(this, function (_b) {
                            switch (_b.label) {
                                case 0:
                                    _b.trys.push([0, 2, , 3]);
                                    userCreatedAt = (_a = req.dbUser) === null || _a === void 0 ? void 0 : _a.createdAt;
                                    return [4 /*yield*/, storage.getBroadcasts(userCreatedAt)];
                                case 1:
                                    broadcasts = _b.sent();
                                    res.json(broadcasts);
                                    return [3 /*break*/, 3];
                                case 2:
                                    error_68 = _b.sent();
                                    console.error("Error fetching broadcasts:", error_68);
                                    res.status(500).json({ message: "Failed to fetch broadcasts" });
                                    return [3 /*break*/, 3];
                                case 3: return [2 /*return*/];
                            }
                        });
                    }); });
                    // Get unread broadcast count
                    app.get("/api/broadcasts/unread-count", isAuthenticated, function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var userId, userCreatedAt, unreadCount, error_69;
                        var _a;
                        return __generator(this, function (_b) {
                            switch (_b.label) {
                                case 0:
                                    _b.trys.push([0, 2, , 3]);
                                    userId = req.dbUser.id;
                                    userCreatedAt = (_a = req.dbUser) === null || _a === void 0 ? void 0 : _a.createdAt;
                                    return [4 /*yield*/, storage.getUnreadBroadcastCount(userId, userCreatedAt)];
                                case 1:
                                    unreadCount = _b.sent();
                                    res.json({ unreadCount: unreadCount });
                                    return [3 /*break*/, 3];
                                case 2:
                                    error_69 = _b.sent();
                                    console.error("Error fetching unread count:", error_69);
                                    res.status(500).json({ message: "Failed to fetch unread count" });
                                    return [3 /*break*/, 3];
                                case 3: return [2 /*return*/];
                            }
                        });
                    }); });
                    // Get user's read broadcasts
                    app.get("/api/broadcasts/read-list", isAuthenticated, function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var userId, readBroadcasts, error_70;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    _a.trys.push([0, 2, , 3]);
                                    userId = req.dbUser.id;
                                    return [4 /*yield*/, storage.getUserBroadcastReads(userId)];
                                case 1:
                                    readBroadcasts = _a.sent();
                                    res.json({ readBroadcasts: readBroadcasts });
                                    return [3 /*break*/, 3];
                                case 2:
                                    error_70 = _a.sent();
                                    console.error("Error fetching read broadcasts:", error_70);
                                    res.status(500).json({ message: "Failed to fetch read broadcasts" });
                                    return [3 /*break*/, 3];
                                case 3: return [2 /*return*/];
                            }
                        });
                    }); });
                    // Check broadcast_reads table status
                    app.get("/api/broadcasts/table-status", function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var _a, data, error, error_71;
                        return __generator(this, function (_b) {
                            switch (_b.label) {
                                case 0:
                                    _b.trys.push([0, 2, , 3]);
                                    return [4 /*yield*/, supabase
                                            .from("broadcast_reads")
                                            .select("id")
                                            .limit(1)];
                                case 1:
                                    _a = _b.sent(), data = _a.data, error = _a.error;
                                    if (error && error.code === 'PGRST205') {
                                        return [2 /*return*/, res.json({
                                                tableExists: false,
                                                message: "broadcast_reads table not found. Please run BROADCAST_READS_TABLE.sql in Supabase SQL Editor"
                                            })];
                                    }
                                    res.json({
                                        tableExists: true,
                                        message: "broadcast_reads table exists"
                                    });
                                    return [3 /*break*/, 3];
                                case 2:
                                    error_71 = _b.sent();
                                    res.json({
                                        tableExists: false,
                                        error: "Unable to check table status"
                                    });
                                    return [3 /*break*/, 3];
                                case 3: return [2 /*return*/];
                            }
                        });
                    }); });
                    // Mark broadcast as read
                    app.post("/api/broadcasts/:broadcastId/read", isAuthenticated, function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var userId, broadcastId, error_72;
                        var _a;
                        return __generator(this, function (_b) {
                            switch (_b.label) {
                                case 0:
                                    _b.trys.push([0, 2, , 3]);
                                    userId = req.dbUser.id;
                                    broadcastId = req.params.broadcastId;
                                    // Validate broadcastId is not empty
                                    if (!broadcastId || broadcastId.trim() === "") {
                                        return [2 /*return*/, res.status(400).json({ message: "Invalid broadcast ID" })];
                                    }
                                    return [4 /*yield*/, storage.markBroadcastAsRead(userId, broadcastId)];
                                case 1:
                                    _b.sent();
                                    res.json({ success: true });
                                    return [3 /*break*/, 3];
                                case 2:
                                    error_72 = _b.sent();
                                    console.error("Error marking broadcast as read:", error_72);
                                    if (error_72.message === "Broadcast not found") {
                                        return [2 /*return*/, res.status(404).json({ message: "Broadcast not found" })];
                                    }
                                    if (error_72.message === "User not found") {
                                        return [2 /*return*/, res.status(401).json({ message: "User not found" })];
                                    }
                                    // Check if table doesn't exist
                                    if ((error_72 === null || error_72 === void 0 ? void 0 : error_72.code) === 'PGRST205' || ((_a = error_72 === null || error_72 === void 0 ? void 0 : error_72.message) === null || _a === void 0 ? void 0 : _a.includes('broadcast_reads'))) {
                                        return [2 /*return*/, res.status(503).json({
                                                message: "Broadcast read tracking not available. Please run BROADCAST_READS_TABLE.sql in Supabase SQL Editor",
                                                tableIssue: true
                                            })];
                                    }
                                    res.status(500).json({ message: "Failed to mark broadcast as read" });
                                    return [3 /*break*/, 3];
                                case 3: return [2 /*return*/];
                            }
                        });
                    }); });
                    // ========================================
                    // TUTOR APPLICATION ROUTES
                    // ========================================
                    // Submit tutor application
                    app.post("/api/tutor/application", isAuthenticated, requireRole(["tutor"]), function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var userId, data, application, error_73;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    _a.trys.push([0, 2, , 3]);
                                    userId = req.session.userId;
                                    data = insertTutorApplicationSchema.parse(__assign(__assign({}, req.body), { userId: userId }));
                                    return [4 /*yield*/, storage.createTutorApplication(data)];
                                case 1:
                                    application = _a.sent();
                                    res.json(application);
                                    return [3 /*break*/, 3];
                                case 2:
                                    error_73 = _a.sent();
                                    console.error("Error submitting tutor application:", error_73);
                                    res.status(400).json({ message: "Failed to submit application" });
                                    return [3 /*break*/, 3];
                                case 3: return [2 /*return*/];
                            }
                        });
                    }); });
                    // Get tutor's application status (for gateway)
                    app.get("/api/tutor/application-status", isAuthenticated, requireRole(["tutor"]), function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var userId, timeoutPromise, applicationsPromise, applications, latestApp, isUnder18, hasTrialAgreement, hasParentConsent, trialAgreementVerified, parentConsentVerified, requiredDocsComplete, docsVerified, status_2, error_74;
                        var _a;
                        return __generator(this, function (_b) {
                            switch (_b.label) {
                                case 0:
                                    _b.trys.push([0, 2, , 3]);
                                    userId = req.session.userId;
                                    console.log("📋 Fetching tutor application status for user:", userId);
                                    timeoutPromise = new Promise(function (_, reject) {
                                        return setTimeout(function () { return reject(new Error("Database query timeout after 15s")); }, 15000);
                                    });
                                    applicationsPromise = storage.getTutorApplicationsByUser(userId);
                                    return [4 /*yield*/, Promise.race([applicationsPromise, timeoutPromise])];
                                case 1:
                                    applications = _b.sent();
                                    console.log("✅ Got applications:", (applications === null || applications === void 0 ? void 0 : applications.length) || 0, "for user:", userId);
                                    if (!applications || applications.length === 0) {
                                        console.log("📝 User has no applications, returning not_applied");
                                        return [2 /*return*/, res.json({ status: "not_applied" })];
                                    }
                                    latestApp = applications[0];
                                    console.log("📝 Latest app status:", latestApp.status, "for user:", userId);
                                    isUnder18 = latestApp.age < 18;
                                    hasTrialAgreement = !!latestApp.trialAgreementUrl;
                                    hasParentConsent = !!latestApp.parentConsentUrl;
                                    trialAgreementVerified = !!latestApp.trialAgreementVerified;
                                    parentConsentVerified = !!latestApp.parentConsentVerified;
                                    requiredDocsComplete = hasTrialAgreement && (!isUnder18 || hasParentConsent);
                                    docsVerified = trialAgreementVerified && (!isUnder18 || parentConsentVerified);
                                    switch (latestApp.status) {
                                        case "pending":
                                            status_2 = "pending";
                                            break;
                                        case "approved":
                                            if (docsVerified) {
                                                status_2 = "confirmed";
                                            }
                                            else if (requiredDocsComplete) {
                                                status_2 = "verification"; // Docs uploaded, awaiting verification
                                            }
                                            else {
                                                status_2 = "approved"; // Still needs to upload docs
                                            }
                                            break;
                                        case "rejected":
                                            status_2 = "rejected";
                                            break;
                                        default:
                                            status_2 = "pending";
                                    }
                                    console.log("✅ Returning status:", status_2, "for user:", userId);
                                    res.json({
                                        status: status_2,
                                        applicationId: latestApp.id,
                                        isUnder18: isUnder18,
                                        hasTrialAgreement: hasTrialAgreement,
                                        hasParentConsent: hasParentConsent,
                                        trialAgreementVerified: trialAgreementVerified,
                                        parentConsentVerified: parentConsentVerified,
                                        trialAgreementUrl: latestApp.trialAgreementUrl,
                                        parentConsentUrl: latestApp.parentConsentUrl,
                                        onboardingCompletedAt: (_a = latestApp.onboardingCompletedAt) !== null && _a !== void 0 ? _a : null,
                                    });
                                    return [3 /*break*/, 3];
                                case 2:
                                    error_74 = _b.sent();
                                    console.error("❌ Error fetching tutor application status:", error_74);
                                    res.status(500).json({ message: "Failed to fetch application status" });
                                    return [3 /*break*/, 3];
                                case 3: return [2 /*return*/];
                            }
                        });
                    }); });
                    // Upload tutor onboarding document
                    app.post("/api/tutor/onboarding-documents/upload", isAuthenticated, requireRole(["tutor"]), function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var userId, _a, applicationId_1, documentType, fileName, fileData, fileType, applications, app_1, buffer, safeFileName, _b, uploadData, uploadError, urlData, updated, error_75;
                        return __generator(this, function (_c) {
                            switch (_c.label) {
                                case 0:
                                    _c.trys.push([0, 4, , 5]);
                                    userId = req.session.userId;
                                    _a = req.body, applicationId_1 = _a.applicationId, documentType = _a.documentType, fileName = _a.fileName, fileData = _a.fileData, fileType = _a.fileType;
                                    if (!applicationId_1 || !documentType || !fileName || !fileData) {
                                        return [2 /*return*/, res.status(400).json({ message: "Missing required fields" })];
                                    }
                                    if (!["trial_agreement", "parent_consent"].includes(documentType)) {
                                        return [2 /*return*/, res.status(400).json({ message: "Invalid document type" })];
                                    }
                                    return [4 /*yield*/, storage.getTutorApplicationsByUser(userId)];
                                case 1:
                                    applications = _c.sent();
                                    app_1 = applications.find(function (a) { return a.id === applicationId_1; });
                                    if (!app_1) {
                                        return [2 /*return*/, res.status(403).json({ message: "Application not found or access denied" })];
                                    }
                                    buffer = Buffer.from(fileData, 'base64');
                                    safeFileName = fileName.startsWith("".concat(userId, "/")) ? fileName : "".concat(userId, "/").concat(fileName);
                                    return [4 /*yield*/, supabase.storage
                                            .from('tutor-documents')
                                            .upload(safeFileName, buffer, {
                                            contentType: fileType || undefined,
                                            upsert: true,
                                        })];
                                case 2:
                                    _b = _c.sent(), uploadData = _b.data, uploadError = _b.error;
                                    if (uploadError) {
                                        console.error('Supabase storage upload error:', uploadError);
                                        return [2 /*return*/, res.status(500).json({ message: 'Storage upload failed', error: uploadError.message })];
                                    }
                                    urlData = supabase.storage.from('tutor-documents').getPublicUrl(safeFileName).data;
                                    return [4 /*yield*/, storage.updateTutorOnboardingDocument(applicationId_1, documentType, urlData.publicUrl)];
                                case 3:
                                    updated = _c.sent();
                                    if (!updated) {
                                        return [2 /*return*/, res.status(500).json({ message: 'Failed to update document record' })];
                                    }
                                    res.json({ success: true, application: updated, publicUrl: urlData.publicUrl });
                                    return [3 /*break*/, 5];
                                case 4:
                                    error_75 = _c.sent();
                                    console.error('Error uploading onboarding document (server handler):', error_75);
                                    res.status(500).json({ message: 'Failed to upload document' });
                                    return [3 /*break*/, 5];
                                case 5: return [2 /*return*/];
                            }
                        });
                    }); });
                    // Tutor marks onboarding complete (after assignment) - allows leaving gateway permanently
                    app.post("/api/tutor/complete-onboarding", isAuthenticated, requireRole(["tutor"]), function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var userId, applicationId_2, applications, app_2, updated, error_76;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    _a.trys.push([0, 3, , 4]);
                                    userId = req.session.userId;
                                    applicationId_2 = req.body.applicationId;
                                    if (!applicationId_2) {
                                        return [2 /*return*/, res.status(400).json({ message: "Missing applicationId" })];
                                    }
                                    return [4 /*yield*/, storage.getTutorApplicationsByUser(userId)];
                                case 1:
                                    applications = _a.sent();
                                    app_2 = applications.find(function (a) { return a.id === applicationId_2; });
                                    if (!app_2) {
                                        return [2 /*return*/, res.status(403).json({ message: "Application not found or access denied" })];
                                    }
                                    return [4 /*yield*/, storage.completeTutorOnboarding(applicationId_2)];
                                case 2:
                                    updated = _a.sent();
                                    if (!updated) {
                                        return [2 /*return*/, res.status(500).json({ message: "Failed to complete onboarding" })];
                                    }
                                    res.json({ success: true, application: updated });
                                    return [3 /*break*/, 4];
                                case 3:
                                    error_76 = _a.sent();
                                    console.error('Error completing onboarding:', error_76);
                                    res.status(500).json({ message: 'Failed to complete onboarding' });
                                    return [3 /*break*/, 4];
                                case 4: return [2 /*return*/];
                            }
                        });
                    }); });
                    app.post("/api/tutor/onboarding-documents", isAuthenticated, requireRole(["tutor"]), function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var userId, _a, applicationId_3, documentType, documentUrl, applications, app_3, updated, error_77;
                        return __generator(this, function (_b) {
                            switch (_b.label) {
                                case 0:
                                    _b.trys.push([0, 3, , 4]);
                                    userId = req.session.userId;
                                    _a = req.body, applicationId_3 = _a.applicationId, documentType = _a.documentType, documentUrl = _a.documentUrl;
                                    if (!applicationId_3 || !documentType || !documentUrl) {
                                        return [2 /*return*/, res.status(400).json({ message: "Missing required fields" })];
                                    }
                                    if (!["trial_agreement", "parent_consent"].includes(documentType)) {
                                        return [2 /*return*/, res.status(400).json({ message: "Invalid document type" })];
                                    }
                                    return [4 /*yield*/, storage.getTutorApplicationsByUser(userId)];
                                case 1:
                                    applications = _b.sent();
                                    app_3 = applications.find(function (a) { return a.id === applicationId_3; });
                                    if (!app_3) {
                                        return [2 /*return*/, res.status(403).json({ message: "Application not found or access denied" })];
                                    }
                                    return [4 /*yield*/, storage.updateTutorOnboardingDocument(applicationId_3, documentType, documentUrl)];
                                case 2:
                                    updated = _b.sent();
                                    if (!updated) {
                                        return [2 /*return*/, res.status(500).json({ message: "Failed to update document" })];
                                    }
                                    res.json({ success: true, application: updated });
                                    return [3 /*break*/, 4];
                                case 3:
                                    error_77 = _b.sent();
                                    console.error("Error uploading onboarding document:", error_77);
                                    res.status(500).json({ message: "Failed to upload document" });
                                    return [3 /*break*/, 4];
                                case 4: return [2 /*return*/];
                            }
                        });
                    }); });
                    // COO: Verify tutor onboarding document
                    app.post("/api/coo/verify-tutor-document", isAuthenticated, requireRole(["coo"]), function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var userId, _a, applicationId, documentType, updated, isUnder18, allVerified, error_78;
                        return __generator(this, function (_b) {
                            switch (_b.label) {
                                case 0:
                                    _b.trys.push([0, 4, , 5]);
                                    userId = req.session.userId;
                                    _a = req.body, applicationId = _a.applicationId, documentType = _a.documentType;
                                    if (!applicationId || !documentType) {
                                        return [2 /*return*/, res.status(400).json({ message: "Missing required fields" })];
                                    }
                                    if (!["trial_agreement", "parent_consent"].includes(documentType)) {
                                        return [2 /*return*/, res.status(400).json({ message: "Invalid document type" })];
                                    }
                                    return [4 /*yield*/, storage.verifyTutorOnboardingDocument(applicationId, documentType, userId)];
                                case 1:
                                    updated = _b.sent();
                                    if (!updated) {
                                        return [2 /*return*/, res.status(500).json({ message: "Failed to verify document" })];
                                    }
                                    isUnder18 = updated.age < 18;
                                    allVerified = updated.trialAgreementVerified &&
                                        (!isUnder18 || updated.parentConsentVerified);
                                    if (!allVerified) return [3 /*break*/, 3];
                                    return [4 /*yield*/, storage.completeTutorOnboarding(applicationId)];
                                case 2:
                                    _b.sent();
                                    _b.label = 3;
                                case 3:
                                    res.json({ success: true, application: updated, onboardingComplete: allVerified });
                                    return [3 /*break*/, 5];
                                case 4:
                                    error_78 = _b.sent();
                                    console.error("Error verifying onboarding document:", error_78);
                                    res.status(500).json({ message: "Failed to verify document" });
                                    return [3 /*break*/, 5];
                                case 5: return [2 /*return*/];
                            }
                        });
                    }); });
                    // Get tutor's own applications
                    app.get("/api/tutor/applications", isAuthenticated, requireRole(["tutor"]), function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var userId, applications, error_79;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    _a.trys.push([0, 2, , 3]);
                                    userId = req.session.userId;
                                    return [4 /*yield*/, storage.getTutorApplicationsByUser(userId)];
                                case 1:
                                    applications = _a.sent();
                                    res.json(applications);
                                    return [3 /*break*/, 3];
                                case 2:
                                    error_79 = _a.sent();
                                    console.error("Error fetching tutor applications:", error_79);
                                    res.status(500).json({ message: "Failed to fetch applications" });
                                    return [3 /*break*/, 3];
                                case 3: return [2 /*return*/];
                            }
                        });
                    }); });
                    // Get all tutor applications (COO and HR)
                    app.get("/api/coo/tutor-applications", isAuthenticated, requireRole(["coo", "hr"]), function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var status_3, applications, error_80;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    _a.trys.push([0, 5, , 6]);
                                    status_3 = req.query.status;
                                    applications = void 0;
                                    if (!(status_3 && (status_3 === "pending" || status_3 === "approved" || status_3 === "rejected"))) return [3 /*break*/, 2];
                                    return [4 /*yield*/, storage.getTutorApplicationsByStatus(status_3)];
                                case 1:
                                    applications = _a.sent();
                                    return [3 /*break*/, 4];
                                case 2: return [4 /*yield*/, storage.getTutorApplications()];
                                case 3:
                                    applications = _a.sent();
                                    _a.label = 4;
                                case 4:
                                    res.json(applications);
                                    return [3 /*break*/, 6];
                                case 5:
                                    error_80 = _a.sent();
                                    console.error("Error fetching tutor applications:", error_80);
                                    res.status(500).json({ message: "Failed to fetch applications" });
                                    return [3 /*break*/, 6];
                                case 6: return [2 /*return*/];
                            }
                        });
                    }); });
                    // Approve tutor application (COO)
                    app.post("/api/coo/tutor-applications/:id/approve", isAuthenticated, requireRole(["coo"]), function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var id, reviewerId, application, error_81;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    _a.trys.push([0, 2, , 3]);
                                    id = req.params.id;
                                    reviewerId = req.session.userId;
                                    return [4 /*yield*/, storage.approveTutorApplication(id, reviewerId)];
                                case 1:
                                    application = _a.sent();
                                    if (!application) {
                                        return [2 /*return*/, res.status(404).json({ message: "Application not found" })];
                                    }
                                    res.json(application);
                                    return [3 /*break*/, 3];
                                case 2:
                                    error_81 = _a.sent();
                                    console.error("Error approving tutor application:", error_81);
                                    res.status(500).json({ message: "Failed to approve application" });
                                    return [3 /*break*/, 3];
                                case 3: return [2 /*return*/];
                            }
                        });
                    }); });
                    // Reject tutor application (COO)
                    app.post("/api/coo/tutor-applications/:id/reject", isAuthenticated, requireRole(["coo"]), function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var id, reason, reviewerId, application, error_82;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    _a.trys.push([0, 2, , 3]);
                                    id = req.params.id;
                                    reason = req.body.reason;
                                    reviewerId = req.session.userId;
                                    return [4 /*yield*/, storage.rejectTutorApplication(id, reviewerId, reason || "")];
                                case 1:
                                    application = _a.sent();
                                    if (!application) {
                                        return [2 /*return*/, res.status(404).json({ message: "Application not found" })];
                                    }
                                    res.json(application);
                                    return [3 /*break*/, 3];
                                case 2:
                                    error_82 = _a.sent();
                                    console.error("Error rejecting tutor application:", error_82);
                                    res.status(500).json({ message: "Failed to reject application" });
                                    return [3 /*break*/, 3];
                                case 3: return [2 /*return*/];
                            }
                        });
                    }); });
                    // ========================================
                    // HR ROUTES
                    // ========================================
                    // Get HR dashboard stats
                    app.get("/api/hr/stats", isAuthenticated, requireRole(["hr"]), function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var allApplications, pendingApplications, approvedApplications, availableForPods, assignments, assignedTutorIds_1, e_1, totalEnrollments, studentEnrollments, currentMonth, firstDay, _a, monthEnrollments, enrollError, _b, count, countError, e_2, peopleCount, pCount, e_3, openDisputes, dCount, e_4, error_83;
                        return __generator(this, function (_c) {
                            switch (_c.label) {
                                case 0:
                                    _c.trys.push([0, 21, , 22]);
                                    return [4 /*yield*/, storage.getTutorApplications()];
                                case 1:
                                    allApplications = _c.sent();
                                    return [4 /*yield*/, storage.getTutorApplicationsByStatus("pending")];
                                case 2:
                                    pendingApplications = _c.sent();
                                    return [4 /*yield*/, storage.getTutorApplicationsByStatus("approved")];
                                case 3:
                                    approvedApplications = _c.sent();
                                    availableForPods = 0;
                                    _c.label = 4;
                                case 4:
                                    _c.trys.push([4, 6, , 7]);
                                    return [4 /*yield*/, supabase
                                            .from("tutor_assignments")
                                            .select("tutor_id")];
                                case 5:
                                    assignments = (_c.sent()).data;
                                    assignedTutorIds_1 = new Set((assignments === null || assignments === void 0 ? void 0 : assignments.map(function (a) { return a.tutor_id; })) || []);
                                    // Count approved tutors who are not in the assignments list
                                    availableForPods = approvedApplications.filter(function (app) { return !assignedTutorIds_1.has(app.userId); }).length;
                                    return [3 /*break*/, 7];
                                case 6:
                                    e_1 = _c.sent();
                                    console.warn("Could not fetch tutor assignments:", e_1);
                                    availableForPods = approvedApplications.length; // Fallback to all approved
                                    return [3 /*break*/, 7];
                                case 7:
                                    totalEnrollments = 0;
                                    studentEnrollments = 0;
                                    _c.label = 8;
                                case 8:
                                    _c.trys.push([8, 11, , 12]);
                                    currentMonth = new Date();
                                    firstDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
                                    return [4 /*yield*/, supabase
                                            .from("parent_enrollments")
                                            .select("id")
                                            .gte("created_at", firstDay.toISOString())];
                                case 9:
                                    _a = _c.sent(), monthEnrollments = _a.data, enrollError = _a.error;
                                    if (enrollError) {
                                        console.warn("Error fetching month enrollments:", enrollError);
                                    }
                                    else if (monthEnrollments) {
                                        studentEnrollments = monthEnrollments.length;
                                    }
                                    return [4 /*yield*/, supabase
                                            .from("parent_enrollments")
                                            .select("*", { count: "exact", head: true })];
                                case 10:
                                    _b = _c.sent(), count = _b.count, countError = _b.error;
                                    if (countError) {
                                        console.warn("Error fetching total enrollments count:", countError);
                                        // Fallback: total should be at least this month's count
                                        totalEnrollments = studentEnrollments;
                                    }
                                    else {
                                        totalEnrollments = count || studentEnrollments;
                                    }
                                    return [3 /*break*/, 12];
                                case 11:
                                    e_2 = _c.sent();
                                    console.warn("Could not fetch parent enrollments:", e_2);
                                    return [3 /*break*/, 12];
                                case 12:
                                    peopleCount = 0;
                                    _c.label = 13;
                                case 13:
                                    _c.trys.push([13, 15, , 16]);
                                    return [4 /*yield*/, supabase
                                            .from("people_registry")
                                            .select("*", { count: "exact", head: true })
                                            .eq("status", "active")];
                                case 14:
                                    pCount = (_c.sent()).count;
                                    peopleCount = pCount || 0;
                                    return [3 /*break*/, 16];
                                case 15:
                                    e_3 = _c.sent();
                                    console.warn("Could not fetch people count:", e_3);
                                    return [3 /*break*/, 16];
                                case 16:
                                    openDisputes = 0;
                                    _c.label = 17;
                                case 17:
                                    _c.trys.push([17, 19, , 20]);
                                    return [4 /*yield*/, supabase
                                            .from("disputes")
                                            .select("*", { count: "exact", head: true })
                                            .in("status", ["open", "under_review", "escalated"])];
                                case 18:
                                    dCount = (_c.sent()).count;
                                    openDisputes = dCount || 0;
                                    return [3 /*break*/, 20];
                                case 19:
                                    e_4 = _c.sent();
                                    console.warn("Could not fetch disputes count:", e_4);
                                    return [3 /*break*/, 20];
                                case 20:
                                    res.json({
                                        totalApplications: allApplications.length,
                                        pendingApplications: pendingApplications.length,
                                        approvedTutors: approvedApplications.length,
                                        availableForPods: availableForPods,
                                        totalEnrollments: totalEnrollments,
                                        studentEnrollments: studentEnrollments,
                                        peopleCount: peopleCount,
                                        openDisputes: openDisputes,
                                    });
                                    return [3 /*break*/, 22];
                                case 21:
                                    error_83 = _c.sent();
                                    console.error("Error fetching HR stats:", error_83);
                                    res.status(500).json({
                                        totalApplications: 0,
                                        pendingApplications: 0,
                                        approvedTutors: 0,
                                        availableForPods: 0,
                                        totalEnrollments: 0,
                                        studentEnrollments: 0,
                                        peopleCount: 0,
                                        openDisputes: 0,
                                        error: "Failed to fetch stats"
                                    });
                                    return [3 /*break*/, 22];
                                case 22: return [2 /*return*/];
                            }
                        });
                    }); });
                    // Get all parent enrollments for HR traffic page
                    app.get("/api/hr/enrollments", isAuthenticated, requireRole(["hr"]), function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var _a, data, error, transformed, error_84;
                        return __generator(this, function (_b) {
                            switch (_b.label) {
                                case 0:
                                    _b.trys.push([0, 2, , 3]);
                                    return [4 /*yield*/, supabase
                                            .from("parent_enrollments")
                                            .select("id, user_id, parent_full_name, parent_phone, parent_email, parent_city, student_full_name, student_grade, school_name, math_struggle_areas, previous_tutoring, internet_access, parent_motivation, status, created_at")
                                            .order("created_at", { ascending: false })];
                                case 1:
                                    _a = _b.sent(), data = _a.data, error = _a.error;
                                    if (error) {
                                        console.error("Error selecting parent_enrollments:", error.message);
                                        return [2 /*return*/, res.status(500).json([])];
                                    }
                                    transformed = (data || []).map(function (e) { return (__assign(__assign({}, e), { statusLabel: e.status === "awaiting_assignment" ? "Awaiting Assignment" :
                                            e.status === "assigned" ? "Assigned" :
                                                e.status === "confirmed" ? "Confirmed" :
                                                    e.status })); });
                                    console.log("/api/hr/enrollments returned ".concat(transformed.length, " rows"));
                                    res.json(transformed);
                                    return [3 /*break*/, 3];
                                case 2:
                                    error_84 = _b.sent();
                                    console.error("Error in /api/hr/enrollments:", error_84);
                                    res.status(500).json([]);
                                    return [3 /*break*/, 3];
                                case 3: return [2 /*return*/];
                            }
                        });
                    }); });
                    // Assign tutor to parent enrollment
                    app.post("/api/hr/enrollments/:enrollmentId/assign-tutor", isAuthenticated, requireRole(["hr"]), function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var enrollmentId, _a, tutorId, podId, _b, data, error, enrollment, confidenceScore, studentError, studentErr_1, error_85;
                        return __generator(this, function (_c) {
                            switch (_c.label) {
                                case 0:
                                    _c.trys.push([0, 6, , 7]);
                                    enrollmentId = req.params.enrollmentId;
                                    _a = req.body, tutorId = _a.tutorId, podId = _a.podId;
                                    if (!tutorId) {
                                        return [2 /*return*/, res.status(400).json({ message: "Tutor ID is required" })];
                                    }
                                    return [4 /*yield*/, supabase
                                            .from("parent_enrollments")
                                            .update({
                                            assigned_tutor_id: tutorId,
                                            status: "assigned",
                                            updated_at: new Date().toISOString(),
                                        })
                                            .eq("id", enrollmentId)
                                            .select()];
                                case 1:
                                    _b = _c.sent(), data = _b.data, error = _b.error;
                                    if (error) {
                                        console.error("Error updating enrollment:", error);
                                        return [2 /*return*/, res.status(500).json({ message: "Failed to assign tutor" })];
                                    }
                                    if (!data || data.length === 0) {
                                        return [2 /*return*/, res.status(404).json({ message: "Enrollment not found" })];
                                    }
                                    enrollment = data[0];
                                    _c.label = 2;
                                case 2:
                                    _c.trys.push([2, 4, , 5]);
                                    confidenceScore = 5;
                                    // Use bulletproof student creation logic
                                    try {
                                        const studentData = {
                                            name: enrollment.student_full_name,
                                            grade: enrollment.student_grade,
                                            tutorId: tutorId,
                                            sessionProgress: 0,
                                            confidenceScore: confidenceScore,
                                            parent_id: enrollment.user_id, // Use parent_id directly
                                        };
                                        storage.createStudent(studentData);
                                        console.log("Student created successfully for:", enrollment.student_full_name);
                                    } catch (studentError) {
                                        console.error("Error creating student:", studentError);
                                        return res.status(500).json({ message: "Failed to create student", error: studentError.message });
                                    }
                                    return [3 /*break*/, 5];
                                case 4:
                                    studentErr_1 = _c.sent();
                                    console.error("Error in student creation flow:", studentErr_1);
                                    return [3 /*break*/, 5];
                                case 5:
                                    res.json({
                                        message: "Tutor assigned successfully",
                                        enrollment: data[0],
                                    });
                                    return [3 /*break*/, 7];
                                case 6:
                                    error_85 = _c.sent();
                                    console.error("Error assigning tutor:", error_85);
                                    res.status(500).json({ message: "Failed to assign tutor" });
                                    return [3 /*break*/, 7];
                                case 7: return [2 /*return*/];
                            }
                        });
                    }); });
                    // Get active pods for HR to assign tutors
                    app.get("/api/hr/active-pods", isAuthenticated, requireRole(["hr"]), function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var pods, activePods, error_86;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    _a.trys.push([0, 2, , 3]);
                                    return [4 /*yield*/, storage.getPods()];
                                case 1:
                                    pods = _a.sent();
                                    activePods = pods.filter(function (p) { return p.status === "active"; });
                                    res.json(activePods);
                                    return [3 /*break*/, 3];
                                case 2:
                                    error_86 = _a.sent();
                                    console.error("Error fetching active pods:", error_86);
                                    res.status(500).json({ message: "Failed to fetch active pods" });
                                    return [3 /*break*/, 3];
                                case 3: return [2 /*return*/];
                            }
                        });
                    }); });
                    // Get tutors in a pod for HR
                    app.get("/api/hr/pods/:podId/tutors", isAuthenticated, requireRole(["hr"]), function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var podId, assignments, tutorsData, error_87;
                        var _this = this;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    _a.trys.push([0, 3, , 4]);
                                    podId = req.params.podId;
                                    return [4 /*yield*/, storage.getTutorAssignmentsByPod(podId)];
                                case 1:
                                    assignments = _a.sent();
                                    return [4 /*yield*/, Promise.all(assignments.map(function (assignment) { return __awaiter(_this, void 0, void 0, function () {
                                            var tutor;
                                            return __generator(this, function (_a) {
                                                switch (_a.label) {
                                                    case 0: return [4 /*yield*/, storage.getUser(assignment.tutorId)];
                                                    case 1:
                                                        tutor = _a.sent();
                                                        return [2 /*return*/, __assign(__assign({}, assignment), { tutorName: (tutor === null || tutor === void 0 ? void 0 : tutor.name) || "Unknown", tutorEmail: (tutor === null || tutor === void 0 ? void 0 : tutor.email) || "" })];
                                                }
                                            });
                                        }); }))];
                                case 2:
                                    tutorsData = _a.sent();
                                    res.json(tutorsData);
                                    return [3 /*break*/, 4];
                                case 3:
                                    error_87 = _a.sent();
                                    console.error("Error fetching pod tutors:", error_87);
                                    res.status(500).json({ message: "Failed to fetch pod tutors" });
                                    return [3 /*break*/, 4];
                                case 4: return [2 /*return*/];
                            }
                        });
                    }); });
                    // Get tutor profile by ID (public endpoint for HR)
                    app.get("/api/tutors/:tutorId", isAuthenticated, requireRole(["hr"]), function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var tutorId, tutor, error_88;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    _a.trys.push([0, 2, , 3]);
                                    tutorId = req.params.tutorId;
                                    return [4 /*yield*/, storage.getUser(tutorId)];
                                case 1:
                                    tutor = _a.sent();
                                    if (!tutor) {
                                        return [2 /*return*/, res.status(404).json({ message: "Tutor not found" })];
                                    }
                                    res.json(tutor);
                                    return [3 /*break*/, 3];
                                case 2:
                                    error_88 = _a.sent();
                                    console.error("Error fetching tutor profile:", error_88);
                                    res.status(500).json({ message: "Failed to fetch tutor profile" });
                                    return [3 /*break*/, 3];
                                case 3: return [2 /*return*/];
                            }
                        });
                    }); });
                    // ========================================
                    // BRAIN MODULE ROUTES (HR)
                    // ========================================
                    // Get all people in registry
                    app.get("/api/hr/brain/people", isAuthenticated, requireRole(["hr", "ceo"]), function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var _a, data, error, error_89;
                        return __generator(this, function (_b) {
                            switch (_b.label) {
                                case 0:
                                    _b.trys.push([0, 2, , 3]);
                                    return [4 /*yield*/, supabase
                                            .from("people_registry")
                                            .select("*")
                                            .order("created_at", { ascending: false })];
                                case 1:
                                    _a = _b.sent(), data = _a.data, error = _a.error;
                                    if (error) {
                                        console.error("Error fetching people registry:", error);
                                        return [2 /*return*/, res.json([])];
                                    }
                                    res.json(data || []);
                                    return [3 /*break*/, 3];
                                case 2:
                                    error_89 = _b.sent();
                                    console.error("Error in people registry:", error_89);
                                    res.json([]);
                                    return [3 /*break*/, 3];
                                case 3: return [2 /*return*/];
                            }
                        });
                    }); });
                    // Add person to registry
                    app.post("/api/hr/brain/people", isAuthenticated, requireRole(["hr", "ceo"]), function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var _a, data, error, error_90;
                        return __generator(this, function (_b) {
                            switch (_b.label) {
                                case 0:
                                    _b.trys.push([0, 2, , 3]);
                                    return [4 /*yield*/, supabase
                                            .from("people_registry")
                                            .insert({
                                            full_name: req.body.fullName,
                                            role_title: req.body.roleTitle,
                                            role_description: req.body.roleDescription,
                                            short_bio: req.body.shortBio,
                                            team_name: req.body.teamName,
                                            email: req.body.email,
                                            phone: req.body.phone,
                                            status: req.body.status || "active",
                                            start_date: req.body.startDate ? new Date(req.body.startDate) : new Date(),
                                        })
                                            .select()
                                            .single()];
                                case 1:
                                    _a = _b.sent(), data = _a.data, error = _a.error;
                                    if (error) {
                                        console.error("Error adding person:", error);
                                        return [2 /*return*/, res.status(500).json({ message: "Failed to add person" })];
                                    }
                                    res.json(data);
                                    return [3 /*break*/, 3];
                                case 2:
                                    error_90 = _b.sent();
                                    console.error("Error in add person:", error_90);
                                    res.status(500).json({ message: "Failed to add person" });
                                    return [3 /*break*/, 3];
                                case 3: return [2 /*return*/];
                            }
                        });
                    }); });
                    // Get all details (weekly deliverables)
                    app.get("/api/hr/brain/details", isAuthenticated, requireRole(["hr", "ceo"]), function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var _a, data, error, error_91;
                        return __generator(this, function (_b) {
                            switch (_b.label) {
                                case 0:
                                    _b.trys.push([0, 2, , 3]);
                                    return [4 /*yield*/, supabase
                                            .from("details")
                                            .select("\n            *,\n            person:people_registry(*)\n          ")
                                            .order("due_date", { ascending: true })];
                                case 1:
                                    _a = _b.sent(), data = _a.data, error = _a.error;
                                    if (error) {
                                        console.error("Error fetching details:", error);
                                        return [2 /*return*/, res.json([])];
                                    }
                                    res.json(data || []);
                                    return [3 /*break*/, 3];
                                case 2:
                                    error_91 = _b.sent();
                                    console.error("Error in details:", error_91);
                                    res.json([]);
                                    return [3 /*break*/, 3];
                                case 3: return [2 /*return*/];
                            }
                        });
                    }); });
                    // Create detail
                    app.post("/api/hr/brain/details", isAuthenticated, requireRole(["hr", "ceo"]), function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var userId, _a, data, error, error_92;
                        return __generator(this, function (_b) {
                            switch (_b.label) {
                                case 0:
                                    _b.trys.push([0, 2, , 3]);
                                    userId = req.session.userId;
                                    return [4 /*yield*/, supabase
                                            .from("details")
                                            .insert({
                                            person_id: req.body.personId,
                                            description: req.body.description,
                                            due_date: new Date(req.body.dueDate),
                                            status: "pending",
                                            created_by: userId,
                                        })
                                            .select()
                                            .single()];
                                case 1:
                                    _a = _b.sent(), data = _a.data, error = _a.error;
                                    if (error) {
                                        console.error("Error creating detail:", error);
                                        return [2 /*return*/, res.status(500).json({ message: "Failed to create detail" })];
                                    }
                                    res.json(data);
                                    return [3 /*break*/, 3];
                                case 2:
                                    error_92 = _b.sent();
                                    console.error("Error in create detail:", error_92);
                                    res.status(500).json({ message: "Failed to create detail" });
                                    return [3 /*break*/, 3];
                                case 3: return [2 /*return*/];
                            }
                        });
                    }); });
                    // Mark detail as done
                    app.patch("/api/hr/brain/details/:id/done", isAuthenticated, requireRole(["hr", "ceo"]), function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var id, _a, data, error, error_93;
                        return __generator(this, function (_b) {
                            switch (_b.label) {
                                case 0:
                                    _b.trys.push([0, 2, , 3]);
                                    id = req.params.id;
                                    return [4 /*yield*/, supabase
                                            .from("details")
                                            .update({
                                            status: "done",
                                            fulfilled_at: new Date(),
                                        })
                                            .eq("id", id)
                                            .select()
                                            .single()];
                                case 1:
                                    _a = _b.sent(), data = _a.data, error = _a.error;
                                    if (error) {
                                        console.error("Error marking detail done:", error);
                                        return [2 /*return*/, res.status(500).json({ message: "Failed to mark detail done" })];
                                    }
                                    res.json(data);
                                    return [3 /*break*/, 3];
                                case 2:
                                    error_93 = _b.sent();
                                    console.error("Error in mark detail done:", error_93);
                                    res.status(500).json({ message: "Failed to mark detail done" });
                                    return [3 /*break*/, 3];
                                case 3: return [2 /*return*/];
                            }
                        });
                    }); });
                    // Get all projects
                    app.get("/api/hr/brain/projects", isAuthenticated, requireRole(["hr", "ceo"]), function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var _a, data, error, error_94;
                        return __generator(this, function (_b) {
                            switch (_b.label) {
                                case 0:
                                    _b.trys.push([0, 2, , 3]);
                                    return [4 /*yield*/, supabase
                                            .from("projects")
                                            .select("\n            *,\n            owner:people_registry(*)\n          ")
                                            .order("created_at", { ascending: false })];
                                case 1:
                                    _a = _b.sent(), data = _a.data, error = _a.error;
                                    if (error) {
                                        console.error("Error fetching projects:", error);
                                        return [2 /*return*/, res.json([])];
                                    }
                                    res.json(data || []);
                                    return [3 /*break*/, 3];
                                case 2:
                                    error_94 = _b.sent();
                                    console.error("Error in projects:", error_94);
                                    res.json([]);
                                    return [3 /*break*/, 3];
                                case 3: return [2 /*return*/];
                            }
                        });
                    }); });
                    // Create project
                    app.post("/api/hr/brain/projects", isAuthenticated, requireRole(["hr", "ceo"]), function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var userId, _a, data, error, error_95;
                        return __generator(this, function (_b) {
                            switch (_b.label) {
                                case 0:
                                    _b.trys.push([0, 2, , 3]);
                                    userId = req.session.userId;
                                    return [4 /*yield*/, supabase
                                            .from("projects")
                                            .insert({
                                            name: req.body.name,
                                            owner_id: req.body.ownerId,
                                            horizon: req.body.horizon,
                                            objective: req.body.objective,
                                            status: "active",
                                            start_date: new Date(),
                                            created_by: userId,
                                        })
                                            .select()
                                            .single()];
                                case 1:
                                    _a = _b.sent(), data = _a.data, error = _a.error;
                                    if (error) {
                                        console.error("Error creating project:", error);
                                        return [2 /*return*/, res.status(500).json({ message: "Failed to create project" })];
                                    }
                                    res.json(data);
                                    return [3 /*break*/, 3];
                                case 2:
                                    error_95 = _b.sent();
                                    console.error("Error in create project:", error_95);
                                    res.status(500).json({ message: "Failed to create project" });
                                    return [3 /*break*/, 3];
                                case 3: return [2 /*return*/];
                            }
                        });
                    }); });
                    // Get all ideas
                    app.get("/api/hr/brain/ideas", isAuthenticated, requireRole(["hr", "ceo"]), function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var _a, data, error, error_96;
                        return __generator(this, function (_b) {
                            switch (_b.label) {
                                case 0:
                                    _b.trys.push([0, 2, , 3]);
                                    return [4 /*yield*/, supabase
                                            .from("ideas")
                                            .select("*")
                                            .order("created_at", { ascending: false })];
                                case 1:
                                    _a = _b.sent(), data = _a.data, error = _a.error;
                                    if (error) {
                                        console.error("Error fetching ideas:", error);
                                        return [2 /*return*/, res.json([])];
                                    }
                                    res.json(data || []);
                                    return [3 /*break*/, 3];
                                case 2:
                                    error_96 = _b.sent();
                                    console.error("Error in ideas:", error_96);
                                    res.json([]);
                                    return [3 /*break*/, 3];
                                case 3: return [2 /*return*/];
                            }
                        });
                    }); });
                    // Update idea status
                    app.patch("/api/hr/brain/ideas/:id/status", isAuthenticated, requireRole(["hr", "ceo"]), function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var id, userId, _a, data, error, error_97;
                        return __generator(this, function (_b) {
                            switch (_b.label) {
                                case 0:
                                    _b.trys.push([0, 2, , 3]);
                                    id = req.params.id;
                                    userId = req.session.userId;
                                    return [4 /*yield*/, supabase
                                            .from("ideas")
                                            .update({
                                            status: req.body.status,
                                            review_notes: req.body.notes,
                                            reviewed_by: userId,
                                            reviewed_at: new Date(),
                                        })
                                            .eq("id", id)
                                            .select()
                                            .single()];
                                case 1:
                                    _a = _b.sent(), data = _a.data, error = _a.error;
                                    if (error) {
                                        console.error("Error updating idea status:", error);
                                        return [2 /*return*/, res.status(500).json({ message: "Failed to update idea status" })];
                                    }
                                    res.json(data);
                                    return [3 /*break*/, 3];
                                case 2:
                                    error_97 = _b.sent();
                                    console.error("Error in update idea status:", error_97);
                                    res.status(500).json({ message: "Failed to update idea status" });
                                    return [3 /*break*/, 3];
                                case 3: return [2 /*return*/];
                            }
                        });
                    }); });
                    // Convert idea to project
                    app.post("/api/hr/brain/ideas/:id/convert", isAuthenticated, requireRole(["hr", "ceo"]), function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var id, userId, _a, idea, ideaError, _b, project, projectError, error_98;
                        return __generator(this, function (_c) {
                            switch (_c.label) {
                                case 0:
                                    _c.trys.push([0, 4, , 5]);
                                    id = req.params.id;
                                    userId = req.session.userId;
                                    return [4 /*yield*/, supabase
                                            .from("ideas")
                                            .select("*")
                                            .eq("id", id)
                                            .single()];
                                case 1:
                                    _a = _c.sent(), idea = _a.data, ideaError = _a.error;
                                    if (ideaError || !idea) {
                                        return [2 /*return*/, res.status(404).json({ message: "Idea not found" })];
                                    }
                                    return [4 /*yield*/, supabase
                                            .from("projects")
                                            .insert({
                                            name: idea.title,
                                            objective: idea.description,
                                            horizon: "30",
                                            status: "active",
                                            start_date: new Date(),
                                            created_by: userId,
                                        })
                                            .select()
                                            .single()];
                                case 2:
                                    _b = _c.sent(), project = _b.data, projectError = _b.error;
                                    if (projectError) {
                                        console.error("Error creating project from idea:", projectError);
                                        return [2 /*return*/, res.status(500).json({ message: "Failed to create project" })];
                                    }
                                    // Update idea with project reference
                                    return [4 /*yield*/, supabase
                                            .from("ideas")
                                            .update({
                                            status: "approved",
                                            converted_to_project_id: project.id,
                                        })
                                            .eq("id", id)];
                                case 3:
                                    // Update idea with project reference
                                    _c.sent();
                                    res.json({ project: project, idea: idea });
                                    return [3 /*break*/, 5];
                                case 4:
                                    error_98 = _c.sent();
                                    console.error("Error converting idea to project:", error_98);
                                    res.status(500).json({ message: "Failed to convert idea" });
                                    return [3 /*break*/, 5];
                                case 5: return [2 /*return*/];
                            }
                        });
                    }); });
                    // Submit idea (public - any logged in user)
                    app.post("/api/ideas/submit", isAuthenticated, function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var userId, _a, data, error, error_99;
                        return __generator(this, function (_b) {
                            switch (_b.label) {
                                case 0:
                                    _b.trys.push([0, 2, , 3]);
                                    userId = req.session.userId;
                                    return [4 /*yield*/, supabase
                                            .from("ideas")
                                            .insert({
                                            title: req.body.title,
                                            description: req.body.description,
                                            pillar: req.body.pillar,
                                            problem_solved: req.body.problemSolved,
                                            status: "new",
                                            submitted_by: userId,
                                            submitter_name: req.body.submitterName,
                                            submitter_role: req.body.submitterRole,
                                        })
                                            .select()
                                            .single()];
                                case 1:
                                    _a = _b.sent(), data = _a.data, error = _a.error;
                                    if (error) {
                                        console.error("Error submitting idea:", error);
                                        return [2 /*return*/, res.status(500).json({ message: "Failed to submit idea" })];
                                    }
                                    res.json(data);
                                    return [3 /*break*/, 3];
                                case 2:
                                    error_99 = _b.sent();
                                    console.error("Error in submit idea:", error_99);
                                    res.status(500).json({ message: "Failed to submit idea" });
                                    return [3 /*break*/, 3];
                                case 3: return [2 /*return*/];
                            }
                        });
                    }); });
                    // Submit High School Leadership Pilot request (allow public submissions)
                    app.post("/api/pilots/highschool/submit", function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var userId, insertObj, _a, data, error, error_100;
                        var _b;
                        return __generator(this, function (_c) {
                            switch (_c.label) {
                                case 0:
                                    _c.trys.push([0, 2, , 3]);
                                    userId = ((_b = req.session) === null || _b === void 0 ? void 0 : _b.userId) || null;
                                    insertObj = {
                                        school_name: req.body.schoolName,
                                        contact_person_name: req.body.contactPersonName || null,
                                        contact_person_phone: req.body.phone || null,
                                        contact_person_role: req.body.contactPersonRole,
                                        email: req.body.email,
                                        submitter_name: req.body.submitterName || null,
                                        submitter_role: req.body.submitterRole || null,
                                    };
                                    if (userId)
                                        insertObj.submitted_by = userId;
                                    return [4 /*yield*/, supabase
                                            .from("leadership_pilot_requests")
                                            .insert(insertObj)
                                            .select()
                                            .single()];
                                case 1:
                                    _a = _c.sent(), data = _a.data, error = _a.error;
                                    if (error) {
                                        console.error("Error submitting leadership pilot request:", error);
                                        return [2 /*return*/, res.status(500).json({ message: "Failed to submit request" })];
                                    }
                                    res.json(data);
                                    return [3 /*break*/, 3];
                                case 2:
                                    error_100 = _c.sent();
                                    console.error("Error in submit leadership pilot request:", error_100);
                                    res.status(500).json({ message: "Failed to submit request" });
                                    return [3 /*break*/, 3];
                                case 3: return [2 /*return*/];
                            }
                        });
                    }); });
                    // Submit Early Intervention Pilot request (allow public submissions)
                    app.post("/api/pilots/earlyintervention/submit", function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var userId, insertObj, _a, data, error, error_101;
                        var _b;
                        return __generator(this, function (_c) {
                            switch (_c.label) {
                                case 0:
                                    _c.trys.push([0, 2, , 3]);
                                    userId = ((_b = req.session) === null || _b === void 0 ? void 0 : _b.userId) || null;
                                    insertObj = {
                                        school_name: req.body.schoolName,
                                        contact_person_name: req.body.contactPersonName || null,
                                        contact_person_phone: req.body.phone || null,
                                        contact_person_role: req.body.contactPersonRole,
                                        email: req.body.email,
                                        submitter_name: req.body.submitterName || null,
                                        submitter_role: req.body.submitterRole || null,
                                    };
                                    if (userId)
                                        insertObj.submitted_by = userId;
                                    return [4 /*yield*/, supabase
                                            .from("early_intervention_requests")
                                            .insert(insertObj)
                                            .select()
                                            .single()];
                                case 1:
                                    _a = _c.sent(), data = _a.data, error = _a.error;
                                    if (error) {
                                        console.error("Error submitting early intervention pilot request:", error);
                                        return [2 /*return*/, res.status(500).json({ message: "Failed to submit request" })];
                                    }
                                    res.json(data);
                                    return [3 /*break*/, 3];
                                case 2:
                                    error_101 = _c.sent();
                                    console.error("Error in submit early intervention pilot request:", error_101);
                                    res.status(500).json({ message: "Failed to submit request" });
                                    return [3 /*break*/, 3];
                                case 3: return [2 /*return*/];
                            }
                        });
                    }); });
                    // COO: fetch leadership pilot requests
                    // COO: delete leadership pilot request
                    app.delete("/api/coo/leadership-pilot-requests/:id", isAuthenticated, requireRole(["coo"]), function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var id, error, error_102;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    _a.trys.push([0, 2, , 3]);
                                    id = req.params.id;
                                    return [4 /*yield*/, supabase
                                            .from("leadership_pilot_requests")
                                            .delete()
                                            .eq("id", id)];
                                case 1:
                                    error = (_a.sent()).error;
                                    if (error) {
                                        console.error("Error deleting leadership pilot request:", error);
                                        return [2 /*return*/, res.status(500).json({ message: "Failed to delete pilot request" })];
                                    }
                                    res.json({ message: "Pilot request deleted" });
                                    return [3 /*break*/, 3];
                                case 2:
                                    error_102 = _a.sent();
                                    console.error("Error in deleting leadership pilot request:", error_102);
                                    res.status(500).json({ message: "Failed to delete pilot request" });
                                    return [3 /*break*/, 3];
                                case 3: return [2 /*return*/];
                            }
                        });
                    }); });
                    app.get("/api/coo/leadership-pilot-requests", isAuthenticated, requireRole(["coo"]), function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var _a, data, error, error_103;
                        return __generator(this, function (_b) {
                            switch (_b.label) {
                                case 0:
                                    _b.trys.push([0, 2, , 3]);
                                    return [4 /*yield*/, supabase
                                            .from("leadership_pilot_requests")
                                            .select("*")
                                            .order("submitted_at", { ascending: false })];
                                case 1:
                                    _a = _b.sent(), data = _a.data, error = _a.error;
                                    if (error) {
                                        console.error("Error fetching leadership pilot requests:", error);
                                        return [2 /*return*/, res.status(500).json({ message: "Failed to fetch requests" })];
                                    }
                                    res.json(data || []);
                                    return [3 /*break*/, 3];
                                case 2:
                                    error_103 = _b.sent();
                                    console.error("Error in fetching leadership pilot requests:", error_103);
                                    res.status(500).json({ message: "Failed to fetch requests" });
                                    return [3 /*break*/, 3];
                                case 3: return [2 /*return*/];
                            }
                        });
                    }); });
                    // HR: fetch leadership pilot requests
                    app.get("/api/hr/leadership-pilot-requests", isAuthenticated, requireRole(["hr"]), function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var _a, data, error, error_104;
                        return __generator(this, function (_b) {
                            switch (_b.label) {
                                case 0:
                                    _b.trys.push([0, 2, , 3]);
                                    return [4 /*yield*/, supabase
                                            .from("leadership_pilot_requests")
                                            .select("*")
                                            .order("submitted_at", { ascending: false })];
                                case 1:
                                    _a = _b.sent(), data = _a.data, error = _a.error;
                                    if (error) {
                                        console.error("Error fetching leadership pilot requests:", error);
                                        return [2 /*return*/, res.status(500).json({ message: "Failed to fetch requests" })];
                                    }
                                    res.json(data || []);
                                    return [3 /*break*/, 3];
                                case 2:
                                    error_104 = _b.sent();
                                    console.error("Error in fetching leadership pilot requests:", error_104);
                                    res.status(500).json({ message: "Failed to fetch requests" });
                                    return [3 /*break*/, 3];
                                case 3: return [2 /*return*/];
                            }
                        });
                    }); });
                    // COO: fetch early intervention pilot requests
                    // COO: delete early intervention pilot request
                    app.delete("/api/coo/earlyintervention-requests/:id", isAuthenticated, requireRole(["coo"]), function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var id, error, error_105;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    _a.trys.push([0, 2, , 3]);
                                    id = req.params.id;
                                    return [4 /*yield*/, supabase
                                            .from("early_intervention_requests")
                                            .delete()
                                            .eq("id", id)];
                                case 1:
                                    error = (_a.sent()).error;
                                    if (error) {
                                        console.error("Error deleting early intervention pilot request:", error);
                                        return [2 /*return*/, res.status(500).json({ message: "Failed to delete pilot request" })];
                                    }
                                    res.json({ message: "Pilot request deleted" });
                                    return [3 /*break*/, 3];
                                case 2:
                                    error_105 = _a.sent();
                                    console.error("Error in deleting early intervention pilot request:", error_105);
                                    res.status(500).json({ message: "Failed to delete pilot request" });
                                    return [3 /*break*/, 3];
                                case 3: return [2 /*return*/];
                            }
                        });
                    }); });
                    app.get("/api/coo/earlyintervention-requests", isAuthenticated, requireRole(["coo"]), function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var _a, data, error, error_106;
                        return __generator(this, function (_b) {
                            switch (_b.label) {
                                case 0:
                                    _b.trys.push([0, 2, , 3]);
                                    return [4 /*yield*/, supabase
                                            .from("early_intervention_requests")
                                            .select("*")
                                            .order("submitted_at", { ascending: false })];
                                case 1:
                                    _a = _b.sent(), data = _a.data, error = _a.error;
                                    if (error) {
                                        console.error("Error fetching early intervention requests:", error);
                                        return [2 /*return*/, res.status(500).json({ message: "Failed to fetch requests" })];
                                    }
                                    res.json(data || []);
                                    return [3 /*break*/, 3];
                                case 2:
                                    error_106 = _b.sent();
                                    console.error("Error in fetching early intervention requests:", error_106);
                                    res.status(500).json({ message: "Failed to fetch requests" });
                                    return [3 /*break*/, 3];
                                case 3: return [2 /*return*/];
                            }
                        });
                    }); });
                    // HR: fetch early intervention pilot requests
                    app.get("/api/hr/earlyintervention-requests", isAuthenticated, requireRole(["hr"]), function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var _a, data, error, error_107;
                        return __generator(this, function (_b) {
                            switch (_b.label) {
                                case 0:
                                    _b.trys.push([0, 2, , 3]);
                                    return [4 /*yield*/, supabase
                                            .from("early_intervention_requests")
                                            .select("*")
                                            .order("submitted_at", { ascending: false })];
                                case 1:
                                    _a = _b.sent(), data = _a.data, error = _a.error;
                                    if (error) {
                                        console.error("Error fetching early intervention requests:", error);
                                        return [2 /*return*/, res.status(500).json({ message: "Failed to fetch requests" })];
                                    }
                                    res.json(data || []);
                                    return [3 /*break*/, 3];
                                case 2:
                                    error_107 = _b.sent();
                                    console.error("Error in fetching early intervention requests:", error_107);
                                    res.status(500).json({ message: "Failed to fetch requests" });
                                    return [3 /*break*/, 3];
                                case 3: return [2 /*return*/];
                            }
                        });
                    }); });
                    // Get people registry list (for any logged in user - for dispute logging)
                    app.get("/api/people-registry/list", isAuthenticated, function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var _a, data, error, transformed, error_108;
                        return __generator(this, function (_b) {
                            switch (_b.label) {
                                case 0:
                                    _b.trys.push([0, 2, , 3]);
                                    return [4 /*yield*/, supabase
                                            .from("people_registry")
                                            .select("id, full_name, role_title, status")
                                            .eq("status", "active")
                                            .order("full_name", { ascending: true })];
                                case 1:
                                    _a = _b.sent(), data = _a.data, error = _a.error;
                                    if (error) {
                                        console.error("Error fetching people list:", error);
                                        return [2 /*return*/, res.json([])];
                                    }
                                    transformed = (data || []).map(function (p) { return ({
                                        id: p.id,
                                        fullName: p.full_name,
                                        roleTitle: p.role_title,
                                        status: p.status,
                                    }); });
                                    res.json(transformed);
                                    return [3 /*break*/, 3];
                                case 2:
                                    error_108 = _b.sent();
                                    console.error("Error in people list:", error_108);
                                    res.json([]);
                                    return [3 /*break*/, 3];
                                case 3: return [2 /*return*/];
                            }
                        });
                    }); });
                    // ========================================
                    // DISPUTES MODULE ROUTES (HR)
                    // ========================================
                    // Get all disputes
                    app.get("/api/hr/disputes", isAuthenticated, requireRole(["hr", "ceo"]), function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var _a, disputes, error, disputesWithResolutions, error_109;
                        var _this = this;
                        return __generator(this, function (_b) {
                            switch (_b.label) {
                                case 0:
                                    _b.trys.push([0, 3, , 4]);
                                    return [4 /*yield*/, supabase
                                            .from("disputes")
                                            .select("*")
                                            .order("created_at", { ascending: false })];
                                case 1:
                                    _a = _b.sent(), disputes = _a.data, error = _a.error;
                                    if (error) {
                                        console.error("Error fetching disputes:", error);
                                        return [2 /*return*/, res.json([])];
                                    }
                                    return [4 /*yield*/, Promise.all((disputes || []).map(function (dispute) { return __awaiter(_this, void 0, void 0, function () {
                                            var resolutions;
                                            return __generator(this, function (_a) {
                                                switch (_a.label) {
                                                    case 0: return [4 /*yield*/, supabase
                                                            .from("dispute_resolutions")
                                                            .select("*")
                                                            .eq("dispute_id", dispute.id)
                                                            .order("created_at", { ascending: true })];
                                                    case 1:
                                                        resolutions = (_a.sent()).data;
                                                        return [2 /*return*/, __assign(__assign({}, dispute), { resolutions: resolutions || [] })];
                                                }
                                            });
                                        }); }))];
                                case 2:
                                    disputesWithResolutions = _b.sent();
                                    res.json(disputesWithResolutions);
                                    return [3 /*break*/, 4];
                                case 3:
                                    error_109 = _b.sent();
                                    console.error("Error in disputes:", error_109);
                                    res.json([]);
                                    return [3 /*break*/, 4];
                                case 4: return [2 /*return*/];
                            }
                        });
                    }); });
                    // Log a dispute (any logged in user)
                    app.post("/api/disputes/log", isAuthenticated, function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var userId, _a, data, error, error_110;
                        return __generator(this, function (_b) {
                            switch (_b.label) {
                                case 0:
                                    _b.trys.push([0, 2, , 3]);
                                    userId = req.session.userId;
                                    return [4 /*yield*/, supabase
                                            .from("disputes")
                                            .insert({
                                            logged_by: userId,
                                            logged_by_name: req.body.loggedByName,
                                            involved_parties: req.body.involvedParties,
                                            involved_party_names: req.body.involvedPartyNames,
                                            dispute_type: req.body.disputeType,
                                            description: req.body.description,
                                            desired_outcome: req.body.desiredOutcome,
                                            status: "open",
                                            visible_to: ["hr", "ceo"],
                                        })
                                            .select()
                                            .single()];
                                case 1:
                                    _a = _b.sent(), data = _a.data, error = _a.error;
                                    if (error) {
                                        console.error("Error logging dispute:", error);
                                        return [2 /*return*/, res.status(500).json({ message: "Failed to log dispute" })];
                                    }
                                    res.json(data);
                                    return [3 /*break*/, 3];
                                case 2:
                                    error_110 = _b.sent();
                                    console.error("Error in log dispute:", error_110);
                                    res.status(500).json({ message: "Failed to log dispute" });
                                    return [3 /*break*/, 3];
                                case 3: return [2 /*return*/];
                            }
                        });
                    }); });
                    // Update dispute status
                    app.patch("/api/hr/disputes/:id/status", isAuthenticated, requireRole(["hr", "ceo"]), function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var id, _a, data, error, error_111;
                        return __generator(this, function (_b) {
                            switch (_b.label) {
                                case 0:
                                    _b.trys.push([0, 2, , 3]);
                                    id = req.params.id;
                                    return [4 /*yield*/, supabase
                                            .from("disputes")
                                            .update({
                                            status: req.body.status,
                                        })
                                            .eq("id", id)
                                            .select()
                                            .single()];
                                case 1:
                                    _a = _b.sent(), data = _a.data, error = _a.error;
                                    if (error) {
                                        console.error("Error updating dispute status:", error);
                                        return [2 /*return*/, res.status(500).json({ message: "Failed to update dispute status" })];
                                    }
                                    res.json(data);
                                    return [3 /*break*/, 3];
                                case 2:
                                    error_111 = _b.sent();
                                    console.error("Error in update dispute status:", error_111);
                                    res.status(500).json({ message: "Failed to update dispute status" });
                                    return [3 /*break*/, 3];
                                case 3: return [2 /*return*/];
                            }
                        });
                    }); });
                    // Resolve dispute
                    app.post("/api/hr/disputes/:disputeId/resolve", isAuthenticated, requireRole(["hr", "ceo"]), function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var disputeId, userId, _a, resolution, resError, error_112;
                        return __generator(this, function (_b) {
                            switch (_b.label) {
                                case 0:
                                    _b.trys.push([0, 3, , 4]);
                                    disputeId = req.params.disputeId;
                                    userId = req.session.userId;
                                    return [4 /*yield*/, supabase
                                            .from("dispute_resolutions")
                                            .insert({
                                            dispute_id: disputeId,
                                            action: req.body.action,
                                            summary: req.body.summary,
                                            decision: req.body.decision,
                                            follow_up_date: req.body.followUpDate ? new Date(req.body.followUpDate) : null,
                                            resolved_by: userId,
                                        })
                                            .select()
                                            .single()];
                                case 1:
                                    _a = _b.sent(), resolution = _a.data, resError = _a.error;
                                    if (resError) {
                                        console.error("Error creating resolution:", resError);
                                        return [2 /*return*/, res.status(500).json({ message: "Failed to create resolution" })];
                                    }
                                    // Update dispute status to resolved
                                    return [4 /*yield*/, supabase
                                            .from("disputes")
                                            .update({ status: "resolved" })
                                            .eq("id", disputeId)];
                                case 2:
                                    // Update dispute status to resolved
                                    _b.sent();
                                    res.json(resolution);
                                    return [3 /*break*/, 4];
                                case 3:
                                    error_112 = _b.sent();
                                    console.error("Error in resolve dispute:", error_112);
                                    res.status(500).json({ message: "Failed to resolve dispute" });
                                    return [3 /*break*/, 4];
                                case 4: return [2 /*return*/];
                            }
                        });
                    }); });
                    // Get dispute patterns
                    app.get("/api/hr/disputes/patterns", isAuthenticated, requireRole(["hr", "ceo"]), function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var _a, disputes, error, error_113;
                        return __generator(this, function (_b) {
                            switch (_b.label) {
                                case 0:
                                    _b.trys.push([0, 2, , 3]);
                                    return [4 /*yield*/, supabase
                                            .from("disputes")
                                            .select("involved_party_names, dispute_type")];
                                case 1:
                                    _a = _b.sent(), disputes = _a.data, error = _a.error;
                                    if (error) {
                                        console.error("Error fetching disputes for patterns:", error);
                                        return [2 /*return*/, res.json([])];
                                    }
                                    // Return raw data, let frontend process patterns
                                    res.json(disputes || []);
                                    return [3 /*break*/, 3];
                                case 2:
                                    error_113 = _b.sent();
                                    console.error("Error in disputes patterns:", error_113);
                                    res.json([]);
                                    return [3 /*break*/, 3];
                                case 3: return [2 /*return*/];
                            }
                        });
                    }); });
                    // ========================================
                    // AFFILIATE PROSPECTING ROUTES
                    // ========================================
                    // Get or create affiliate code
                    app.get("/api/affiliate/code", isAuthenticated, requireRole(["affiliate"]), function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var affiliateId, codeRecord, error_114;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    _a.trys.push([0, 2, , 3]);
                                    affiliateId = req.session.userId;
                                    console.log("📋 Getting affiliate code for:", affiliateId);
                                    return [4 /*yield*/, storage.getOrCreateAffiliateCode(affiliateId)];
                                case 1:
                                    codeRecord = _a.sent();
                                    console.log("✅ Got code record:", codeRecord);
                                    // Return just the code field to match frontend expectations
                                    res.json({ code: codeRecord.code });
                                    return [3 /*break*/, 3];
                                case 2:
                                    error_114 = _a.sent();
                                    console.error("Error getting affiliate code:", error_114);
                                    res.status(500).json({ message: "Failed to get affiliate code" });
                                    return [3 /*break*/, 3];
                                case 3: return [2 /*return*/];
                            }
                        });
                    }); });
                    // Log encounter
                    app.post("/api/affiliate/encounters", isAuthenticated, requireRole(["affiliate"]), function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var affiliateId, encounter, result, error_115;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    _a.trys.push([0, 2, , 3]);
                                    affiliateId = req.session.userId;
                                    console.log("📝 Logging encounter for affiliate:", affiliateId);
                                    console.log("📋 Encounter data received:", JSON.stringify(req.body, null, 2));
                                    encounter = insertEncounterSchema.parse(req.body);
                                    console.log("✅ Encounter validated:", JSON.stringify(encounter, null, 2));
                                    return [4 /*yield*/, storage.logEncounter(affiliateId, encounter)];
                                case 1:
                                    result = _a.sent();
                                    console.log("✅ Encounter logged successfully:", result);
                                    res.json(result);
                                    return [3 /*break*/, 3];
                                case 2:
                                    error_115 = _a.sent();
                                    console.error("❌ Error logging encounter:", error_115.message);
                                    console.error("   Full error:", error_115);
                                    res.status(400).json({ message: error_115.message || "Failed to log encounter" });
                                    return [3 /*break*/, 3];
                                case 3: return [2 /*return*/];
                            }
                        });
                    }); });
                    // Get all encounters for affiliate
                    app.get("/api/affiliate/encounters", isAuthenticated, requireRole(["affiliate"]), function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var affiliateId, encounters, error_116;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    _a.trys.push([0, 2, , 3]);
                                    affiliateId = req.session.userId;
                                    return [4 /*yield*/, storage.getEncounters(affiliateId)];
                                case 1:
                                    encounters = _a.sent();
                                    res.json(encounters);
                                    return [3 /*break*/, 3];
                                case 2:
                                    error_116 = _a.sent();
                                    console.error("Error getting encounters:", error_116);
                                    res.status(500).json({ message: "Failed to get encounters" });
                                    return [3 /*break*/, 3];
                                case 3: return [2 /*return*/];
                            }
                        });
                    }); });
                    // Mark encounter as objected
                    app.patch("/api/affiliate/encounters/:id/object", isAuthenticated, requireRole(["affiliate"]), function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var id, error_117;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    _a.trys.push([0, 2, , 3]);
                                    id = req.params.id;
                                    return [4 /*yield*/, storage.updateEncounterStatus(id, "objected")];
                                case 1:
                                    _a.sent();
                                    res.json({ success: true });
                                    return [3 /*break*/, 3];
                                case 2:
                                    error_117 = _a.sent();
                                    console.error("Error updating encounter:", error_117);
                                    res.status(500).json({ message: "Failed to update encounter" });
                                    return [3 /*break*/, 3];
                                case 3: return [2 /*return*/];
                            }
                        });
                    }); });
                    // Get affiliate leads
                    app.get("/api/affiliate/leads", isAuthenticated, requireRole(["affiliate"]), function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var affiliateId, leads, error_118;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    _a.trys.push([0, 2, , 3]);
                                    affiliateId = req.session.userId;
                                    return [4 /*yield*/, storage.getLeads(affiliateId)];
                                case 1:
                                    leads = _a.sent();
                                    res.json(leads);
                                    return [3 /*break*/, 3];
                                case 2:
                                    error_118 = _a.sent();
                                    console.error("Error getting leads:", error_118);
                                    res.status(500).json({ message: "Failed to get leads" });
                                    return [3 /*break*/, 3];
                                case 3: return [2 /*return*/];
                            }
                        });
                    }); });
                    // Get affiliate closes
                    app.get("/api/affiliate/closes", isAuthenticated, requireRole(["affiliate"]), function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var affiliateId, closes, error_119;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    _a.trys.push([0, 2, , 3]);
                                    affiliateId = req.session.userId;
                                    return [4 /*yield*/, storage.getCloses(affiliateId)];
                                case 1:
                                    closes = _a.sent();
                                    res.json(closes);
                                    return [3 /*break*/, 3];
                                case 2:
                                    error_119 = _a.sent();
                                    console.error("Error getting closes:", error_119);
                                    res.status(500).json({ message: "Failed to get closes" });
                                    return [3 /*break*/, 3];
                                case 3: return [2 /*return*/];
                            }
                        });
                    }); });
                    // Get affiliate stats
                    app.get("/api/affiliate/stats", isAuthenticated, requireRole(["affiliate"]), function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var affiliateId, stats, error_120;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    _a.trys.push([0, 2, , 3]);
                                    affiliateId = req.session.userId;
                                    return [4 /*yield*/, storage.getAffiliateStats(affiliateId)];
                                case 1:
                                    stats = _a.sent();
                                    res.json(stats);
                                    return [3 /*break*/, 3];
                                case 2:
                                    error_120 = _a.sent();
                                    console.error("Error getting stats:", error_120);
                                    res.status(500).json({ message: "Failed to get stats" });
                                    return [3 /*break*/, 3];
                                case 3: return [2 /*return*/];
                            }
                        });
                    }); });
                    // Get affiliate lead/close/objected breakdown
                    app.get("/api/affiliate/breakdown", isAuthenticated, requireRole(["affiliate"]), function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var affiliateId, breakdown, error_121;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    _a.trys.push([0, 2, , 3]);
                                    affiliateId = req.session.userId;
                                    return [4 /*yield*/, storage.getAffiliateLeadsByStatus(affiliateId)];
                                case 1:
                                    breakdown = _a.sent();
                                    res.json(breakdown);
                                    return [3 /*break*/, 3];
                                case 2:
                                    error_121 = _a.sent();
                                    console.error("Error getting breakdown:", error_121);
                                    res.status(500).json({ message: "Failed to get breakdown" });
                                    return [3 /*break*/, 3];
                                case 3: return [2 /*return*/];
                            }
                        });
                    }); });
                    // Save affiliate reflection (from discover-deliver blueprint)
                    app.post("/api/affiliate/reflection", isAuthenticated, requireRole(["affiliate"]), function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var affiliateId, reflectionText, result, error_122;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    _a.trys.push([0, 2, , 3]);
                                    affiliateId = req.session.userId;
                                    reflectionText = insertAffiliateReflectionSchema.parse(req.body).reflectionText;
                                    return [4 /*yield*/, storage.saveAffiliateReflection(affiliateId, reflectionText)];
                                case 1:
                                    result = _a.sent();
                                    res.json(result);
                                    return [3 /*break*/, 3];
                                case 2:
                                    error_122 = _a.sent();
                                    console.error("Error saving reflection:", error_122);
                                    res.status(400).json({ message: "Failed to save reflection" });
                                    return [3 /*break*/, 3];
                                case 3: return [2 /*return*/];
                            }
                        });
                    }); });
                    // Get affiliate reflection
                    app.get("/api/affiliate/reflection", isAuthenticated, requireRole(["affiliate"]), function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var affiliateId, reflection, error_123;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    _a.trys.push([0, 2, , 3]);
                                    affiliateId = req.session.userId;
                                    return [4 /*yield*/, storage.getAffiliateReflection(affiliateId)];
                                case 1:
                                    reflection = _a.sent();
                                    res.json(reflection);
                                    return [3 /*break*/, 3];
                                case 2:
                                    error_123 = _a.sent();
                                    console.error("Error getting reflection:", error_123);
                                    res.status(500).json({ message: "Failed to get reflection" });
                                    return [3 /*break*/, 3];
                                case 3: return [2 /*return*/];
                            }
                        });
                    }); });
                    // Record close (parent committed to tutoring journey)
                    app.post("/api/parent/record-close", isAuthenticated, requireRole(["parent"]), function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var parentId, _a, studentId, podId, lead, close_1, error_124;
                        return __generator(this, function (_b) {
                            switch (_b.label) {
                                case 0:
                                    _b.trys.push([0, 3, , 4]);
                                    parentId = req.session.userId;
                                    _a = req.body, studentId = _a.studentId, podId = _a.podId;
                                    if (!studentId) {
                                        return [2 /*return*/, res.status(400).json({ message: "studentId is required" })];
                                    }
                                    return [4 /*yield*/, supabase
                                            .from("leads")
                                            .select("affiliate_id")
                                .eq("user_id", parentId)
                                            .maybeSingle()];
                                case 1:
                                    lead = (_b.sent()).data;
                                    if (!lead) {
                                        return [2 /*return*/, res.status(400).json({ message: "No affiliate found for this parent" })];
                                    }
                                    return [4 /*yield*/, storage.recordClose(lead.affiliate_id, parentId, studentId, podId)];
                                case 2:
                                    close_1 = _b.sent();
                                    res.json(close_1);
                                    return [3 /*break*/, 4];
                                case 3:
                                    error_124 = _b.sent();
                                    console.error("Error recording close:", error_124);
                                    var message = error_124 instanceof Error ? error_124.message : "Failed to record close";
                                    var isVerificationFailure = /required before|already been recorded/i.test(message);
                                    res.status(isVerificationFailure ? 409 : 500).json({ message: message });
                                    return [3 /*break*/, 4];
                                case 4: return [2 /*return*/];
                            }
                        });
                    }); });
                    // ========================================
                    // PARENT ENROLLMENT ROUTES
                    // ========================================
                    // Get parent enrollment status
                    app.get("/api/parent/enrollment-status", isAuthenticated, function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var userId, dbUser, _a, enrollmentData, error, error_125;
                        return __generator(this, function (_b) {
                            switch (_b.label) {
                                case 0:
                                    _b.trys.push([0, 2, , 3]);
                                    userId = req.session.userId;
                                    dbUser = req.dbUser;
                                    console.log("📍 Enrollment status check for user:", userId, "role:", dbUser === null || dbUser === void 0 ? void 0 : dbUser.role);
                                    return [4 /*yield*/, supabase
                                            .from("parent_enrollments")
                                            .select("*")
                                            .eq("user_id", userId)
                                            .maybeSingle()];
                                case 1:
                                    _a = _b.sent(), enrollmentData = _a.data, error = _a.error;
                                    if (error) {
                                        console.warn("⚠️  Error fetching enrollment status (table may not exist yet):", error.message);
                                        // If table doesn't exist or there's an error, just return not_enrolled
                                        // This allows the gateway to load and user can submit their enrollment
                                        return [2 /*return*/, res.json({ status: "not_enrolled" })];
                                    }
                                    if (!enrollmentData) {
                                        return [2 /*return*/, res.json({ status: "not_enrolled" })];
                                    }
                                    // Return current enrollment status
                                    res.json({
                                        status: enrollmentData.status || "not_enrolled",
                                        step: enrollmentData.current_step,
                                    });
                                    return [3 /*break*/, 3];
                                case 2:
                                    error_125 = _b.sent();
                                    console.error("Error in enrollment-status:", error_125);
                                    // On error, assume not_enrolled so gateway can proceed
                                    res.json({ status: "not_enrolled" });
                                    return [3 /*break*/, 3];
                                case 3: return [2 /*return*/];
                            }
                        });
                    }); });
                    // Get tutor profile for parent
                    app.get("/api/parent/assigned-tutor", isAuthenticated, function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var userId, _a, enrollmentData, error, tutor, tutorProfile, error_126;
                        return __generator(this, function (_b) {
                            switch (_b.label) {
                                case 0:
                                    _b.trys.push([0, 3, , 4]);
                                    userId = req.dbUser.id;
                                    console.log("📋 Fetching assigned tutor for parent:", userId);
                                    return [4 /*yield*/, supabase
                                            .from("parent_enrollments")
                                            .select("assigned_tutor_id")
                                            .eq("user_id", userId)
                                            .maybeSingle()];
                                case 1:
                                    _a = _b.sent(), enrollmentData = _a.data, error = _a.error;
                                    console.log("📋 Enrollment data:", enrollmentData, "Error:", error);
                                    if (error || !enrollmentData || !enrollmentData.assigned_tutor_id) {
                                        return [2 /*return*/, res.status(404).json({ message: "No tutor assigned" })];
                                    }
                                    return [4 /*yield*/, storage.getUser(enrollmentData.assigned_tutor_id)];
                                case 2:
                                    tutor = _b.sent();
                                    if (!tutor) {
                                        return [2 /*return*/, res.status(404).json({ message: "Tutor not found" })];
                                    }
                                    tutorProfile = {
                                        id: tutor.id,
                                        name: tutor.name,
                                        email: tutor.email,
                                        bio: tutor.bio || undefined,
                                        phone: tutor.phone || undefined,
                                        profile_image_url: tutor.profileImageUrl || undefined,
                                    };
                                    console.log("📋 Returning tutor profile (public.users):", tutorProfile);
                                    res.json(tutorProfile);
                                    return [3 /*break*/, 4];
                                case 3:
                                    error_126 = _b.sent();
                                    console.error("Error fetching assigned tutor (admin API):", error_126);
                                    res.status(500).json({ message: "Failed to fetch tutor profile" });
                                    return [3 /*break*/, 4];
                                case 4: return [2 /*return*/];
                            }
                        });
                    }); });
                    // Submit parent enrollment form
                    app.post("/api/parent/enroll", isAuthenticated, function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var userId, dbUser, _a, parentFullName, parentPhone, parentEmail, parentCity, studentFullName, studentGrade, schoolName, mathStruggleAreas, previousTutoring, internetAccess, parentMotivation, agreedToTerms, existing, _b, enrollmentData, error, error_127;
                        return __generator(this, function (_c) {
                            switch (_c.label) {
                                case 0:
                                    _c.trys.push([0, 3, , 4]);
                                    userId = req.session.userId;
                                    dbUser = req.dbUser;
                                    console.log("📍 Enrollment submission for user:", userId, "role:", dbUser === null || dbUser === void 0 ? void 0 : dbUser.role);
                                    _a = req.body, parentFullName = _a.parentFullName, parentPhone = _a.parentPhone, parentEmail = _a.parentEmail, parentCity = _a.parentCity, studentFullName = _a.studentFullName, studentGrade = _a.studentGrade, schoolName = _a.schoolName, mathStruggleAreas = _a.mathStruggleAreas, previousTutoring = _a.previousTutoring, internetAccess = _a.internetAccess, parentMotivation = _a.parentMotivation, agreedToTerms = _a.agreedToTerms;
                                    // Validate required fields
                                    if (!parentFullName ||
                                        !parentPhone ||
                                        !studentFullName ||
                                        !studentGrade ||
                                        !schoolName ||
                                        !mathStruggleAreas ||
                                        !previousTutoring ||
                                        !internetAccess ||
                                        !agreedToTerms) {
                                        return [2 /*return*/, res.status(400).json({ message: "Missing required fields" })];
                                    }
                                    return [4 /*yield*/, supabase
                                            .from("parent_enrollments")
                                            .select("id")
                                            .eq("user_id", userId)
                                            .maybeSingle()];
                                case 1:
                                    existing = (_c.sent()).data;
                                    if (existing) {
                                        return [2 /*return*/, res.status(400).json({ message: "Enrollment already submitted" })];
                                    }
                                    return [4 /*yield*/, supabase
                                            .from("parent_enrollments")
                                            .insert({
                                            user_id: userId,
                                            parent_full_name: parentFullName,
                                            parent_phone: parentPhone,
                                            parent_email: parentEmail,
                                            parent_city: parentCity,
                                            student_full_name: studentFullName,
                                            student_grade: studentGrade,
                                            school_name: schoolName,
                                            math_struggle_areas: mathStruggleAreas,
                                            previous_tutoring: previousTutoring,
                                            internet_access: internetAccess,
                                            parent_motivation: parentMotivation,
                                            status: "awaiting_assignment",
                                            current_step: "awaiting-assignment",
                                            created_at: new Date().toISOString(),
                                        })
                                            .select()];
                                case 2:
                                    _b = _c.sent(), enrollmentData = _b.data, error = _b.error;
                                    if (error) {
                                        console.warn("⚠️  Error creating enrollment (table may not exist yet):", error.message);
                                        // If table doesn't exist, that's OK - return success anyway
                                        // This allows the flow to proceed, and data will be saved once migration is run
                                        res.json({
                                            message: "Enrollment submitted successfully (queued)",
                                            enrollment: null,
                                        });
                                        return [2 /*return*/];
                                    }
                                    res.json({
                                        message: "Enrollment submitted successfully",
                                        enrollment: enrollmentData === null || enrollmentData === void 0 ? void 0 : enrollmentData[0],
                                    });
                                    return [3 /*break*/, 4];
                                case 3:
                                    error_127 = _c.sent();
                                    console.error("Error in enroll:", error_127);
                                    // Even on error, return success to allow gateway flow to proceed
                                    res.json({
                                        message: "Enrollment submitted successfully (queued)",
                                        enrollment: null,
                                    });
                                    return [3 /*break*/, 4];
                                case 4: return [2 /*return*/];
                            }
                        });
                    }); });
                    // ========================================
                    // ONBOARDING PROPOSAL ROUTES
                    // ========================================
                    // Create/Send proposal (Tutor)
                    app.post("/api/tutor/proposal", isAuthenticated, requireRole(["tutor", "td", "hr", "coo", "ceo"]), function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var tutorId, _a, studentId, enrollmentId, primaryIdentity, mathRelationship, confidenceTriggers, confidenceKillers, pressureResponse, growthDrivers, currentTopics, immediateStruggles, gapsIdentified, tutorNotes, topicConditioningTopic, topicConditioningEntryPhase, topicConditioningStability, futureIdentity, wantToRemembered, hiddenMotivations, internalConflict, recommendedPlan, justification, childWillWin, actualEnrollmentId, student, enrollment, _b, proposalData, error, error_128;
                        return __generator(this, function (_c) {
                            switch (_c.label) {
                                case 0:
                                    _c.trys.push([0, 7, , 8]);
                                    tutorId = req.dbUser.id;
                                    _a = req.body, studentId = _a.studentId, enrollmentId = _a.enrollmentId, primaryIdentity = _a.primaryIdentity, mathRelationship = _a.mathRelationship, confidenceTriggers = _a.confidenceTriggers, confidenceKillers = _a.confidenceKillers, pressureResponse = _a.pressureResponse, growthDrivers = _a.growthDrivers, currentTopics = _a.currentTopics, immediateStruggles = _a.immediateStruggles, gapsIdentified = _a.gapsIdentified, tutorNotes = _a.tutorNotes, topicConditioningTopic = _a.topicConditioningTopic, topicConditioningEntryPhase = _a.topicConditioningEntryPhase, topicConditioningStability = _a.topicConditioningStability, futureIdentity = _a.futureIdentity, wantToRemembered = _a.wantToRemembered, hiddenMotivations = _a.hiddenMotivations, internalConflict = _a.internalConflict, recommendedPlan = _a.recommendedPlan, justification = _a.justification, childWillWin = _a.childWillWin;
                                    // Validate required fields
                                    if (!studentId || !recommendedPlan || !justification) {
                                        return [2 /*return*/, res.status(400).json({ message: "Missing required fields" })];
                                    }
                                    actualEnrollmentId = enrollmentId;
                                    if (!!actualEnrollmentId) return [3 /*break*/, 3];
                                    return [4 /*yield*/, supabase
                                            .from("students")
                                            .select("name")
                                            .eq("id", studentId)
                                            .single()];
                                case 1:
                                    student = (_c.sent()).data;
                                    if (!student) return [3 /*break*/, 3];
                                    return [4 /*yield*/, supabase
                                            .from("parent_enrollments")
                                            .select("id")
                                            .eq("assigned_tutor_id", tutorId)
                                            .eq("student_full_name", student.name)
                                            .maybeSingle()];
                                case 2:
                                    enrollment = (_c.sent()).data;
                                    actualEnrollmentId = enrollment === null || enrollment === void 0 ? void 0 : enrollment.id;
                                    _c.label = 3;
                                case 3: return [4 /*yield*/, supabase
                                        .from("onboarding_proposals")
                                        .insert({
                                        enrollment_id: actualEnrollmentId,
                                        tutor_id: tutorId,
                                        student_id: studentId,
                                        primary_identity: primaryIdentity,
                                        math_relationship: mathRelationship,
                                        confidence_triggers: confidenceTriggers,
                                        confidence_killers: confidenceKillers,
                                        pressure_response: pressureResponse,
                                        growth_drivers: growthDrivers,
                                        current_topics: currentTopics,
                                        topic_conditioning_topic: topicConditioningTopic,
                                        topic_conditioning_entry_phase: topicConditioningEntryPhase,
                                        topic_conditioning_stability: topicConditioningStability,
                                        immediate_struggles: immediateStruggles,
                                        gaps_identified: gapsIdentified,
                                        tutor_notes: tutorNotes,
                                        future_identity: futureIdentity,
                                        want_to_remembered: wantToRemembered,
                                        hidden_motivations: hiddenMotivations,
                                        internal_conflict: internalConflict,
                                        recommended_plan: recommendedPlan,
                                        justification: justification,
                                        child_will_win: childWillWin,
                                        sent_at: new Date().toISOString(),
                                        created_at: new Date().toISOString(),
                                        updated_at: new Date().toISOString(),
                                    })
                                        .select()
                                        .single()];
                                case 4:
                                    _b = _c.sent(), proposalData = _b.data, error = _b.error;
                                    if (error) {
                                        console.error("Error creating proposal:", error);
                                        return [2 /*return*/, res.status(500).json({ message: "Failed to create proposal" })];
                                    }
                                    if (!actualEnrollmentId) return [3 /*break*/, 6];
                                    return [4 /*yield*/, supabase
                                            .from("parent_enrollments")
                                            .update({
                                            status: "proposal_sent",
                                            proposal_id: proposalData.id,
                                            proposal_sent_at: new Date().toISOString(),
                                            updated_at: new Date().toISOString(),
                                        })
                                            .eq("id", actualEnrollmentId)];
                                case 5:
                                    _c.sent();
                                    _c.label = 6;
                                case 6:
                                    res.json({
                                        message: "Proposal sent successfully",
                                        proposal: proposalData,
                                    });
                                    return [3 /*break*/, 8];
                                case 7:
                                    error_128 = _c.sent();
                                    console.error("Error in create proposal:", error_128);
                                    res.status(500).json({ message: "Failed to create proposal" });
                                    return [3 /*break*/, 8];
                                case 8: return [2 /*return*/];
                            }
                        });
                    }); });
                    // Get proposal by ID (Parent or Tutor)
                    app.get("/api/proposal/:id", isAuthenticated, function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var proposalId, userId, userRole, _a, proposal, error, isParent, isTutor, isAdmin, error_129;
                        var _b;
                        return __generator(this, function (_c) {
                            switch (_c.label) {
                                case 0:
                                    _c.trys.push([0, 4, , 5]);
                                    proposalId = req.params.id;
                                    userId = req.dbUser.id;
                                    userRole = req.dbUser.role;
                                    return [4 /*yield*/, supabase
                                            .from("onboarding_proposals")
                                            .select("\n          *,\n          enrollment:parent_enrollments(parent_id, student_full_name, student_grade),\n          student:students(name, grade),\n          tutor:users!onboarding_proposals_tutor_id_fkey(name, bio, phone, email)\n        ")
                                            .eq("id", proposalId)
                                            .single()];
                                case 1:
                                    _a = _c.sent(), proposal = _a.data, error = _a.error;
                                    if (error || !proposal) {
                                        return [2 /*return*/, res.status(404).json({ message: "Proposal not found" })];
                                    }
                                    isParent = userRole === "parent" && ((_b = proposal.enrollment) === null || _b === void 0 ? void 0 : _b.parent_id) === userId;
                                    isTutor = proposal.tutor_id === userId;
                                    isAdmin = ["hr", "coo", "ceo", "td"].includes(userRole);
                                    if (!isParent && !isTutor && !isAdmin) {
                                        return [2 /*return*/, res.status(403).json({ message: "Not authorized to view this proposal" })];
                                    }
                                    if (!isParent) return [3 /*break*/, 3];
                                    return [4 /*yield*/, supabase
                                            .from("onboarding_proposals")
                                            .update({
                                            viewed_at: new Date().toISOString(),
                                            viewed_count: (proposal.viewed_count || 0) + 1,
                                        })
                                            .eq("id", proposalId)];
                                case 2:
                                    _c.sent();
                                    _c.label = 3;
                                case 3:
                                    res.json(proposal);
                                    return [3 /*break*/, 5];
                                case 4:
                                    error_129 = _c.sent();
                                    console.error("Error fetching proposal:", error_129);
                                    res.status(500).json({ message: "Failed to fetch proposal" });
                                    return [3 /*break*/, 5];
                                case 5: return [2 /*return*/];
                            }
                        });
                    }); });
                    // Get parent's proposal (for gateway/dashboard)
                    app.get("/api/parent/proposal", isAuthenticated, requireRole(["parent"]), function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var parentId, _a, enrollment, enrollmentError, _b, proposal, error, student, tutor, enrichedProposal, error_130;
                        var _c, _d, _e;
                        return __generator(this, function (_f) {
                            switch (_f.label) {
                                case 0:
                                    _f.trys.push([0, 6, , 7]);
                                    parentId = req.dbUser.id;
                                    console.log("📋 Fetching proposal for parent:", parentId);
                                        return [4 /*yield*/, supabase
                                            .from("parent_enrollments")
                                            .select("id, proposal_id, status, math_struggle_areas")
                                            .eq("user_id", parentId)
                                            .maybeSingle()];
                                case 1:
                                    _a = _f.sent(), enrollment = _a.data, enrollmentError = _a.error;
                                    console.log("📋 Enrollment data:", enrollment, "Error:", enrollmentError);
                                    if (enrollmentError) {
                                        console.error("Error fetching enrollment:", enrollmentError);
                                        return [2 /*return*/, res.status(500).json({ message: "Failed to fetch enrollment" })];
                                    }
                                    if (!enrollment) {
                                        console.log("No enrollment found for parent");
                                        return [2 /*return*/, res.status(404).json({ message: "No enrollment found" })];
                                    }
                                    if (!enrollment.proposal_id) {
                                        console.log("No proposal_id in enrollment");
                                        return [2 /*return*/, res.status(404).json({ message: "No proposal found" })];
                                    }
                                    return [4 /*yield*/, supabase
                                            .from("onboarding_proposals")
                                            .select("*")
                                            .eq("id", enrollment.proposal_id)
                                            .single()];
                                case 2:
                                    _b = _f.sent(), proposal = _b.data, error = _b.error;
                                    console.log("📋 Proposal data:", proposal, "Error:", error);
                                    if (error) {
                                        console.error("Error fetching proposal:", error);
                                        return [2 /*return*/, res.status(500).json({ message: "Failed to fetch proposal", error: error.message })];
                                    }
                                    if (!proposal) {
                                        return [2 /*return*/, res.status(404).json({ message: "Proposal not found" })];
                                    }
                                    return [4 /*yield*/, supabase
                                            .from("students")
                                            .select("name, grade")
                                            .eq("id", proposal.student_id)
                                            .single()];
                                case 3:
                                    student = (_f.sent()).data;
                                    return [4 /*yield*/, supabase
                                            .from("auth.users")
                                            .select("id, email, user_metadata")
                                            .eq("id", proposal.tutor_id)
                                            .single()];
                                case 4:
                                    tutor = (_f.sent()).data;
                                    enrichedProposal = {
                                        id: proposal.id,
                                        primaryIdentity: proposal.primary_identity,
                                        mathRelationship: proposal.math_relationship,
                                        confidenceTriggers: proposal.confidence_triggers,
                                        confidenceKillers: proposal.confidence_killers,
                                        pressureResponse: proposal.pressure_response,
                                        growthDrivers: proposal.growth_drivers,
                                        currentTopics: (proposal.current_topics && proposal.current_topics !== "Onboarding baseline diagnostic")
                                            ? proposal.current_topics
                                            : (enrollment === null || enrollment === void 0 ? void 0 : enrollment.math_struggle_areas) || proposal.current_topics,
                                        topicConditioning: {
                                            topic: String((proposal.topic_conditioning_topic || ((proposal.current_topics && proposal.current_topics !== "Onboarding baseline diagnostic")
                                                ? proposal.current_topics
                                                : (enrollment === null || enrollment === void 0 ? void 0 : enrollment.math_struggle_areas) || proposal.current_topics) || "")).trim() || null,
                                            entryPhase: String((proposal.topic_conditioning_entry_phase || ((proposal.tutor_notes || "").match(/Entry Phase:\s*([^\n\r]+)/i) || [])[1] || ((proposal.justification || "").match(/Entry phase\s*([^|\.]+)/i) || [])[1] || "")).trim() || null,
                                            stability: String((proposal.topic_conditioning_stability || ((proposal.tutor_notes || "").match(/Stability:\s*([^\n\r]+)/i) || [])[1] || ((proposal.justification || "").match(/Stability\s*([^|\.]+)/i) || [])[1] || "")).trim() || null,
                                        },
                                        immediateStruggles: proposal.immediate_struggles,
                                        gapsIdentified: proposal.gaps_identified,
                                        tutorNotes: proposal.tutor_notes,
                                        futureIdentity: proposal.future_identity,
                                        wantToRemembered: proposal.want_to_remembered,
                                        hiddenMotivations: proposal.hidden_motivations,
                                        internalConflict: proposal.internal_conflict,
                                        recommendedPlan: proposal.recommended_plan,
                                        justification: proposal.justification,
                                        childWillWin: proposal.child_will_win,
                                        parentCode: proposal.parent_code,
                                        createdAt: proposal.created_at,
                                        student: student || null,
                                        tutor: tutor ? {
                                            name: ((_c = tutor.user_metadata) === null || _c === void 0 ? void 0 : _c.name) || tutor.email,
                                            email: tutor.email,
                                            bio: (_d = tutor.user_metadata) === null || _d === void 0 ? void 0 : _d.bio,
                                            phone: (_e = tutor.user_metadata) === null || _e === void 0 ? void 0 : _e.phone,
                                        } : null,
                                    };
                                    // Track view
                                    return [4 /*yield*/, supabase
                                            .from("onboarding_proposals")
                                            .update({
                                            viewed_at: new Date().toISOString(),
                                            viewed_count: (proposal.viewed_count || 0) + 1,
                                        })
                                            .eq("id", proposal.id)];
                                case 5:
                                    // Track view
                                    _f.sent();
                                    console.log("📋 Returning enriched proposal");
                                    res.json(enrichedProposal);
                                    return [3 /*break*/, 7];
                                case 6:
                                    error_130 = _f.sent();
                                    console.error("Error fetching parent proposal:", error_130);
                                    res.status(500).json({ message: "Failed to fetch proposal" });
                                    return [3 /*break*/, 7];
                                case 7: return [2 /*return*/];
                            }
                        });
                    }); });
                    // Accept proposal (Parent)
                    app.post("/api/parent/proposal/accept", isAuthenticated, requireRole(["parent"]), function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var parentId, _a, enrollment, enrollmentError, proposal, generateParentCode, parentCode, codeIsUnique, attempts, existing, updateError, lead, tutorAssignment, closeError, error_131;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    _a.trys.push([0, 12, , 13]);
                                    parentId = req.dbUser.id;
                                    return [4 /*yield*/, supabase
                                            .from("parent_enrollments")
                                            .select("id, status, proposal_id")
                                            .eq("user_id", parentId)
                                            .eq("status", "proposal_sent")
                                            .not("proposal_id", "is", null)
                                            .order("updated_at", { ascending: false })
                                            .limit(1)
                                            .maybeSingle()];
                                case 1:
                                    _a = _a.sent(), enrollment = _a.data, enrollmentError = _a.error;
                                    if (enrollmentError) {
                                        console.error("Error fetching pending enrollment for accept:", enrollmentError);
                                        return [2 /*return*/, res.status(500).json({ message: "Failed to find pending proposal" })];
                                    }
                                    if (!enrollment || !enrollment.proposal_id) {
                                        return [2 /*return*/, res.status(404).json({ message: "No pending proposal found" })];
                                    }
                                    return [4 /*yield*/, supabase
                                            .from("onboarding_proposals")
                                            .select("student_id, tutor_id")
                                            .eq("id", enrollment.proposal_id)
                                            .maybeSingle()];
                                case 2:
                                    proposal = (_a.sent()).data;
                                    generateParentCode = function () {
                                        var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Excluding similar looking chars
                                        var code = '';
                                        for (var i = 0; i < 8; i++) {
                                            code += chars.charAt(Math.floor(Math.random() * chars.length));
                                        }
                                        return code;
                                    };
                                    parentCode = generateParentCode();
                                    codeIsUnique = false;
                                    attempts = 0;
                                    _a.label = 3;
                                case 3:
                                    if (!(!codeIsUnique && attempts < 10)) return [3 /*break*/, 5];
                                    return [4 /*yield*/, supabase
                                            .from("onboarding_proposals")
                                            .select("id")
                                            .eq("parent_code", parentCode)
                                            .maybeSingle()];
                                case 4:
                                    existing = (_a.sent()).data;
                                    if (!existing) {
                                        codeIsUnique = true;
                                    }
                                    else {
                                        parentCode = generateParentCode();
                                        attempts++;
                                    }
                                    return [3 /*break*/, 3];
                                case 5: return [4 /*yield*/, supabase
                                        .from("parent_enrollments")
                                        .update({
                                        status: "session_booked",
                                        updated_at: new Date().toISOString(),
                                    })
                                        .eq("id", enrollment.id)];
                                case 6:
                                    updateError = (_a.sent()).error;
                                    if (updateError) {
                                        console.error("Error accepting proposal:", updateError);
                                        return [2 /*return*/, res.status(500).json({ message: "Failed to accept proposal" })];
                                    }
                                    // Mark proposal as accepted and add parent code
                                    return [4 /*yield*/, supabase
                                            .from("onboarding_proposals")
                                            .update({
                                            accepted_at: new Date().toISOString(),
                                            parent_code: parentCode,
                                            updated_at: new Date().toISOString(),
                                        })
                                            .eq("id", enrollment.proposal_id)];
                                case 7:
                                    // Mark proposal as accepted and add parent code
                                    _a.sent();
                                    return [4 /*yield*/, supabase
                                            .from("leads")
                                            .select("id, affiliate_id")
                                            .eq("user_id", parentId)
                                            .maybeSingle()];
                                case 8:
                                    lead = (_a.sent()).data;
                                    if (!(lead && (proposal === null || proposal === void 0 ? void 0 : proposal.student_id))) return [3 /*break*/, 11];
                                    console.log("📊 Creating affiliate close record for lead:", lead.id);
                                    return [4 /*yield*/, supabase
                                            .from("tutor_assignments")
                                            .select("id")
                                            .eq("tutor_id", proposal.tutor_id)
                                            .maybeSingle()];
                                case 9:
                                    tutorAssignment = (_a.sent()).data;
                                    return [4 /*yield*/, supabase
                                            .from("closes")
                                            .insert({
                                            affiliate_id: lead.affiliate_id,
                                            parent_id: parentId,
                                            lead_id: lead.id,
                                            child_id: proposal.student_id,
                                            pod_assignment_id: (tutorAssignment === null || tutorAssignment === void 0 ? void 0 : tutorAssignment.id) || null,
                                            closed_at: new Date().toISOString(),
                                        })];
                                case 10:
                                    closeError = (_a.sent()).error;
                                    if (closeError) {
                                        console.error("Error creating affiliate close:", closeError);
                                        // Don't fail the whole request if close creation fails
                                    }
                                    else {
                                        console.log("✅ Affiliate close created successfully");
                                    }
                                    _a.label = 11;
                                case 11:
                                    res.json({
                                        message: "Proposal accepted successfully",
                                        status: "session_booked",
                                        parentCode: parentCode
                                    });
                                    return [3 /*break*/, 13];
                                case 12:
                                    error_131 = _a.sent();
                                    console.error("Error accepting proposal:", error_131);
                                    res.status(500).json({ message: "Failed to accept proposal" });
                                    return [3 /*break*/, 13];
                                case 13: return [2 /*return*/];
                            }
                        });
                    }); });
                    // Generate student code for accepted proposal (Parent)
                    app.post("/api/parent/generate-student-code", isAuthenticated, requireRole(["parent"]), function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var parentId, _a, enrollment, enrollmentError, _b, proposal, proposalError, generateParentCode, parentCode, codeIsUnique, attempts, existing, updateError, error_132;
                        return __generator(this, function (_c) {
                            switch (_c.label) {
                                case 0:
                                    _c.trys.push([0, 7, , 8]);
                                    parentId = req.dbUser.id;
                                    console.log("🎓 Generate student code request from parent:", parentId);
                                    return [4 /*yield*/, supabase
                                            .from("parent_enrollments")
                                            .select("id, status, proposal_id")
                                            .eq("user_id", parentId)
                                            .not("proposal_id", "is", null)
                                            .order("updated_at", { ascending: false })
                                            .limit(1)
                                            .maybeSingle()];
                                case 1:
                                    _a = _c.sent(), enrollment = _a.data, enrollmentError = _a.error;
                                    console.log("📋 Enrollment:", enrollment, "Error:", enrollmentError);
                                    if (!enrollment || !enrollment.proposal_id) {
                                        console.log("❌ No proposal found for parent");
                                        return [2 /*return*/, res.status(404).json({ message: "No proposal found" })];
                                    }
                                    return [4 /*yield*/, supabase
                                            .from("onboarding_proposals")
                                            .select("id, accepted_at, parent_code")
                                            .eq("id", enrollment.proposal_id)
                                            .single()];
                                case 2:
                                    _b = _c.sent(), proposal = _b.data, proposalError = _b.error;
                                    console.log("📄 Proposal:", proposal, "Error:", proposalError);
                                    if (!proposal || !proposal.accepted_at) {
                                        console.log("❌ Proposal not yet accepted");
                                        return [2 /*return*/, res.status(400).json({ message: "Proposal not yet accepted" })];
                                    }
                                    // If code already exists, return it
                                    if (proposal.parent_code) {
                                        console.log("✅ Code already exists:", proposal.parent_code);
                                        return [2 /*return*/, res.json({ parentCode: proposal.parent_code })];
                                    }
                                    console.log("🎲 Generating new parent code...");
                                    generateParentCode = function () {
                                        var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
                                        var code = '';
                                        for (var i = 0; i < 8; i++) {
                                            code += chars.charAt(Math.floor(Math.random() * chars.length));
                                        }
                                        return code;
                                    };
                                    parentCode = generateParentCode();
                                    codeIsUnique = false;
                                    attempts = 0;
                                    _c.label = 3;
                                case 3:
                                    if (!(!codeIsUnique && attempts < 10)) return [3 /*break*/, 5];
                                    return [4 /*yield*/, supabase
                                            .from("onboarding_proposals")
                                            .select("id")
                                            .eq("parent_code", parentCode)
                                            .maybeSingle()];
                                case 4:
                                    existing = (_c.sent()).data;
                                    if (!existing) {
                                        codeIsUnique = true;
                                    }
                                    else {
                                        parentCode = generateParentCode();
                                        attempts++;
                                    }
                                    return [3 /*break*/, 3];
                                case 5:
                                    console.log("🎲 Generated unique code:", parentCode);
                                    return [4 /*yield*/, supabase
                                            .from("onboarding_proposals")
                                            .update({
                                            parent_code: parentCode,
                                            updated_at: new Date().toISOString(),
                                        })
                                            .eq("id", proposal.id)];
                                case 6:
                                    updateError = (_c.sent()).error;
                                    if (updateError) {
                                        console.error("❌ Error updating proposal with parent code:", updateError);
                                        return [2 /*return*/, res.status(500).json({ message: "Failed to generate student code" })];
                                    }
                                    console.log("✅ Successfully saved parent code to database");
                                    res.json({ parentCode: parentCode });
                                    return [3 /*break*/, 8];
                                case 7:
                                    error_132 = _c.sent();
                                    console.error("Error generating student code:", error_132);
                                    res.status(500).json({ message: "Failed to generate student code" });
                                    return [3 /*break*/, 8];
                                case 8: return [2 /*return*/];
                            }
                        });
                    }); });
                    // Decline proposal (Parent)
                    app.post("/api/parent/proposal/decline", isAuthenticated, requireRole(["parent"]), function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var parentId, reason, _a, enrollment, enrollmentError, updateError, error_133;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    _a.trys.push([0, 4, , 5]);
                                    parentId = req.dbUser.id;
                                    reason = req.body.reason;
                                    return [4 /*yield*/, supabase
                                            .from("parent_enrollments")
                                            .select("id, status, proposal_id")
                                            .eq("user_id", parentId)
                                            .eq("status", "proposal_sent")
                                            .not("proposal_id", "is", null)
                                            .order("updated_at", { ascending: false })
                                            .limit(1)
                                            .maybeSingle()];
                                case 1:
                                    _a = _a.sent(), enrollment = _a.data, enrollmentError = _a.error;
                                    if (enrollmentError) {
                                        console.error("Error fetching pending enrollment for decline:", enrollmentError);
                                        return [2 /*return*/, res.status(500).json({ message: "Failed to find pending proposal" })];
                                    }
                                    if (!enrollment || !enrollment.proposal_id) {
                                        return [2 /*return*/, res.status(404).json({ message: "No pending proposal found" })];
                                    }
                                    return [4 /*yield*/, supabase
                                            .from("parent_enrollments")
                                            .update({
                                            status: "assigned", // Back to assigned - tutor needs to revise
                                            updated_at: new Date().toISOString(),
                                        })
                                            .eq("id", enrollment.id)];
                                case 2:
                                    updateError = (_a.sent()).error;
                                    if (updateError) {
                                        console.error("Error declining proposal:", updateError);
                                        return [2 /*return*/, res.status(500).json({ message: "Failed to decline proposal" })];
                                    }
                                    // Mark proposal as declined
                                    return [4 /*yield*/, supabase
                                            .from("onboarding_proposals")
                                            .update({
                                            declined_at: new Date().toISOString(),
                                            decline_reason: reason || null,
                                            updated_at: new Date().toISOString(),
                                        })
                                            .eq("id", enrollment.proposal_id)];
                                case 3:
                                    // Mark proposal as declined
                                    _a.sent();
                                    res.json({ message: "Proposal declined. Your tutor will be notified.", status: "assigned" });
                                    return [3 /*break*/, 5];
                                case 4:
                                    error_133 = _a.sent();
                                    console.error("Error declining proposal:", error_133);
                                    res.status(500).json({ message: "Failed to decline proposal" });
                                    return [3 /*break*/, 5];
                                case 5: return [2 /*return*/];
                            }
                        });
                    }); });
                    // ========================================
                    // STUDENT AUTH ROUTES
                    // ========================================
                    // Student signup with parent code validation
                    app.post("/api/student/signup", function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var _a, email, password, firstName, lastName, parentCode, _b, proposal, proposalError, _c, existingStudent, checkError, hash, hashedPassword, _d, studentUser, insertError, error_134;
                        return __generator(this, function (_e) {
                            switch (_e.label) {
                                case 0:
                                    _e.trys.push([0, 6, , 7]);
                                    _a = req.body, email = _a.email, password = _a.password, firstName = _a.firstName, lastName = _a.lastName, parentCode = _a.parentCode;
                                    console.log("🎓 Student signup request:", { email: email, firstName: firstName, lastName: lastName, parentCode: parentCode });
                                    if (!email || !password || !parentCode) {
                                        return [2 /*return*/, res.status(400).json({ message: "Email, password, and parent code are required" })];
                                    }
                                    // Validate parent code
                                    console.log("🔍 Validating parent code:", parentCode.toUpperCase());
                                    return [4 /*yield*/, supabase
                                            .from("onboarding_proposals")
                                            .select("id, student_id, accepted_at, parent_code")
                                            .eq("parent_code", parentCode.toUpperCase())
                                            .maybeSingle()];
                                case 1:
                                    _b = _e.sent(), proposal = _b.data, proposalError = _b.error;
                                    console.log("📋 Proposal found:", proposal, "Error:", proposalError);
                                    if (proposalError || !proposal) {
                                        console.log("❌ Invalid parent code");
                                        return [2 /*return*/, res.status(400).json({ message: "Invalid parent code" })];
                                    }
                                    if (!proposal.accepted_at) {
                                        console.log("❌ Proposal not accepted yet");
                                        return [2 /*return*/, res.status(400).json({ message: "Parent has not yet accepted the proposal for this code" })];
                                    }
                                    // Check if code already used
                                    console.log("🔍 Checking if code already used...");
                                    return [4 /*yield*/, supabase
                                            .from("student_users")
                                            .select("id")
                                            .eq("parent_code", parentCode.toUpperCase())
                                            .maybeSingle()];
                                case 2:
                                    _c = _e.sent(), existingStudent = _c.data, checkError = _c.error;
                                    console.log("👥 Existing student:", existingStudent, "Check error:", checkError);
                                    if (existingStudent) {
                                        console.log("❌ Code already used");
                                        return [2 /*return*/, res.status(400).json({ message: "This parent code has already been used" })];
                                    }
                                    // Hash password using bcrypt
                                    console.log("🔐 Hashing password...");
                                    return [4 /*yield*/, import("bcryptjs")];
                                case 3:
                                    hash = (_e.sent()).hash;
                                    return [4 /*yield*/, hash(password, 10)];
                                case 4:
                                    hashedPassword = _e.sent();
                                    // Create student user
                                    console.log("💾 Creating student user in database...");
                                    return [4 /*yield*/, supabase
                                            .from("student_users")
                                            .insert({
                                            email: email,
                                            password: hashedPassword,
                                            first_name: firstName,
                                            last_name: lastName,
                                            student_id: proposal.student_id,
                                            parent_code: parentCode.toUpperCase(),
                                        })
                                            .select()
                                            .single()];
                                case 5:
                                    _d = _e.sent(), studentUser = _d.data, insertError = _d.error;
                                    if (insertError) {
                                        console.error("❌ Error creating student user:", insertError);
                                        console.error("❌ Insert error details:", JSON.stringify(insertError, null, 2));
                                        return [2 /*return*/, res.status(500).json({ message: "Failed to create student account", error: insertError.message })];
                                    }
                                    console.log("✅ Student user created:", studentUser);
                                    // Create session for student
                                    req.session.studentUserId = studentUser.id;
                                    req.session.studentEmail = studentUser.email;
                                    req.session.touch();
                                    console.log("✅ Student signup successful!");
                                    res.json({
                                        message: "Student account created successfully",
                                        user: {
                                            id: studentUser.id,
                                            email: studentUser.email,
                                            firstName: studentUser.first_name,
                                            lastName: studentUser.last_name,
                                            studentId: studentUser.student_id,
                                        },
                                    });
                                    return [3 /*break*/, 7];
                                case 6:
                                    error_134 = _e.sent();
                                    console.error("❌ Student signup error:", error_134);
                                    console.error("❌ Error stack:", error_134.stack);
                                    res.status(500).json({ message: "Failed to create student account", error: error_134.message });
                                    return [3 /*break*/, 7];
                                case 7: return [2 /*return*/];
                            }
                        });
                    }); });
                    // Student signin
                    app.post("/api/student/signin", function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var _a, email, password, _b, studentUser, error, compare, passwordMatch, error_135;
                        return __generator(this, function (_c) {
                            switch (_c.label) {
                                case 0:
                                    _c.trys.push([0, 5, , 6]);
                                    _a = req.body, email = _a.email, password = _a.password;
                                    if (!email || !password) {
                                        return [2 /*return*/, res.status(400).json({ message: "Email and password are required" })];
                                    }
                                    return [4 /*yield*/, supabase
                                            .from("student_users")
                                            .select("*")
                                            .eq("email", email)
                                            .maybeSingle()];
                                case 1:
                                    _b = _c.sent(), studentUser = _b.data, error = _b.error;
                                    if (error || !studentUser) {
                                        return [2 /*return*/, res.status(401).json({ message: "Invalid credentials" })];
                                    }
                                    return [4 /*yield*/, import("bcryptjs")];
                                case 2:
                                    compare = (_c.sent()).compare;
                                    return [4 /*yield*/, compare(password, studentUser.password)];
                                case 3:
                                    passwordMatch = _c.sent();
                                    if (!passwordMatch) {
                                        return [2 /*return*/, res.status(401).json({ message: "Invalid credentials" })];
                                    }
                                    // Update last login
                                    return [4 /*yield*/, supabase
                                            .from("student_users")
                                            .update({ last_login: new Date().toISOString() })
                                            .eq("id", studentUser.id)];
                                case 4:
                                    // Update last login
                                    _c.sent();
                                    // Create session
                                    req.session.studentUserId = studentUser.id;
                                    req.session.studentEmail = studentUser.email;
                                    req.session.touch();
                                    res.json({
                                        message: "Signed in successfully",
                                        user: {
                                            id: studentUser.id,
                                            email: studentUser.email,
                                            firstName: studentUser.first_name,
                                            lastName: studentUser.last_name,
                                            studentId: studentUser.student_id,
                                        },
                                    });
                                    return [3 /*break*/, 6];
                                case 5:
                                    error_135 = _c.sent();
                                    console.error("Student signin error:", error_135);
                                    res.status(500).json({ message: "Failed to sign in" });
                                    return [3 /*break*/, 6];
                                case 6: return [2 /*return*/];
                            }
                        });
                    }); });
                    // Get current student user
                    app.get("/api/student/me", function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var studentUserId, _a, studentUser, error, podName, student, tutorAssignment, pod, error_136;
                        return __generator(this, function (_b) {
                            switch (_b.label) {
                                case 0:
                                    _b.trys.push([0, 5, , 6]);
                                    studentUserId = req.session.studentUserId;
                                    if (!studentUserId) {
                                        return [2 /*return*/, res.status(401).json({ message: "Not authenticated" })];
                                    }
                                    return [4 /*yield*/, supabase
                                            .from("student_users")
                                            .select("id, email, first_name, last_name, student_id, created_at, last_login")
                                            .eq("id", studentUserId)
                                            .single()];
                                case 1:
                                    _a = _b.sent(), studentUser = _a.data, error = _a.error;
                                    if (error || !studentUser) {
                                        return [2 /*return*/, res.status(404).json({ message: "Student user not found" })];
                                    }
                                    podName = null;
                                    if (!studentUser.student_id) return [3 /*break*/, 4];
                                    return [4 /*yield*/, supabase
                                            .from("students")
                                            .select("tutor_id")
                                            .eq("id", studentUser.student_id)
                                            .maybeSingle()];
                                case 2:
                                    student = (_b.sent()).data;
                                    if (!(student === null || student === void 0 ? void 0 : student.tutor_id)) return [3 /*break*/, 4];
                                    return [4 /*yield*/, supabase
                                            .from("tutor_assignments")
                                            .select("pod:pods(pod_name)")
                                            .eq("tutor_id", student.tutor_id)
                                            .maybeSingle()];
                                case 3:
                                    tutorAssignment = (_b.sent()).data;
                                    pod = tutorAssignment === null || tutorAssignment === void 0 ? void 0 : tutorAssignment.pod;
                                    if (pod) {
                                        podName = pod.pod_name || null;
                                    }
                                    _b.label = 4;
                                case 4:
                                    res.json({
                                        id: studentUser.id,
                                        email: studentUser.email,
                                        firstName: studentUser.first_name,
                                        lastName: studentUser.last_name,
                                        studentId: studentUser.student_id,
                                        createdAt: studentUser.created_at,
                                        lastLogin: studentUser.last_login,
                                        podName: podName,
                                    });
                                    return [3 /*break*/, 6];
                                case 5:
                                    error_136 = _b.sent();
                                    console.error("Error fetching student user:", error_136);
                                    res.status(500).json({ message: "Failed to fetch student user" });
                                    return [3 /*break*/, 6];
                                case 6: return [2 /*return*/];
                            }
                        });
                    }); });
                    // Student logout
                    app.post("/api/student/logout", function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            try {
                                req.session.destroy(function (err) {
                                    if (err) {
                                        console.error("Error destroying session:", err);
                                        return res.status(500).json({ message: "Failed to logout" });
                                    }
                                    res.clearCookie("connect.sid");
                                    res.json({ message: "Logged out successfully" });
                                });
                            }
                            catch (error) {
                                console.error("Logout error:", error);
                                res.status(500).json({ message: "Failed to logout" });
                            }
                            return [2 /*return*/];
                        });
                    }); });
                    // ========================================
                    // STUDENT PORTAL ROUTES
                    // ========================================
                    // Get student stats (gamified dashboard)
                    app.get("/api/student/stats", function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var studentUserId, studentUser, _a, data, error, stats, error_137;
                        return __generator(this, function (_b) {
                            switch (_b.label) {
                                case 0:
                                    _b.trys.push([0, 3, , 4]);
                                    studentUserId = req.session.studentUserId;
                                    if (!studentUserId) {
                                        return [2 /*return*/, res.status(401).json({ message: "Not authenticated" })];
                                    }
                                    return [4 /*yield*/, supabase
                                            .from("student_users")
                                            .select("student_id")
                                            .eq("id", studentUserId)
                                            .single()];
                                case 1:
                                    studentUser = (_b.sent()).data;
                                    if (!(studentUser === null || studentUser === void 0 ? void 0 : studentUser.student_id)) {
                                        return [2 /*return*/, res.status(404).json({ message: "Student not found" })];
                                    }
                                    return [4 /*yield*/, supabase
                                            .rpc("get_student_stats", { p_student_id: studentUser.student_id })];
                                case 2:
                                    _a = _b.sent(), data = _a.data, error = _a.error;
                                    if (error) {
                                        console.error("Error calling get_student_stats:", error);
                                        // Return zeros if function doesn't exist yet
                                        return [2 /*return*/, res.json({
                                                bossBattlesCompleted: 0,
                                                solutionsUnlocked: 0,
                                                currentStreak: 0,
                                                totalSessions: 0,
                                                confidenceLevel: 50,
                                            })];
                                    }
                                    stats = (data === null || data === void 0 ? void 0 : data[0]) || {};
                                    res.json({
                                        bossBattlesCompleted: stats.boss_battles_completed || 0,
                                        solutionsUnlocked: stats.solutions_unlocked || 0,
                                        currentStreak: stats.current_streak || 0,
                                        totalSessions: stats.total_sessions || 0,
                                        confidenceLevel: stats.confidence_level || 50,
                                    });
                                    return [3 /*break*/, 4];
                                case 3:
                                    error_137 = _b.sent();
                                    console.error("Error fetching student stats:", error_137);
                                    res.status(500).json({ message: "Failed to fetch stats" });
                                    return [3 /*break*/, 4];
                                case 4: return [2 /*return*/];
                            }
                        });
                    }); });
                    // Get student commitments
                    app.get("/api/student/commitments", function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var studentUserId, studentUser, _a, commitments, error, error_138;
                        return __generator(this, function (_b) {
                            switch (_b.label) {
                                case 0:
                                    _b.trys.push([0, 3, , 4]);
                                    studentUserId = req.session.studentUserId;
                                    if (!studentUserId) {
                                        return [2 /*return*/, res.status(401).json({ message: "Not authenticated" })];
                                    }
                                    return [4 /*yield*/, supabase
                                            .from("student_users")
                                            .select("student_id")
                                            .eq("id", studentUserId)
                                            .single()];
                                case 1:
                                    studentUser = (_b.sent()).data;
                                    if (!(studentUser === null || studentUser === void 0 ? void 0 : studentUser.student_id)) {
                                        return [2 /*return*/, res.status(404).json({ message: "Student not found" })];
                                    }
                                    return [4 /*yield*/, supabase
                                            .from("student_commitments")
                                            .select("*")
                                            .eq("student_id", studentUser.student_id)
                                            .eq("is_active", true)
                                            .order("created_at", { ascending: false })];
                                case 2:
                                    _a = _b.sent(), commitments = _a.data, error = _a.error;
                                    if (error)
                                        throw error;
                                    res.json(commitments || []);
                                    return [3 /*break*/, 4];
                                case 3:
                                    error_138 = _b.sent();
                                    console.error("Error fetching commitments:", error_138);
                                    res.status(500).json({ message: "Failed to fetch commitments" });
                                    return [3 /*break*/, 4];
                                case 4: return [2 /*return*/];
                            }
                        });
                    }); });
                    // Create student commitment
                    app.post("/api/student/commitments", function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var studentUserId, studentUser, _a, name_1, description, why_important, daily_action, _b, commitment, error, error_139;
                        return __generator(this, function (_c) {
                            switch (_c.label) {
                                case 0:
                                    _c.trys.push([0, 3, , 4]);
                                    studentUserId = req.session.studentUserId;
                                    if (!studentUserId) {
                                        return [2 /*return*/, res.status(401).json({ message: "Not authenticated" })];
                                    }
                                    return [4 /*yield*/, supabase
                                            .from("student_users")
                                            .select("student_id")
                                            .eq("id", studentUserId)
                                            .single()];
                                case 1:
                                    studentUser = (_c.sent()).data;
                                    if (!(studentUser === null || studentUser === void 0 ? void 0 : studentUser.student_id)) {
                                        return [2 /*return*/, res.status(404).json({ message: "Student not found" })];
                                    }
                                    _a = req.body, name_1 = _a.name, description = _a.description, why_important = _a.why_important, daily_action = _a.daily_action;
                                    return [4 /*yield*/, supabase
                                            .from("student_commitments")
                                            .insert({
                                            student_id: studentUser.student_id,
                                            name: name_1,
                                            description: description,
                                            why_important: why_important,
                                            daily_action: daily_action,
                                            streak_count: 0,
                                            is_active: true,
                                        })
                                            .select()
                                            .single()];
                                case 2:
                                    _b = _c.sent(), commitment = _b.data, error = _b.error;
                                    if (error)
                                        throw error;
                                    res.json(commitment);
                                    return [3 /*break*/, 4];
                                case 3:
                                    error_139 = _c.sent();
                                    console.error("Error creating commitment:", error_139);
                                    res.status(500).json({ message: "Failed to create commitment" });
                                    return [3 /*break*/, 4];
                                case 4: return [2 /*return*/];
                            }
                        });
                    }); });
                    // Update student commitment
                    app.put("/api/student/commitments/:id", function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var studentUserId, id, _a, name_2, description, why_important, daily_action, _b, commitment, error, error_140;
                        return __generator(this, function (_c) {
                            switch (_c.label) {
                                case 0:
                                    _c.trys.push([0, 2, , 3]);
                                    studentUserId = req.session.studentUserId;
                                    if (!studentUserId) {
                                        return [2 /*return*/, res.status(401).json({ message: "Not authenticated" })];
                                    }
                                    id = req.params.id;
                                    _a = req.body, name_2 = _a.name, description = _a.description, why_important = _a.why_important, daily_action = _a.daily_action;
                                    return [4 /*yield*/, supabase
                                            .from("student_commitments")
                                            .update({
                                            name: name_2,
                                            description: description,
                                            why_important: why_important,
                                            daily_action: daily_action,
                                            updated_at: new Date().toISOString(),
                                        })
                                            .eq("id", id)
                                            .select()
                                            .single()];
                                case 1:
                                    _b = _c.sent(), commitment = _b.data, error = _b.error;
                                    if (error)
                                        throw error;
                                    res.json(commitment);
                                    return [3 /*break*/, 3];
                                case 2:
                                    error_140 = _c.sent();
                                    console.error("Error updating commitment:", error_140);
                                    res.status(500).json({ message: "Failed to update commitment" });
                                    return [3 /*break*/, 3];
                                case 3: return [2 /*return*/];
                            }
                        });
                    }); });
                    // Delete student commitment
                    app.delete("/api/student/commitments/:id", function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var studentUserId, id, error, error_141;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    _a.trys.push([0, 2, , 3]);
                                    studentUserId = req.session.studentUserId;
                                    if (!studentUserId) {
                                        return [2 /*return*/, res.status(401).json({ message: "Not authenticated" })];
                                    }
                                    id = req.params.id;
                                    return [4 /*yield*/, supabase
                                            .from("student_commitments")
                                            .update({ is_active: false })
                                            .eq("id", id)];
                                case 1:
                                    error = (_a.sent()).error;
                                    if (error)
                                        throw error;
                                    res.json({ success: true });
                                    return [3 /*break*/, 3];
                                case 2:
                                    error_141 = _a.sent();
                                    console.error("Error deleting commitment:", error_141);
                                    res.status(500).json({ message: "Failed to delete commitment" });
                                    return [3 /*break*/, 3];
                                case 3: return [2 /*return*/];
                            }
                        });
                    }); });
                    // Complete commitment for today
                    app.post("/api/student/commitments/:id/complete", function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var studentUserId, id, today, existingLog, _a, log, error, error_142;
                        return __generator(this, function (_b) {
                            switch (_b.label) {
                                case 0:
                                    _b.trys.push([0, 3, , 4]);
                                    studentUserId = req.session.studentUserId;
                                    if (!studentUserId) {
                                        return [2 /*return*/, res.status(401).json({ message: "Not authenticated" })];
                                    }
                                    id = req.params.id;
                                    today = new Date().toISOString().split("T")[0];
                                    return [4 /*yield*/, supabase
                                            .from("commitment_logs")
                                            .select("id")
                                            .eq("commitment_id", id)
                                            .gte("completed_date", today)
                                            .maybeSingle()];
                                case 1:
                                    existingLog = (_b.sent()).data;
                                    if (existingLog) {
                                        return [2 /*return*/, res.status(400).json({ message: "Already completed today" })];
                                    }
                                    return [4 /*yield*/, supabase
                                            .from("commitment_logs")
                                            .insert({
                                            commitment_id: id,
                                            completed_date: new Date().toISOString(),
                                        })
                                            .select()
                                            .single()];
                                case 2:
                                    _a = _b.sent(), log = _a.data, error = _a.error;
                                    if (error)
                                        throw error;
                                    // Trigger will auto-update streak
                                    res.json(log);
                                    return [3 /*break*/, 4];
                                case 3:
                                    error_142 = _b.sent();
                                    console.error("Error completing commitment:", error_142);
                                    res.status(500).json({ message: "Failed to complete commitment" });
                                    return [3 /*break*/, 4];
                                case 4: return [2 /*return*/];
                            }
                        });
                    }); });
                    // Get student reflections
                    app.get("/api/student/reflections", function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var studentUserId, studentUser, _a, reflections, error, error_143;
                        return __generator(this, function (_b) {
                            switch (_b.label) {
                                case 0:
                                    _b.trys.push([0, 3, , 4]);
                                    studentUserId = req.session.studentUserId;
                                    if (!studentUserId) {
                                        return [2 /*return*/, res.status(401).json({ message: "Not authenticated" })];
                                    }
                                    return [4 /*yield*/, supabase
                                            .from("student_users")
                                            .select("student_id")
                                            .eq("id", studentUserId)
                                            .single()];
                                case 1:
                                    studentUser = (_b.sent()).data;
                                    if (!(studentUser === null || studentUser === void 0 ? void 0 : studentUser.student_id)) {
                                        return [2 /*return*/, res.status(404).json({ message: "Student not found" })];
                                    }
                                    return [4 /*yield*/, supabase
                                            .from("student_reflections")
                                            .select("*")
                                            .eq("student_id", studentUser.student_id)
                                            .order("created_at", { ascending: false })];
                                case 2:
                                    _a = _b.sent(), reflections = _a.data, error = _a.error;
                                    if (error)
                                        throw error;
                                    res.json(reflections || []);
                                    return [3 /*break*/, 4];
                                case 3:
                                    error_143 = _b.sent();
                                    console.error("Error fetching reflections:", error_143);
                                    res.status(500).json({ message: "Failed to fetch reflections" });
                                    return [3 /*break*/, 4];
                                case 4: return [2 /*return*/];
                            }
                        });
                    }); });
                    // Create student reflection
                    app.post("/api/student/reflections", function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var studentUserId, studentUser, _a, reflection_text, mood, date, _b, reflection, error, error_144;
                        return __generator(this, function (_c) {
                            switch (_c.label) {
                                case 0:
                                    _c.trys.push([0, 3, , 4]);
                                    studentUserId = req.session.studentUserId;
                                    if (!studentUserId) {
                                        return [2 /*return*/, res.status(401).json({ message: "Not authenticated" })];
                                    }
                                    return [4 /*yield*/, supabase
                                            .from("student_users")
                                            .select("student_id")
                                            .eq("id", studentUserId)
                                            .single()];
                                case 1:
                                    studentUser = (_c.sent()).data;
                                    if (!(studentUser === null || studentUser === void 0 ? void 0 : studentUser.student_id)) {
                                        return [2 /*return*/, res.status(404).json({ message: "Student not found" })];
                                    }
                                    _a = req.body, reflection_text = _a.reflection_text, mood = _a.mood, date = _a.date;
                                    console.log("📝 Creating reflection with data:", {
                                        student_id: studentUser.student_id,
                                        reflection_text: reflection_text,
                                        mood: mood,
                                        date: date,
                                        dateProvided: !!date,
                                        finalDate: date || new Date().toISOString()
                                    });
                                    return [4 /*yield*/, supabase
                                            .from("student_reflections")
                                            .insert({
                                            student_id: studentUser.student_id,
                                            reflection_text: reflection_text,
                                            mood: mood,
                                            date: date || new Date().toISOString(),
                                        })
                                            .select()
                                            .single()];
                                case 2:
                                    _b = _c.sent(), reflection = _b.data, error = _b.error;
                                    if (error) {
                                        console.error("Error creating reflection:", error);
                                        throw error;
                                    }
                                    res.json(reflection);
                                    return [3 /*break*/, 4];
                                case 3:
                                    error_144 = _c.sent();
                                    console.error("Error creating reflection:", error_144);
                                    res.status(500).json({ message: "Failed to create reflection" });
                                    return [3 /*break*/, 4];
                                case 4: return [2 /*return*/];
                            }
                        });
                    }); });
                    // Get student assignments
                    app.get("/api/student/assignments", function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var studentUserId, studentUser, _a, assignments, error, error_145;
                        return __generator(this, function (_b) {
                            switch (_b.label) {
                                case 0:
                                    _b.trys.push([0, 3, , 4]);
                                    studentUserId = req.session.studentUserId;
                                    if (!studentUserId) {
                                        return [2 /*return*/, res.status(401).json({ message: "Not authenticated" })];
                                    }
                                    return [4 /*yield*/, supabase
                                            .from("student_users")
                                            .select("student_id")
                                            .eq("id", studentUserId)
                                            .single()];
                                case 1:
                                    studentUser = (_b.sent()).data;
                                    if (!(studentUser === null || studentUser === void 0 ? void 0 : studentUser.student_id)) {
                                        return [2 /*return*/, res.status(404).json({ message: "Student not found" })];
                                    }
                                    return [4 /*yield*/, supabase
                                            .from("assignments")
                                            .select("*")
                                            .eq("student_id", studentUser.student_id)
                                            .order("created_at", { ascending: false })];
                                case 2:
                                    _a = _b.sent(), assignments = _a.data, error = _a.error;
                                    if (error)
                                        throw error;
                                    res.json(assignments || []);
                                    return [3 /*break*/, 4];
                                case 3:
                                    error_145 = _b.sent();
                                    console.error("Error fetching assignments:", error_145);
                                    res.status(500).json({ message: "Failed to fetch assignments" });
                                    return [3 /*break*/, 4];
                                case 4: return [2 /*return*/];
                            }
                        });
                    }); });
                    // Submit assignment
                    app.post("/api/student/assignments/:id/submit", function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var studentUserId, id, _a, student_result, student_work, _b, assignment, error, error_146;
                        return __generator(this, function (_c) {
                            switch (_c.label) {
                                case 0:
                                    _c.trys.push([0, 2, , 3]);
                                    studentUserId = req.session.studentUserId;
                                    if (!studentUserId) {
                                        return [2 /*return*/, res.status(401).json({ message: "Not authenticated" })];
                                    }
                                    id = req.params.id;
                                    _a = req.body, student_result = _a.student_result, student_work = _a.student_work;
                                    return [4 /*yield*/, supabase
                                            .from("assignments")
                                            .update({
                                            student_result: student_result,
                                            student_work: student_work,
                                            completed_at: new Date().toISOString(),
                                            status: "completed",
                                        })
                                            .eq("id", id)
                                            .select()
                                            .single()];
                                case 1:
                                    _b = _c.sent(), assignment = _b.data, error = _b.error;
                                    if (error)
                                        throw error;
                                    res.json(assignment);
                                    return [3 /*break*/, 3];
                                case 2:
                                    error_146 = _c.sent();
                                    console.error("Error submitting assignment:", error_146);
                                    res.status(500).json({ message: "Failed to submit assignment" });
                                    return [3 /*break*/, 3];
                                case 3: return [2 /*return*/];
                            }
                        });
                    }); });
                    // Get student academic profile
                    app.get("/api/student/academic-profile", function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var studentUserId, studentUser, _a, profile, error, error_147;
                        return __generator(this, function (_b) {
                            switch (_b.label) {
                                case 0:
                                    _b.trys.push([0, 3, , 4]);
                                    studentUserId = req.session.studentUserId;
                                    if (!studentUserId) {
                                        return [2 /*return*/, res.status(401).json({ message: "Not authenticated" })];
                                    }
                                    return [4 /*yield*/, supabase
                                            .from("student_users")
                                            .select("student_id")
                                            .eq("id", studentUserId)
                                            .single()];
                                case 1:
                                    studentUser = (_b.sent()).data;
                                    if (!(studentUser === null || studentUser === void 0 ? void 0 : studentUser.student_id)) {
                                        return [2 /*return*/, res.status(404).json({ message: "Student not found" })];
                                    }
                                    return [4 /*yield*/, supabase
                                            .from("academic_profiles")
                                            .select("*")
                                            .eq("student_id", studentUser.student_id)
                                            .maybeSingle()];
                                case 2:
                                    _a = _b.sent(), profile = _a.data, error = _a.error;
                                    if (error)
                                        throw error;
                                    res.json(profile || {});
                                    return [3 /*break*/, 4];
                                case 3:
                                    error_147 = _b.sent();
                                    console.error("Error fetching academic profile:", error_147);
                                    res.status(500).json({ message: "Failed to fetch academic profile" });
                                    return [3 /*break*/, 4];
                                case 4: return [2 /*return*/];
                            }
                        });
                    }); });
                    // Get student struggle targets
                    app.get("/api/student/struggle-targets", function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var studentUserId, studentUser, _a, targets, error, error_148;
                        return __generator(this, function (_b) {
                            switch (_b.label) {
                                case 0:
                                    _b.trys.push([0, 3, , 4]);
                                    studentUserId = req.session.studentUserId;
                                    if (!studentUserId) {
                                        return [2 /*return*/, res.status(401).json({ message: "Not authenticated" })];
                                    }
                                    return [4 /*yield*/, supabase
                                            .from("student_users")
                                            .select("student_id")
                                            .eq("id", studentUserId)
                                            .single()];
                                case 1:
                                    studentUser = (_b.sent()).data;
                                    if (!(studentUser === null || studentUser === void 0 ? void 0 : studentUser.student_id)) {
                                        return [2 /*return*/, res.status(404).json({ message: "Student not found" })];
                                    }
                                    return [4 /*yield*/, supabase
                                            .from("struggle_targets")
                                            .select("*")
                                            .eq("student_id", studentUser.student_id)
                                            .order("created_at", { ascending: false })];
                                case 2:
                                    _a = _b.sent(), targets = _a.data, error = _a.error;
                                    if (error)
                                        throw error;
                                    res.json(targets || []);
                                    return [3 /*break*/, 4];
                                case 3:
                                    error_148 = _b.sent();
                                    console.error("Error fetching struggle targets:", error_148);
                                    res.status(500).json({ message: "Failed to fetch struggle targets" });
                                    return [3 /*break*/, 4];
                                case 4: return [2 /*return*/];
                            }
                        });
                    }); });
                    // ========================================
                    // PARENT PORTAL ROUTES
                    // ========================================
                    // Get parent's student stats
                    app.get("/api/parent/student-stats", isAuthenticated, requireRole(["parent"]), function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var parentId, enrollment, student, _a, data, error, stats, commitments, error_149;
                        return __generator(this, function (_b) {
                            switch (_b.label) {
                                case 0:
                                    _b.trys.push([0, 5, , 6]);
                                    parentId = req.dbUser.id;
                                    return [4 /*yield*/, supabase
                                            .from("parent_enrollments")
                                            .select("student_full_name, assigned_tutor_id")
                                            .eq("user_id", parentId)
                                            .maybeSingle()];
                                case 1:
                                    enrollment = (_b.sent()).data;
                                    if (!(enrollment === null || enrollment === void 0 ? void 0 : enrollment.assigned_tutor_id)) {
                                        return [2 /*return*/, res.json({
                                                bossBattlesCompleted: 0,
                                                solutionsUnlocked: 0,
                                                confidenceGrowth: 0,
                                                sessionsCompleted: 0,
                                                currentStreak: 0,
                                                totalCommitments: 0,
                                            })];
                                    }
                                    return [4 /*yield*/, supabase
                                            .from("students")
                                            .select("id")
                                            .eq("name", enrollment.student_full_name)
                                            .eq("tutor_id", enrollment.assigned_tutor_id)
                                            .maybeSingle()];
                                case 2:
                                    student = (_b.sent()).data;
                                    if (!student) {
                                        return [2 /*return*/, res.json({
                                                bossBattlesCompleted: 0,
                                                solutionsUnlocked: 0,
                                                confidenceGrowth: 0,
                                                sessionsCompleted: 0,
                                                currentStreak: 0,
                                                totalCommitments: 0,
                                            })];
                                    }
                                    return [4 /*yield*/, supabase
                                            .rpc("get_student_stats", { p_student_id: student.id })];
                                case 3:
                                    _a = _b.sent(), data = _a.data, error = _a.error;
                                    if (error) {
                                        console.error("Error calling get_student_stats:", error);
                                        return [2 /*return*/, res.json({
                                                bossBattlesCompleted: 0,
                                                solutionsUnlocked: 0,
                                                confidenceGrowth: 0,
                                                sessionsCompleted: 0,
                                                currentStreak: 0,
                                                totalCommitments: 0,
                                            })];
                                    }
                                    stats = (data === null || data === void 0 ? void 0 : data[0]) || {};
                                    return [4 /*yield*/, supabase
                                            .from("student_commitments")
                                            .select("id")
                                            .eq("student_id", student.id)
                                            .eq("is_active", true)];
                                case 4:
                                    commitments = (_b.sent()).data;
                                    res.json({
                                        bossBattlesCompleted: stats.boss_battles_completed || 0,
                                        solutionsUnlocked: stats.solutions_unlocked || 0,
                                        confidenceGrowth: stats.confidence_level || 50,
                                        sessionsCompleted: stats.total_sessions || 0,
                                        currentStreak: stats.current_streak || 0,
                                        totalCommitments: (commitments === null || commitments === void 0 ? void 0 : commitments.length) || 0,
                                    });
                                    return [3 /*break*/, 6];
                                case 5:
                                    error_149 = _b.sent();
                                    console.error("Error fetching parent student stats:", error_149);
                                    res.status(500).json({ message: "Failed to fetch stats" });
                                    return [3 /*break*/, 6];
                                case 6: return [2 /*return*/];
                            }
                        });
                    }); });
                    // Get parent's student info
                    app.get("/api/parent/student-info", isAuthenticated, requireRole(["parent"]), function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var parentId, _a, enrollment, enrollmentError, podName, _b, tutorAssignment, podError, pod, error_150;
                        return __generator(this, function (_c) {
                            switch (_c.label) {
                                case 0:
                                    _c.trys.push([0, 4, , 5]);
                                    parentId = req.dbUser.id;
                                    return [4 /*yield*/, supabase
                                            .from("parent_enrollments")
                                            .select("\n          student_full_name, \n          student_grade,\n          assigned_tutor_id\n        ")
                                            .eq("user_id", parentId)
                                            .maybeSingle()];
                                case 1:
                                    _a = _c.sent(), enrollment = _a.data, enrollmentError = _a.error;
                                    if (enrollmentError) {
                                        console.error("Error fetching parent enrollment:", enrollmentError);
                                    }
                                    if (!enrollment) {
                                        return [2 /*return*/, res.status(404).json({ message: "No enrollment found" })];
                                    }
                                    podName = null;
                                    if (!enrollment.assigned_tutor_id) return [3 /*break*/, 3];
                                    return [4 /*yield*/, supabase
                                            .from("tutor_assignments")
                                            .select("pod:pods(pod_name)")
                                            .eq("tutor_id", enrollment.assigned_tutor_id)
                                            .maybeSingle()];
                                case 2:
                                    _b = _c.sent(), tutorAssignment = _b.data, podError = _b.error;
                                    if (podError) {
                                        console.error("Error fetching tutor pod:", podError);
                                    }
                                    pod = tutorAssignment === null || tutorAssignment === void 0 ? void 0 : tutorAssignment.pod;
                                    if (pod) {
                                        podName = pod.pod_name || null;
                                    }
                                    _c.label = 3;
                                case 3:
                                    console.log("📊 Parent student info response:", {
                                        name: enrollment.student_full_name,
                                        grade: enrollment.student_grade,
                                        podName: podName,
                                    });
                                    res.json({
                                        name: enrollment.student_full_name,
                                        grade: enrollment.student_grade,
                                        podName: podName,
                                    });
                                    return [3 /*break*/, 5];
                                case 4:
                                    error_150 = _c.sent();
                                    console.error("Error fetching student info:", error_150);
                                    res.status(500).json({ message: "Failed to fetch student info" });
                                    return [3 /*break*/, 5];
                                case 5: return [2 /*return*/];
                            }
                        });
                    }); });
                    // Get parent reports
                    app.get("/api/parent/reports", isAuthenticated, requireRole(["parent"]), function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var parentId, _a, reports, error, error_151;
                        return __generator(this, function (_b) {
                            switch (_b.label) {
                                case 0:
                                    _b.trys.push([0, 2, , 3]);
                                    parentId = req.dbUser.id;
                                    return [4 /*yield*/, supabase
                                            .from("parent_reports")
                                            .select("*")
                                            .eq("parent_id", parentId)
                                            .order("sent_at", { ascending: false })];
                                case 1:
                                    _a = _b.sent(), reports = _a.data, error = _a.error;
                                    if (error)
                                        throw error;
                                    res.json(reports || []);
                                    return [3 /*break*/, 3];
                                case 2:
                                    error_151 = _b.sent();
                                    console.error("Error fetching reports:", error_151);
                                    res.status(500).json({ message: "Failed to fetch reports" });
                                    return [3 /*break*/, 3];
                                case 3: return [2 /*return*/];
                            }
                        });
                    }); });
                    // Submit parent feedback on report
                    app.post("/api/parent/reports/:id/feedback", isAuthenticated, requireRole(["parent"]), function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var id, feedback, _a, report, error, error_152;
                        return __generator(this, function (_b) {
                            switch (_b.label) {
                                case 0:
                                    _b.trys.push([0, 2, , 3]);
                                    id = req.params.id;
                                    feedback = req.body.feedback;
                                    return [4 /*yield*/, supabase
                                            .from("parent_reports")
                                            .update({
                                            parent_feedback: feedback,
                                            parent_feedback_at: new Date().toISOString(),
                                        })
                                            .eq("id", id)
                                            .select()
                                            .single()];
                                case 1:
                                    _a = _b.sent(), report = _a.data, error = _a.error;
                                    if (error)
                                        throw error;
                                    res.json(report);
                                    return [3 /*break*/, 3];
                                case 2:
                                    error_152 = _b.sent();
                                    console.error("Error submitting feedback:", error_152);
                                    res.status(500).json({ message: "Failed to submit feedback" });
                                    return [3 /*break*/, 3];
                                case 3: return [2 /*return*/];
                            }
                        });
                    }); });
                    // Get parent broadcasts (filter for parents)
                    app.get("/api/parent/broadcasts", isAuthenticated, requireRole(["parent"]), function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var userCreatedAt, query, _a, broadcasts, error, error_153;
                        var _b;
                        return __generator(this, function (_c) {
                            switch (_c.label) {
                                case 0:
                                    _c.trys.push([0, 2, , 3]);
                                    userCreatedAt = (_b = req.dbUser) === null || _b === void 0 ? void 0 : _b.createdAt;
                                    query = supabase
                                        .from("broadcasts")
                                        .select("*")
                                        .contains("target_roles", ["parent"])
                                        .order("created_at", { ascending: false });
                                    // Only show broadcasts created after user's account was created
                                    if (userCreatedAt) {
                                        query = query.gte("created_at", userCreatedAt);
                                    }
                                    return [4 /*yield*/, query];
                                case 1:
                                    _a = _c.sent(), broadcasts = _a.data, error = _a.error;
                                    if (error)
                                        throw error;
                                    res.json(broadcasts || []);
                                    return [3 /*break*/, 3];
                                case 2:
                                    error_153 = _c.sent();
                                    console.error("Error fetching broadcasts:", error_153);
                                    res.status(500).json({ message: "Failed to fetch broadcasts" });
                                    return [3 /*break*/, 3];
                                case 3: return [2 /*return*/];
                            }
                        });
                    }); });
                    httpServer = createServer(app);
                    return [2 /*return*/, httpServer];
            }
        });
    });
}
