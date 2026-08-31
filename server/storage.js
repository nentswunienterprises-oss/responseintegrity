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
// ...existing imports...
import { affiliateCodes } from "../shared/schema.js";
// Create affiliate code
export function createAffiliateCode(_a) {
    return __awaiter(this, arguments, void 0, function (_b) {
        var affiliateId = _b.affiliateId, code = _b.code, type = _b.type, personName = _b.personName, entityName = _b.entityName, schoolType = _b.schoolType;
        return __generator(this, function (_c) {
            return [2 /*return*/, db.insert(affiliateCodes).values({
                    affiliate_id: affiliateId,
                    code: code,
                    type: type,
                    person_name: personName,
                    entity_name: entityName,
                    school_type: schoolType,
                    created_at: new Date(),
                })];
        });
    });
}
import { createClient } from "@supabase/supabase-js";
import { db } from "./db";
import { weeklyCheckIns } from "@shared/schema";
// Initialize Supabase client with service role key to bypass RLS
var supabaseUrl = process.env.SUPABASE_URL;
// Use service role key if available (bypasses RLS), fall back to anon key
var supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
export var supabase = createClient(supabaseUrl, supabaseKey);
// Helper function to transform snake_case to camelCase
function transformSnakeToCamel(obj) {
    if (!obj || typeof obj !== 'object')
        return obj;
    if (Array.isArray(obj))
        return obj.map(transformSnakeToCamel);
    var result = {};
    for (var key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            var camelKey = key.replace(/_([a-z])/g, function (_, letter) { return letter.toUpperCase(); });
            result[camelKey] = transformSnakeToCamel(obj[key]);
        }
    }
    return result;
}
var SupabaseStorage = /** @class */ (function () {
    function SupabaseStorage() {
        // Drizzle DB instance for direct queries (used for weekly check-ins, etc.)
        this.db = db;
        this.weeklyCheckIns = weeklyCheckIns;
        // Users
        // In-memory cache for the duration of a request (keyed by userId)
        this.__userCache = {};
    }
    SupabaseStorage.prototype.getUser = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            var start, _a, data, error, elapsed, user, validRoles, err_1;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        // Check in-memory cache first
                        if (this.__userCache[id]) {
                            console.log("[getUser] Returning cached user for id: ".concat(id));
                            return [2 /*return*/, this.__userCache[id]];
                        }
                        start = Date.now();
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, supabase
                                .from("users")
                                .select("id,email,first_name,last_name,phone,bio,profile_image_url,password,role,name,grade,school,verified,created_at,updated_at")
                                .eq("id", id)
                                .maybeSingle()];
                    case 2:
                        _a = _b.sent(), data = _a.data, error = _a.error;
                        elapsed = Date.now() - start;
                        console.log("[getUser] DB query for id: ".concat(id, " took ").concat(elapsed, "ms"));
                        if (error) {
                            console.error("❌ Error fetching user:", error);
                            return [2 /*return*/, undefined];
                        }
                        if (!data) {
                            return [2 /*return*/, undefined];
                        }
                        user = {
                            id: data.id,
                            email: data.email,
                            firstName: data.first_name,
                            lastName: data.last_name,
                            phone: data.phone,
                            bio: data.bio,
                            profileImageUrl: data.profile_image_url,
                            password: data.password,
                            role: data.role,
                            name: data.name,
                            grade: data.grade,
                            school: data.school,
                            verified: data.verified,
                            createdAt: data.created_at,
                            updatedAt: data.updated_at,
                        };
                        validRoles = ["parent", "student", "tutor", "td", "affiliate", "od", "coo", "hr", "ceo"];
                        if (!validRoles.includes(data.role)) {
                            console.error("❌ INVALID ROLE DETECTED:", data.role, "for user", id);
                            console.error("   Full user data:", JSON.stringify(data));
                        }
                        // Store in cache for this request
                        this.__userCache[id] = user;
                        return [2 /*return*/, user];
                    case 3:
                        err_1 = _b.sent();
                        console.error("Exception in getUser:", err_1);
                        return [2 /*return*/, undefined];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    SupabaseStorage.prototype.getUserByEmail = function (email) {
        return __awaiter(this, void 0, void 0, function () {
            var _a, data, error, user, validRoles, err_2;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, supabase
                                .from("users")
                                .select("id,email,first_name,last_name,phone,bio,profile_image_url,password,role,name,grade,school,verified,created_at,updated_at")
                                .eq("email", email)
                                .maybeSingle()];
                    case 1:
                        _a = _b.sent(), data = _a.data, error = _a.error;
                        if (error) {
                            console.error("❌ Error fetching user by email:", error);
                            return [2 /*return*/, undefined];
                        }
                        if (!data) {
                            return [2 /*return*/, undefined];
                        }
                        user = {
                            id: data.id,
                            email: data.email,
                            firstName: data.first_name,
                            lastName: data.last_name,
                            phone: data.phone,
                            bio: data.bio,
                            profileImageUrl: data.profile_image_url,
                            password: data.password,
                            role: data.role,
                            name: data.name,
                            grade: data.grade,
                            school: data.school,
                            verified: data.verified,
                            createdAt: data.created_at,
                            updatedAt: data.updated_at,
                        };
                        validRoles = ["parent", "student", "tutor", "td", "affiliate", "od", "coo", "hr", "ceo"];
                        if (!validRoles.includes(data.role)) {
                            console.error("❌ INVALID ROLE DETECTED:", data.role, "for email", email);
                            console.error("   Full user data:", JSON.stringify(data));
                        }
                        return [2 /*return*/, user];
                    case 2:
                        err_2 = _b.sent();
                        console.error("Exception in getUserByEmail:", err_2);
                        return [2 /*return*/, undefined];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    SupabaseStorage.prototype.getUsersByRole = function (role) {
        return __awaiter(this, void 0, void 0, function () {
            var data;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, supabase.from("users").select("id,email,first_name,last_name,phone,bio,profile_image_url,password,role,name,grade,school,verified,created_at,updated_at").eq("role", role)];
                    case 1:
                        data = (_a.sent()).data;
                        if (!data)
                            return [2 /*return*/, []];
                        // Transform snake_case to camelCase
                        return [2 /*return*/, data.map(function (d) { return ({
                                id: d.id,
                                email: d.email,
                                firstName: d.first_name,
                                lastName: d.last_name,
                                phone: d.phone,
                                bio: d.bio,
                                profileImageUrl: d.profile_image_url,
                                password: d.password,
                                role: d.role,
                                name: d.name,
                                grade: d.grade,
                                school: d.school,
                                verified: d.verified,
                                createdAt: d.created_at,
                                updatedAt: d.updated_at,
                            }); })];
                }
            });
        });
    };
    SupabaseStorage.prototype.upsertUser = function (user) {
        return __awaiter(this, void 0, void 0, function () {
            var _a, data, error;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, supabase
                            .from("users")
                            .upsert({
                            id: user.id,
                            email: user.email,
                            first_name: user.firstName,
                            last_name: user.lastName,
                            phone: user.phone,
                            bio: user.bio,
                            profile_image_url: user.profileImageUrl,
                            name: [user.firstName, user.lastName].filter(Boolean).join(" ") || "User",
                        })
                            .select("id,email,first_name,last_name,phone,bio,profile_image_url,password,role,name,grade,school,verified,created_at,updated_at")
                            .single()];
                    case 1:
                        _a = _b.sent(), data = _a.data, error = _a.error;
                        if (error)
                            throw new Error("Supabase error: ".concat(error.message));
                        if (!data)
                            throw new Error("Failed to upsert user");
                        // Transform snake_case to camelCase
                        return [2 /*return*/, {
                                id: data.id,
                                email: data.email,
                                firstName: data.first_name,
                                lastName: data.last_name,
                                phone: data.phone,
                                bio: data.bio,
                                profileImageUrl: data.profile_image_url,
                                password: data.password,
                                role: data.role,
                                name: data.name,
                                grade: data.grade,
                                school: data.school,
                                verified: data.verified,
                                createdAt: data.created_at,
                                updatedAt: data.updated_at,
                            }];
                }
            });
        });
    };
    SupabaseStorage.prototype.updateUserVerification = function (id, verified) {
        return __awaiter(this, void 0, void 0, function () {
            var data;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, supabase.from("users").update({ verified: verified, updated_at: new Date() }).eq("id", id).select("id,email,first_name,last_name,phone,bio,profile_image_url,password,role,name,grade,school,verified,created_at,updated_at").single()];
                    case 1:
                        data = (_a.sent()).data;
                        if (!data)
                            return [2 /*return*/, undefined];
                        // Transform snake_case to camelCase
                        return [2 /*return*/, {
                                id: data.id,
                                email: data.email,
                                firstName: data.first_name,
                                lastName: data.last_name,
                                phone: data.phone,
                                bio: data.bio,
                                profileImageUrl: data.profile_image_url,
                                password: data.password,
                                role: data.role,
                                name: data.name,
                                grade: data.grade,
                                school: data.school,
                                verified: data.verified,
                                createdAt: data.created_at,
                                updatedAt: data.updated_at,
                            }];
                }
            });
        });
    };
    SupabaseStorage.prototype.updateUserProfile = function (id, data) {
        return __awaiter(this, void 0, void 0, function () {
            var updateData, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        updateData = { updated_at: new Date() };
                        if (data.phone !== undefined)
                            updateData.phone = data.phone;
                        if (data.bio !== undefined)
                            updateData.bio = data.bio;
                        if (data.profileImageUrl !== undefined)
                            updateData.profile_image_url = data.profileImageUrl;
                        return [4 /*yield*/, supabase.from("users").update(updateData).eq("id", id).select("id,email,first_name,last_name,phone,bio,profile_image_url,password,role,name,grade,school,verified,created_at,updated_at").single()];
                    case 1:
                        result = (_a.sent()).data;
                        if (!result)
                            return [2 /*return*/, undefined];
                        // Transform snake_case to camelCase
                        return [2 /*return*/, {
                                id: result.id,
                                email: result.email,
                                firstName: result.first_name,
                                lastName: result.last_name,
                                phone: result.phone,
                                bio: result.bio,
                                profileImageUrl: result.profile_image_url,
                                password: result.password,
                                role: result.role,
                                name: result.name,
                                grade: result.grade,
                                school: result.school,
                                verified: result.verified,
                                createdAt: result.created_at,
                                updatedAt: result.updated_at,
                            }];
                }
            });
        });
    };
    // Pods
    SupabaseStorage.prototype.createPod = function (pod) {
        return __awaiter(this, void 0, void 0, function () {
            var dbPod, _a, data, error;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        console.log("💾 Inserting pod into database:", pod);
                        dbPod = {
                            pod_name: pod.podName,
                            pod_type: pod.podType,
                            phase: pod.phase,
                            td_id: pod.tdId,
                            status: pod.status,
                            start_date: pod.startDate,
                            end_date: pod.endDate,
                        };
                        return [4 /*yield*/, supabase.from("pods").insert(dbPod).select().single()];
                    case 1:
                        _a = _b.sent(), data = _a.data, error = _a.error;
                        if (error) {
                            console.error("❌ Supabase error creating pod:", error);
                            throw new Error("Failed to create pod: ".concat(error.message));
                        }
                        if (!data) {
                            console.error("❌ No data returned from pod creation");
                            throw new Error("Failed to create pod: No data returned");
                        }
                        console.log("✅ Pod created in database:", data);
                        return [2 /*return*/, data];
                }
            });
        });
    };
    SupabaseStorage.prototype.getPod = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            var data;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, supabase.from("pods").select("*").eq("id", id).maybeSingle()];
                    case 1:
                        data = (_a.sent()).data;
                        if (!data)
                            return [2 /*return*/, undefined];
                        // Transform snake_case to camelCase
                        return [2 /*return*/, {
                                id: data.id,
                                podName: data.pod_name,
                                podType: data.pod_type,
                                vehicle: data.vehicle,
                                phase: data.phase,
                                tdId: data.td_id,
                                status: data.status,
                                startDate: data.start_date,
                                endDate: data.end_date,
                                deletedAt: data.deleted_at,
                                createdAt: data.created_at,
                            }];
                }
            });
        });
    };
    SupabaseStorage.prototype.getPods = function () {
        return __awaiter(this, void 0, void 0, function () {
            var data;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, supabase.from("pods").select("*").is("deleted_at", null)];
                    case 1:
                        data = (_a.sent()).data;
                        if (!data)
                            return [2 /*return*/, []];
                        // Transform snake_case to camelCase
                        return [2 /*return*/, data.map(function (pod) { return ({
                                id: pod.id,
                                podName: pod.pod_name,
                                podType: pod.pod_type,
                                vehicle: pod.vehicle,
                                phase: pod.phase,
                                tdId: pod.td_id,
                                status: pod.status,
                                startDate: pod.start_date,
                                endDate: pod.end_date,
                                deletedAt: pod.deleted_at,
                                createdAt: pod.created_at,
                            }); })];
                }
            });
        });
    };
    SupabaseStorage.prototype.getDeletedPods = function () {
        return __awaiter(this, void 0, void 0, function () {
            var data;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, supabase.from("pods").select("*").not("deleted_at", "is", null)];
                    case 1:
                        data = (_a.sent()).data;
                        if (!data)
                            return [2 /*return*/, []];
                        // Transform snake_case to camelCase
                        return [2 /*return*/, data.map(function (pod) { return ({
                                id: pod.id,
                                podName: pod.pod_name,
                                podType: pod.pod_type,
                                vehicle: pod.vehicle,
                                phase: pod.phase,
                                tdId: pod.td_id,
                                status: pod.status,
                                startDate: pod.start_date,
                                endDate: pod.end_date,
                                deletedAt: pod.deleted_at,
                                createdAt: pod.created_at,
                            }); })];
                }
            });
        });
    };
    SupabaseStorage.prototype.deletePod = function (podId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: 
                    // Soft delete: set deleted_at timestamp and clear td_id
                    return [4 /*yield*/, supabase
                            .from("pods")
                            .update({ deleted_at: new Date().toISOString(), td_id: null })
                            .eq("id", podId)];
                    case 1:
                        // Soft delete: set deleted_at timestamp and clear td_id
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    SupabaseStorage.prototype.getPodByTD = function (tdId) {
        return __awaiter(this, void 0, void 0, function () {
            var data;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, supabase
                            .from("pods")
                            .select("*")
                            .eq("td_id", tdId)
                            .is("deleted_at", null)
                            .limit(1)
                            .maybeSingle()];
                    case 1:
                        data = (_a.sent()).data;
                        if (!data)
                            return [2 /*return*/, undefined];
                        // Transform snake_case to camelCase
                        return [2 /*return*/, {
                                id: data.id,
                                podName: data.pod_name,
                                podType: data.pod_type,
                                vehicle: data.vehicle,
                                phase: data.phase,
                                tdId: data.td_id,
                                status: data.status,
                                startDate: data.start_date,
                                endDate: data.end_date,
                                deletedAt: data.deleted_at,
                                createdAt: data.created_at,
                            }];
                }
            });
        });
    };
    SupabaseStorage.prototype.getPodsByTD = function (tdId) {
        return __awaiter(this, void 0, void 0, function () {
            var data;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, supabase
                            .from("pods")
                            .select("*")
                            .eq("td_id", tdId)
                            .is("deleted_at", null)
                            .order("created_at", { ascending: true })];
                    case 1:
                        data = (_a.sent()).data;
                        if (!data)
                            return [2 /*return*/, []];
                        // Transform snake_case to camelCase
                        return [2 /*return*/, data.map(function (pod) { return ({
                                id: pod.id,
                                podName: pod.pod_name,
                                podType: pod.pod_type,
                                vehicle: pod.vehicle,
                                phase: pod.phase,
                                tdId: pod.td_id,
                                status: pod.status,
                                startDate: pod.start_date,
                                endDate: pod.end_date,
                                deletedAt: pod.deleted_at,
                                createdAt: pod.created_at,
                            }); })];
                }
            });
        });
    };
    SupabaseStorage.prototype.updatePodTD = function (podId, tdId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, supabase.from("pods").update({ td_id: tdId }).eq("id", podId)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    // Tutor Assignments
    SupabaseStorage.prototype.createTutorAssignment = function (assignment) {
        return __awaiter(this, void 0, void 0, function () {
            var dbAssignment, data;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        dbAssignment = {
                            tutor_id: assignment.tutorId,
                            pod_id: assignment.podId,
                            student_count: assignment.studentCount || 0,
                            certification_status: assignment.certificationStatus,
                        };
                        return [4 /*yield*/, supabase.from("tutor_assignments").insert(dbAssignment).select().single()];
                    case 1:
                        data = (_a.sent()).data;
                        if (!data)
                            throw new Error("Failed to create tutor assignment");
                        // Transform snake_case to camelCase
                        return [2 /*return*/, {
                                id: data.id,
                                tutorId: data.tutor_id,
                                podId: data.pod_id,
                                studentCount: data.student_count,
                                certificationStatus: data.certification_status,
                                createdAt: data.created_at,
                            }];
                }
            });
        });
    };
    SupabaseStorage.prototype.getTutorAssignment = function (tutorId) {
        return __awaiter(this, void 0, void 0, function () {
            var _a, data, error, pod;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        console.log("🔍 Looking for tutor assignment for tutorId:", tutorId);
                        return [4 /*yield*/, supabase.from("tutor_assignments").select("*").eq("tutor_id", tutorId).maybeSingle()];
                    case 1:
                        _a = _b.sent(), data = _a.data, error = _a.error;
                        if (error) {
                            console.log("ℹ️ No assignment found (expected for single()):", error.message);
                        }
                        if (!data) {
                            console.log("❌ No assignment data returned");
                            return [2 /*return*/, undefined];
                        }
                        console.log("✅ Found assignment:", JSON.stringify(data, null, 2));
                        return [4 /*yield*/, this.getPod(data.pod_id)];
                    case 2:
                        pod = _b.sent();
                        if (!pod) {
                            console.log("❌ Pod not found for pod_id:", data.pod_id);
                            return [2 /*return*/, undefined];
                        }
                        // Transform snake_case to camelCase
                        return [2 /*return*/, {
                                id: data.id,
                                tutorId: data.tutor_id,
                                podId: data.pod_id,
                                studentCount: data.student_count,
                                certificationStatus: data.certification_status,
                                createdAt: data.created_at,
                                pod: pod,
                            }];
                }
            });
        });
    };
    SupabaseStorage.prototype.getTutorAssignmentsByPod = function (podId) {
        return __awaiter(this, void 0, void 0, function () {
            var data;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, supabase.from("tutor_assignments").select("*").eq("pod_id", podId)];
                    case 1:
                        data = (_a.sent()).data;
                        if (!data)
                            return [2 /*return*/, []];
                        // Transform snake_case to camelCase
                        return [2 /*return*/, data.map(function (assignment) { return ({
                                id: assignment.id,
                                tutorId: assignment.tutor_id,
                                podId: assignment.pod_id,
                                studentCount: assignment.student_count,
                                certificationStatus: assignment.certification_status,
                                createdAt: assignment.created_at,
                            }); })];
                }
            });
        });
    };
    SupabaseStorage.prototype.updateCertificationStatus = function (id, status) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, supabase.from("tutor_assignments").update({ certification_status: status }).eq("id", id)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    SupabaseStorage.prototype.deleteTutorAssignment = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, supabase.from("tutor_assignments").delete().eq("id", id)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    // Students
    SupabaseStorage.prototype.createStudent = function (student) {
        return __awaiter(this, void 0, void 0, function () {
            var dbStudent, data;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        dbStudent = {
                            name: student.name,
                            grade: student.grade,
                            tutor_id: student.tutorId,
                            session_progress: student.sessionProgress,
                            concept_mastery: student.conceptMastery,
                            confidence_score: student.confidenceScore,
                            parent_contact: student.parentContact,
                        };
                        return [4 /*yield*/, supabase.from("students").insert(dbStudent).select().single()];
                    case 1:
                        data = (_a.sent()).data;
                        if (!data)
                            throw new Error("Failed to create student");
                        return [2 /*return*/, transformSnakeToCamel(data)];
                }
            });
        });
    };
    SupabaseStorage.prototype.getStudent = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            var data;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, supabase.from("students").select("*").eq("id", id).maybeSingle()];
                    case 1:
                        data = (_a.sent()).data;
                        if (!data)
                            return [2 /*return*/, undefined];
                        return [2 /*return*/, transformSnakeToCamel(data)];
                }
            });
        });
    };
    SupabaseStorage.prototype.getStudentsByTutor = function (tutorId) {
        return __awaiter(this, void 0, void 0, function () {
            var data;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, supabase.from("students").select("*").eq("tutor_id", tutorId)];
                    case 1:
                        data = (_a.sent()).data;
                        if (!data)
                            return [2 /*return*/, []];
                        return [2 /*return*/, (data !== null && data !== void 0 ? data : [])
                                .filter(function (student) { return student.id && student.id.trim() !== ""; })
                                .map(function (student) { return transformSnakeToCamel(student); })];
                }
            });
        });
    };
    SupabaseStorage.prototype.updateStudentProgress = function (id, sessionCount, confidenceDelta) {
        return __awaiter(this, void 0, void 0, function () {
            var student, confidenceScore;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, this.getStudent(id)];
                    case 1:
                        student = _b.sent();
                        if (!student)
                            return [2 /*return*/];
                        confidenceScore = Math.max(0, Math.min(10, ((_a = student.confidenceScore) !== null && _a !== void 0 ? _a : 5) + confidenceDelta));
                        return [4 /*yield*/, supabase.from("students").update({ session_progress: sessionCount, confidence_score: confidenceScore, updated_at: new Date() }).eq("id", id)];
                    case 2:
                        _b.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    SupabaseStorage.prototype.updateStudent = function (id, data) {
        return __awaiter(this, void 0, void 0, function () {
            var dbData, _i, _a, _b, key, value, snakeKey, _c, updated, error;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        dbData = {};
                        for (_i = 0, _a = Object.entries(data); _i < _a.length; _i++) {
                            _b = _a[_i], key = _b[0], value = _b[1];
                            if (key === 'id' || key === 'createdAt')
                                continue; // Skip readonly fields
                            snakeKey = key.replace(/[A-Z]/g, function (letter) { return "_".concat(letter.toLowerCase()); });
                            dbData[snakeKey] = value;
                        }
                        return [4 /*yield*/, supabase
                                .from("students")
                                .update(dbData)
                                .eq("id", id)
                                .select()
                                .single()];
                    case 1:
                        _c = _d.sent(), updated = _c.data, error = _c.error;
                        if (error) {
                            console.error("Error updating student:", error);
                            return [2 /*return*/, undefined];
                        }
                        return [2 /*return*/, transformSnakeToCamel(updated)];
                }
            });
        });
    };
    // Session
    SupabaseStorage.prototype.createSession = function (session) {
        return __awaiter(this, void 0, void 0, function () {
            var dbSession, data;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        dbSession = {
                            tutor_id: session.tutorId,
                            student_id: session.studentId,
                            date: session.date,
                            duration: session.duration,
                            notes: session.notes,
                            vocabulary_notes: session.vocabularyNotes,
                            method_notes: session.methodNotes,
                            reason_notes: session.reasonNotes,
                            student_response: session.studentResponse,
                            confidence_change: session.confidenceChange,
                            tutor_growth_reflection: session.tutorGrowthReflection,
                            boss_battles_done: session.bossBattlesDone,
                            practice_problems: session.practiceProblems,
                            confidence_score_delta: session.confidenceScoreDelta,
                        };
                        return [4 /*yield*/, supabase.from("tutoring_sessions").insert(dbSession).select().single()];
                    case 1:
                        data = (_a.sent()).data;
                        if (!data)
                            throw new Error("Failed to create session");
                        return [2 /*return*/, transformSnakeToCamel(data)];
                }
            });
        });
    };
    SupabaseStorage.prototype.getSessionsByTutor = function (tutorId) {
        return __awaiter(this, void 0, void 0, function () {
            var data;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, supabase.from("tutoring_sessions").select("*").eq("tutor_id", tutorId).order("date", { ascending: false })];
                    case 1:
                        data = (_a.sent()).data;
                        return [2 /*return*/, (data !== null && data !== void 0 ? data : []).map(transformSnakeToCamel)];
                }
            });
        });
    };
    SupabaseStorage.prototype.getSessionsByStudent = function (studentId) {
        return __awaiter(this, void 0, void 0, function () {
            var data;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, supabase.from("tutoring_sessions").select("*").eq("student_id", studentId).order("date", { ascending: false })];
                    case 1:
                        data = (_a.sent()).data;
                        return [2 /*return*/, (data !== null && data !== void 0 ? data : []).map(transformSnakeToCamel)];
                }
            });
        });
    };
    SupabaseStorage.prototype.getSessionsByPod = function (podId) {
        return __awaiter(this, void 0, void 0, function () {
            var assignments, tutorIds, data;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, supabase
                            .from("tutor_assignments")
                            .select("tutor_id")
                            .eq("pod_id", podId)];
                    case 1:
                        assignments = (_a.sent()).data;
                        if (!assignments || assignments.length === 0) {
                            return [2 /*return*/, []];
                        }
                        tutorIds = assignments.map(function (a) { return a.tutor_id; });
                        return [4 /*yield*/, supabase
                                .from("tutoring_sessions")
                                .select("*")
                                .in("tutor_id", tutorIds)
                                .order("date", { ascending: false })];
                    case 2:
                        data = (_a.sent()).data;
                        return [2 /*return*/, (data !== null && data !== void 0 ? data : []).map(transformSnakeToCamel)];
                }
            });
        });
    };
    // Reflections
    SupabaseStorage.prototype.createReflection = function (reflection) {
        return __awaiter(this, void 0, void 0, function () {
            var data, row;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, supabase.from("reflections").insert({
                            tutor_id: reflection.tutorId,
                            date: reflection.date,
                            reflection_text: reflection.reflectionText,
                            habit_score: reflection.habitScore,
                        }).select("id, tutor_id, date, reflection_text, habit_score, created_at")];
                    case 1:
                        data = (_a.sent()).data;
                        if (!data || data.length === 0)
                            throw new Error("Failed to create reflection");
                        row = data[0];
                        return [2 /*return*/, {
                                id: row.id,
                                tutorId: row.tutor_id,
                                reflectionText: row.reflection_text,
                                habitScore: row.habit_score,
                                date: row.date,
                                createdAt: row.created_at,
                            }];
                }
            });
        });
    };
    SupabaseStorage.prototype.getReflectionsByTutor = function (tutorId) {
        return __awaiter(this, void 0, void 0, function () {
            var data;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, supabase
                            .from("reflections")
                            .select("id, tutor_id, date, reflection_text, habit_score, created_at")
                            .eq("tutor_id", tutorId)
                            .order("date", { ascending: false })];
                    case 1:
                        data = (_a.sent()).data;
                        if (!data)
                            return [2 /*return*/, []];
                        return [2 /*return*/, data.map(function (row) { return ({
                                id: row.id,
                                tutorId: row.tutor_id,
                                reflectionText: row.reflection_text,
                                habitScore: row.habit_score,
                                date: row.date,
                                createdAt: row.created_at,
                            }); })];
                }
            });
        });
    };
    // Academic Profiles (School Tracker)
    SupabaseStorage.prototype.getAcademicProfile = function (studentId) {
        return __awaiter(this, void 0, void 0, function () {
            var data;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, supabase
                            .from("academic_profiles")
                            .select("*")
                            .eq("student_id", studentId)
                            .maybeSingle()];
                    case 1:
                        data = (_a.sent()).data;
                        if (!data)
                            return [2 /*return*/, undefined];
                        // Map snake_case to camelCase
                        return [2 /*return*/, {
                                id: data.id,
                                studentId: data.student_id,
                                fullName: data.full_name,
                                grade: data.grade,
                                school: data.school,
                                latestTermReport: data.latest_term_report,
                                myThoughts: data.my_thoughts,
                                currentChallenges: data.current_challenges,
                                recentWins: data.recent_wins,
                                upcomingExamsProjects: data.upcoming_exams_projects,
                                createdAt: data.created_at,
                                updatedAt: data.updated_at,
                            }];
                }
            });
        });
    };
    SupabaseStorage.prototype.upsertAcademicProfile = function (profile) {
        return __awaiter(this, void 0, void 0, function () {
            var dbProfile, _a, data, error;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        dbProfile = {
                            student_id: profile.studentId,
                            full_name: profile.fullName,
                            grade: profile.grade,
                            school: profile.school,
                            latest_term_report: profile.latestTermReport,
                            my_thoughts: profile.myThoughts,
                            current_challenges: profile.currentChallenges,
                            recent_wins: profile.recentWins,
                            upcoming_exams_projects: profile.upcomingExamsProjects,
                        };
                        return [4 /*yield*/, supabase
                                .from("academic_profiles")
                                .upsert(dbProfile, { onConflict: "student_id" })
                                .select()
                                .maybeSingle()];
                    case 1:
                        _a = _b.sent(), data = _a.data, error = _a.error;
                        if (error) {
                            console.error("Supabase upsert error:", error);
                            throw new Error("Failed to save academic profile: ".concat(error.message));
                        }
                        if (!data)
                            throw new Error("Failed to save academic profile");
                        // Map snake_case to camelCase
                        return [2 /*return*/, {
                                id: data.id,
                                studentId: data.student_id,
                                fullName: data.full_name,
                                grade: data.grade,
                                school: data.school,
                                latestTermReport: data.latest_term_report,
                                myThoughts: data.my_thoughts,
                                currentChallenges: data.current_challenges,
                                recentWins: data.recent_wins,
                                upcomingExamsProjects: data.upcoming_exams_projects,
                                createdAt: data.created_at,
                                updatedAt: data.updated_at,
                            }];
                }
            });
        });
    };
    // Struggle Targets (Target Center)
    SupabaseStorage.prototype.getStruggleTargets = function (studentId) {
        return __awaiter(this, void 0, void 0, function () {
            var data;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, supabase
                            .from("struggle_targets")
                            .select("*")
                            .eq("student_id", studentId)
                            .order("created_at", { ascending: false })];
                    case 1:
                        data = (_a.sent()).data;
                        // Map snake_case to camelCase
                        return [2 /*return*/, (data !== null && data !== void 0 ? data : []).map(function (item) { return ({
                                id: item.id,
                                studentId: item.student_id,
                                subject: item.subject,
                                topicConcept: item.topic_concept,
                                myStruggle: item.my_struggle,
                                strategy: item.strategy,
                                consolidationDate: item.consolidation_date,
                                overcame: item.overcame,
                                createdAt: item.created_at,
                                updatedAt: item.updated_at,
                            }); })];
                }
            });
        });
    };
    SupabaseStorage.prototype.createStruggleTarget = function (target) {
        return __awaiter(this, void 0, void 0, function () {
            var dbTarget, _a, data, error;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        dbTarget = {
                            student_id: target.studentId,
                            subject: target.subject,
                            topic_concept: target.topicConcept,
                            my_struggle: target.myStruggle,
                            strategy: target.strategy,
                            consolidation_date: target.consolidationDate,
                        };
                        return [4 /*yield*/, supabase
                                .from("struggle_targets")
                                .insert(dbTarget)
                                .select()
                                .single()];
                    case 1:
                        _a = _b.sent(), data = _a.data, error = _a.error;
                        if (error) {
                            console.error("Supabase insert error:", error);
                            throw new Error("Failed to create struggle target: ".concat(error.message));
                        }
                        if (!data)
                            throw new Error("Failed to create struggle target - no data returned");
                        // Map snake_case to camelCase
                        return [2 /*return*/, {
                                id: data.id,
                                studentId: data.student_id,
                                subject: data.subject,
                                topicConcept: data.topic_concept,
                                myStruggle: data.my_struggle,
                                strategy: data.strategy,
                                consolidationDate: data.consolidation_date,
                                overcame: data.overcame,
                                createdAt: data.created_at,
                                updatedAt: data.updated_at,
                            }];
                }
            });
        });
    };
    SupabaseStorage.prototype.updateStruggleTarget = function (id, updates) {
        return __awaiter(this, void 0, void 0, function () {
            var dbUpdates, _a, data, error;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        dbUpdates = { updated_at: new Date() };
                        if (updates.subject !== undefined)
                            dbUpdates.subject = updates.subject;
                        if (updates.topicConcept !== undefined)
                            dbUpdates.topic_concept = updates.topicConcept;
                        if (updates.myStruggle !== undefined)
                            dbUpdates.my_struggle = updates.myStruggle;
                        if (updates.strategy !== undefined)
                            dbUpdates.strategy = updates.strategy;
                        if (updates.consolidationDate !== undefined)
                            dbUpdates.consolidation_date = updates.consolidationDate;
                        if (updates.overcame !== undefined)
                            dbUpdates.overcame = updates.overcame;
                        return [4 /*yield*/, supabase
                                .from("struggle_targets")
                                .update(dbUpdates)
                                .eq("id", id)
                                .select()
                                .single()];
                    case 1:
                        _a = _b.sent(), data = _a.data, error = _a.error;
                        if (error) {
                            console.error("Supabase update error:", error);
                            throw new Error("Failed to update struggle target: ".concat(error.message));
                        }
                        if (!data)
                            return [2 /*return*/, undefined];
                        // Map snake_case to camelCase
                        return [2 /*return*/, {
                                id: data.id,
                                studentId: data.student_id,
                                subject: data.subject,
                                topicConcept: data.topic_concept,
                                myStruggle: data.my_struggle,
                                strategy: data.strategy,
                                consolidationDate: data.consolidation_date,
                                overcame: data.overcame,
                                createdAt: data.created_at,
                                updatedAt: data.updated_at,
                            }];
                }
            });
        });
    };
    SupabaseStorage.prototype.deleteStruggleTarget = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, supabase.from("struggle_targets").delete().eq("id", id)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    // Verification Docs
    SupabaseStorage.prototype.createVerificationDoc = function (doc) {
        return __awaiter(this, void 0, void 0, function () {
            var dbDoc, data;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        dbDoc = {
                            tutor_id: doc.tutorId,
                            file_url_agreement: doc.fileUrlAgreement,
                            file_url_consent: doc.fileUrlConsent,
                            status: doc.status,
                        };
                        return [4 /*yield*/, supabase.from("verification_docs").insert(dbDoc).select().single()];
                    case 1:
                        data = (_a.sent()).data;
                        if (!data)
                            throw new Error("Failed to create verification doc");
                        return [2 /*return*/, data];
                }
            });
        });
    };
    SupabaseStorage.prototype.getVerificationDocByTutor = function (tutorId) {
        return __awaiter(this, void 0, void 0, function () {
            var data;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, supabase.from("verification_docs").select("*").eq("tutor_id", tutorId).maybeSingle()];
                    case 1:
                        data = (_a.sent()).data;
                        return [2 /*return*/, data !== null && data !== void 0 ? data : undefined];
                }
            });
        });
    };
    SupabaseStorage.prototype.updateVerificationStatus = function (tutorId, status) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, supabase.from("verification_docs").update({ status: status, updated_at: new Date() }).eq("tutor_id", tutorId)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    // Broadcasts
    SupabaseStorage.prototype.createBroadcast = function (broadcast) {
        return __awaiter(this, void 0, void 0, function () {
            var dbBroadcast, _a, data, error;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        dbBroadcast = {
                            subject: broadcast.subject,
                            message: broadcast.message,
                            sender_role: broadcast.senderRole,
                            visibility: broadcast.visibility,
                        };
                        console.log("📝 Inserting broadcast:", JSON.stringify(dbBroadcast, null, 2));
                        return [4 /*yield*/, supabase.from("broadcasts").insert(dbBroadcast).select().single()];
                    case 1:
                        _a = _b.sent(), data = _a.data, error = _a.error;
                        if (error) {
                            console.error("❌ Supabase insert error:", error);
                            throw new Error("Failed to create broadcast: ".concat(error.message));
                        }
                        if (!data) {
                            console.error("❌ No data returned from insert");
                            throw new Error("Failed to create broadcast: no data returned");
                        }
                        console.log("✅ Created broadcast data from DB:", JSON.stringify(data, null, 2));
                        // Transform snake_case to camelCase
                        return [2 /*return*/, {
                                id: data.id,
                                subject: data.subject || "(No Subject)",
                                message: data.message,
                                senderRole: data.sender_role,
                                visibility: data.visibility,
                                createdAt: data.created_at,
                            }];
                }
            });
        });
    };
    SupabaseStorage.prototype.getBroadcasts = function (userCreatedAt) {
        return __awaiter(this, void 0, void 0, function () {
            var query, data, transformed;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        query = supabase.from("broadcasts").select("*").order("created_at", { ascending: false });
                        // Filter broadcasts to only show those created after user's account was created
                        if (userCreatedAt) {
                            query = query.gte("created_at", userCreatedAt);
                        }
                        return [4 /*yield*/, query];
                    case 1:
                        data = (_a.sent()).data;
                        if (!data)
                            return [2 /*return*/, []];
                        console.log("📊 Total broadcasts fetched:", data.length);
                        transformed = data.map(function (broadcast) {
                            var result = {
                                id: broadcast.id,
                                subject: broadcast.subject || "(No Subject)",
                                message: broadcast.message,
                                senderRole: broadcast.sender_role,
                                visibility: broadcast.visibility,
                                createdAt: broadcast.created_at,
                            };
                            return result;
                        });
                        return [2 /*return*/, transformed];
                }
            });
        });
    };
    // Broadcast Reads (Track which broadcasts users have read)
    SupabaseStorage.prototype.markBroadcastAsRead = function (userId, broadcastId) {
        return __awaiter(this, void 0, void 0, function () {
            var _a, broadcast, broadcastError, _b, user, userError, _c, existing, existingError, error, error_1;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        _d.trys.push([0, 6, , 7]);
                        return [4 /*yield*/, supabase
                                .from("broadcasts")
                                .select("id")
                                .eq("id", broadcastId)
                                .single()];
                    case 1:
                        _a = _d.sent(), broadcast = _a.data, broadcastError = _a.error;
                        if (broadcastError || !broadcast) {
                            console.error("Broadcast not found:", broadcastId);
                            throw new Error("Broadcast not found");
                        }
                        return [4 /*yield*/, supabase
                                .from("users")
                                .select("id")
                                .eq("id", userId)
                                .single()];
                    case 2:
                        _b = _d.sent(), user = _b.data, userError = _b.error;
                        if (userError || !user) {
                            console.error("User not found:", userId);
                            throw new Error("User not found");
                        }
                        return [4 /*yield*/, supabase
                                .from("broadcast_reads")
                                .select("id")
                                .eq("user_id", userId)
                                .eq("broadcast_id", broadcastId)
                                .single()];
                    case 3:
                        _c = _d.sent(), existing = _c.data, existingError = _c.error;
                        // If table doesn't exist, the existingError will have a code
                        if (existingError && existingError.code === 'PGRST205') {
                            console.warn("⚠️  broadcast_reads table not found. Please run BROADCAST_READS_TABLE.sql in Supabase");
                            return [2 /*return*/];
                        }
                        if (!!existing) return [3 /*break*/, 5];
                        return [4 /*yield*/, supabase.from("broadcast_reads").insert({
                                user_id: userId,
                                broadcast_id: broadcastId,
                            })];
                    case 4:
                        error = (_d.sent()).error;
                        if (error) {
                            // If table doesn't exist, log warning but don't throw
                            if (error.code === 'PGRST205') {
                                console.warn("⚠️  broadcast_reads table not found. Please run BROADCAST_READS_TABLE.sql in Supabase");
                            }
                            else {
                                throw error;
                            }
                        }
                        _d.label = 5;
                    case 5: return [3 /*break*/, 7];
                    case 6:
                        error_1 = _d.sent();
                        // If table doesn't exist (PGRST205), log warning but don't crash
                        if ((error_1 === null || error_1 === void 0 ? void 0 : error_1.code) === 'PGRST205') {
                            console.warn("⚠️  broadcast_reads table not found. Please run BROADCAST_READS_TABLE.sql in Supabase");
                        }
                        else {
                            throw error_1;
                        }
                        return [3 /*break*/, 7];
                    case 7: return [2 /*return*/];
                }
            });
        });
    };
    SupabaseStorage.prototype.getUnreadBroadcastCount = function (userId, userCreatedAt) {
        return __awaiter(this, void 0, void 0, function () {
            var broadcastQuery, broadcasts, broadcastIds, reads, readIds_1, unreadCount, error_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 3, , 4]);
                        broadcastQuery = supabase
                            .from("broadcasts")
                            .select("id, created_at");
                        // Only show broadcasts created after user's account was created
                        if (userCreatedAt) {
                            broadcastQuery = broadcastQuery.gte("created_at", userCreatedAt);
                        }
                        return [4 /*yield*/, broadcastQuery];
                    case 1:
                        broadcasts = (_a.sent()).data;
                        if (!broadcasts || broadcasts.length === 0)
                            return [2 /*return*/, 0];
                        broadcastIds = broadcasts.map(function (b) { return b.id; });
                        return [4 /*yield*/, supabase
                                .from("broadcast_reads")
                                .select("broadcast_id")
                                .eq("user_id", userId)
                                .in("broadcast_id", broadcastIds)];
                    case 2:
                        reads = (_a.sent()).data;
                        readIds_1 = new Set((reads || []).map(function (r) { return r.broadcast_id; }));
                        unreadCount = broadcastIds.filter(function (id) { return !readIds_1.has(id); }).length;
                        return [2 /*return*/, unreadCount];
                    case 3:
                        error_2 = _a.sent();
                        console.error("Error getting unread count:", error_2);
                        return [2 /*return*/, 0];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    SupabaseStorage.prototype.getUserBroadcastReads = function (userId) {
        return __awaiter(this, void 0, void 0, function () {
            var data;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, supabase
                            .from("broadcast_reads")
                            .select("broadcast_id")
                            .eq("user_id", userId)];
                    case 1:
                        data = (_a.sent()).data;
                        return [2 /*return*/, (data || []).map(function (r) { return r.broadcast_id; })];
                }
            });
        });
    };
    // Tutor Applications
    SupabaseStorage.prototype.createTutorApplication = function (application) {
        return __awaiter(this, void 0, void 0, function () {
            var dbApplication, _a, data, error;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        dbApplication = {
                            user_id: application.userId,
                            full_names: application.fullNames,
                            age: application.age,
                            phone_number: application.phoneNumber,
                            email: application.email,
                            city: application.city,
                            current_status: application.currentStatus,
                            who_influences: application.whoInfluences,
                            environment: application.environment,
                            mindset_data: application.mindsetData,
                            grades_equipped: application.gradesEquipped,
                            can_explain_clearly: application.canExplainClearly,
                            tool_confidence: application.toolConfidence,
                            student_not_improving: application.studentNotImproving,
                            psychological_data: application.psychologicalData,
                            vision_data: application.visionData,
                            video_url: application.videoUrl,
                            bootcamp_available: application.bootcampAvailable,
                            commit_to_trial: application.commitToTrial,
                            referral_source: application.referralSource,
                            status: application.status,
                        };
                        return [4 /*yield*/, supabase
                                .from("tutor_applications")
                                .insert(dbApplication)
                                .select()
                                .single()];
                    case 1:
                        _a = _b.sent(), data = _a.data, error = _a.error;
                        if (error)
                            throw new Error("Failed to create tutor application: ".concat(error.message));
                        if (!data)
                            throw new Error("Failed to create tutor application: No data returned");
                        return [2 /*return*/, data];
                }
            });
        });
    };
    SupabaseStorage.prototype.getTutorApplicationsByUser = function (userId) {
        return __awaiter(this, void 0, void 0, function () {
            var data;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, supabase
                            .from("tutor_applications")
                            .select("*")
                            .eq("user_id", userId)
                            .order("created_at", { ascending: false })];
                    case 1:
                        data = (_a.sent()).data;
                        return [2 /*return*/, (data !== null && data !== void 0 ? data : []).map(transformSnakeToCamel)];
                }
            });
        });
    };
    SupabaseStorage.prototype.getTutorApplications = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _a, data, error;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, supabase
                            .from("tutor_applications")
                            .select("*")
                            .order("created_at", { ascending: false })];
                    case 1:
                        _a = _b.sent(), data = _a.data, error = _a.error;
                        if (error) {
                            console.error("Error fetching tutor applications:", error);
                            throw new Error("Failed to fetch tutor applications: ".concat(error.message));
                        }
                        return [2 /*return*/, (data !== null && data !== void 0 ? data : []).map(transformSnakeToCamel)];
                }
            });
        });
    };
    SupabaseStorage.prototype.getTutorApplicationsByStatus = function (status) {
        return __awaiter(this, void 0, void 0, function () {
            var _a, data, error;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, supabase
                            .from("tutor_applications")
                            .select("*")
                            .eq("status", status)
                            .order("created_at", { ascending: false })];
                    case 1:
                        _a = _b.sent(), data = _a.data, error = _a.error;
                        if (error) {
                            console.error("Error fetching tutor applications by status ".concat(status, ":"), error);
                            throw new Error("Failed to fetch tutor applications: ".concat(error.message));
                        }
                        return [2 /*return*/, (data !== null && data !== void 0 ? data : []).map(transformSnakeToCamel)];
                }
            });
        });
    };
    SupabaseStorage.prototype.approveTutorApplication = function (id, reviewedBy) {
        return __awaiter(this, void 0, void 0, function () {
            var data;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, supabase
                            .from("tutor_applications")
                            .update({
                            status: "approved",
                            reviewed_by: reviewedBy,
                            reviewed_at: new Date(),
                            updated_at: new Date(),
                        })
                            .eq("id", id)
                            .select()
                            .single()];
                    case 1:
                        data = (_a.sent()).data;
                        return [2 /*return*/, data !== null && data !== void 0 ? data : undefined];
                }
            });
        });
    };
    SupabaseStorage.prototype.rejectTutorApplication = function (id, reviewedBy, reason) {
        return __awaiter(this, void 0, void 0, function () {
            var data;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, supabase
                            .from("tutor_applications")
                            .update({
                            status: "rejected",
                            reviewed_by: reviewedBy,
                            reviewed_at: new Date(),
                            rejection_reason: reason,
                            updated_at: new Date(),
                        })
                            .eq("id", id)
                            .select()
                            .single()];
                    case 1:
                        data = (_a.sent()).data;
                        return [2 /*return*/, data !== null && data !== void 0 ? data : undefined];
                }
            });
        });
    };
    SupabaseStorage.prototype.getApprovedTutors = function () {
        return __awaiter(this, void 0, void 0, function () {
            var approvedApplications, approvedUserIds, users;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, supabase
                            .from("tutor_applications")
                            .select("user_id")
                            .eq("status", "approved")];
                    case 1:
                        approvedApplications = (_a.sent()).data;
                        if (!approvedApplications || approvedApplications.length === 0) {
                            return [2 /*return*/, []];
                        }
                        approvedUserIds = approvedApplications.map(function (app) { return app.user_id; });
                        return [4 /*yield*/, supabase
                                .from("users")
                                .select("*")
                                .in("id", approvedUserIds)
                                .eq("role", "tutor")];
                    case 2:
                        users = (_a.sent()).data;
                        return [2 /*return*/, users !== null && users !== void 0 ? users : []];
                }
            });
        });
    };
    // Tutor onboarding document methods
    SupabaseStorage.prototype.updateTutorOnboardingDocument = function (applicationId, documentType, documentUrl) {
        return __awaiter(this, void 0, void 0, function () {
            var updateData, _a, data, error;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        updateData = {
                            updated_at: new Date(),
                        };
                        if (documentType === "trial_agreement") {
                            updateData.trial_agreement_url = documentUrl;
                            updateData.trial_agreement_uploaded_at = new Date();
                        }
                        else {
                            updateData.parent_consent_url = documentUrl;
                            updateData.parent_consent_uploaded_at = new Date();
                        }
                        return [4 /*yield*/, supabase
                                .from("tutor_applications")
                                .update(updateData)
                                .eq("id", applicationId)
                                .select()
                                .single()];
                    case 1:
                        _a = _b.sent(), data = _a.data, error = _a.error;
                        if (error) {
                            console.error("Error updating onboarding document:", error);
                            return [2 /*return*/, undefined];
                        }
                        return [2 /*return*/, data ? transformSnakeToCamel(data) : undefined];
                }
            });
        });
    };
    SupabaseStorage.prototype.verifyTutorOnboardingDocument = function (applicationId, documentType, verifiedBy) {
        return __awaiter(this, void 0, void 0, function () {
            var updateData, _a, data, error;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        updateData = {
                            updated_at: new Date(),
                        };
                        if (documentType === "trial_agreement") {
                            updateData.trial_agreement_verified = true;
                            updateData.trial_agreement_verified_by = verifiedBy;
                            updateData.trial_agreement_verified_at = new Date();
                        }
                        else {
                            updateData.parent_consent_verified = true;
                            updateData.parent_consent_verified_by = verifiedBy;
                            updateData.parent_consent_verified_at = new Date();
                        }
                        return [4 /*yield*/, supabase
                                .from("tutor_applications")
                                .update(updateData)
                                .eq("id", applicationId)
                                .select()
                                .single()];
                    case 1:
                        _a = _b.sent(), data = _a.data, error = _a.error;
                        if (error) {
                            console.error("Error verifying onboarding document:", error);
                            return [2 /*return*/, undefined];
                        }
                        return [2 /*return*/, data ? transformSnakeToCamel(data) : undefined];
                }
            });
        });
    };
    SupabaseStorage.prototype.completeTutorOnboarding = function (applicationId) {
        return __awaiter(this, void 0, void 0, function () {
            var _a, data, error;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, supabase
                            .from("tutor_applications")
                            .update({
                            onboarding_completed_at: new Date(),
                            updated_at: new Date(),
                        })
                            .eq("id", applicationId)
                            .select()
                            .single()];
                    case 1:
                        _a = _b.sent(), data = _a.data, error = _a.error;
                        if (error) {
                            console.error("Error completing onboarding:", error);
                            return [2 /*return*/, undefined];
                        }
                        return [2 /*return*/, data ? transformSnakeToCamel(data) : undefined];
                }
            });
        });
    };
    // Roles
    SupabaseStorage.prototype.checkRoleAuthorization = function (email, role) {
        return __awaiter(this, void 0, void 0, function () {
            var data;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (role === "tutor")
                            return [2 /*return*/, true];
                        return [4 /*yield*/, supabase.from("role_permissions").select("*").eq("email", email).maybeSingle()];
                    case 1:
                        data = (_a.sent()).data;
                        return [2 /*return*/, data ? data.role === role : false];
                }
            });
        });
    };
    SupabaseStorage.prototype.addRolePermission = function (permission) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, supabase.from("role_permissions").upsert(permission)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    SupabaseStorage.prototype.getRolePermissions = function () {
        return __awaiter(this, void 0, void 0, function () {
            var data;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, supabase.from("role_permissions").select("*")];
                    case 1:
                        data = (_a.sent()).data;
                        return [2 /*return*/, data !== null && data !== void 0 ? data : []];
                }
            });
        });
    };
    SupabaseStorage.prototype.checkTDPodAssignment = function (email) {
        return __awaiter(this, void 0, void 0, function () {
            var user, pod;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, supabase
                            .from("users")
                            .select("id")
                            .eq("email", email)
                            .maybeSingle()];
                    case 1:
                        user = (_b.sent()).data;
                        if (!user)
                            return [2 /*return*/, null];
                        return [4 /*yield*/, supabase
                                .from("pods")
                                .select("id")
                                .eq("td_id", user.id)
                                .is("deleted_at", null)
                                .limit(1)
                                .maybeSingle()];
                    case 2:
                        pod = (_b.sent()).data;
                        return [2 /*return*/, (_a = pod === null || pod === void 0 ? void 0 : pod.id) !== null && _a !== void 0 ? _a : null];
                }
            });
        });
    };
    // ============================================
    // AFFILIATE PROSPECTING SYSTEM
    // ============================================
    SupabaseStorage.prototype.getOrCreateAffiliateCode = function (affiliateId) {
        return __awaiter(this, void 0, void 0, function () {
            var existing, randomSuffix, code, _a, newCode, error;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, supabase
                            .from("affiliate_codes")
                            .select("*")
                            .eq("affiliate_id", affiliateId)
                            .maybeSingle()];
                    case 1:
                        existing = (_b.sent()).data;
                        if (existing)
                            return [2 /*return*/, existing];
                        randomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
                        code = "AFIX".concat(randomSuffix);
                        return [4 /*yield*/, supabase
                                .from("affiliate_codes")
                                .insert({
                                affiliate_id: affiliateId,
                                code: code,
                            })
                                .select()
                                .single()];
                    case 2:
                        _a = _b.sent(), newCode = _a.data, error = _a.error;
                        if (error)
                            throw error;
                        return [2 /*return*/, newCode];
                }
            });
        });
    };
    SupabaseStorage.prototype.getAffiliateCode = function (affiliateId) {
        return __awaiter(this, void 0, void 0, function () {
            var data;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, supabase
                            .from("affiliate_codes")
                            .select("*")
                            .eq("affiliate_id", affiliateId)
                            .maybeSingle()];
                    case 1:
                        data = (_a.sent()).data;
                        return [2 /*return*/, data || null];
                }
            });
        });
    };
    SupabaseStorage.prototype.getAffiliateByCode = function (code) {
        return __awaiter(this, void 0, void 0, function () {
            var data;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, supabase
                            .from("affiliate_codes")
                            .select("affiliate_id")
                            .eq("code", code)
                            .maybeSingle()];
                    case 1:
                        data = (_a.sent()).data;
                        return [2 /*return*/, data ? data.affiliate_id : null];
                }
            });
        });
    };
    SupabaseStorage.prototype.logEncounter = function (affiliateId, encounter) {
        return __awaiter(this, void 0, void 0, function () {
            var _a, data, error;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, supabase
                            .from("encounters")
                            .insert({
                            affiliate_id: affiliateId,
                            parent_name: encounter.parentName,
                            parent_email: encounter.parentEmail || null,
                            parent_phone: encounter.parentPhone || null,
                            child_name: encounter.childName || null,
                            child_grade: encounter.childGrade || null,
                            date_met: encounter.dateMet || null,
                            contact_method: encounter.contactMethod || null,
                            discovery_outcome: encounter.discoveryOutcome || null,
                            delivery_notes: encounter.deliveryNotes || null,
                            final_outcome: encounter.finalOutcome || null,
                            result: encounter.result || null,
                            confidence_rating: encounter.confidenceRating || null,
                            my_thoughts: encounter.myThoughts || null,
                            notes: encounter.notes || null,
                            status: encounter.finalOutcome === "enrolled" ? "prospect" : encounter.finalOutcome === "objected" ? "objected" : "prospect",
                        })
                            .select()
                            .single()];
                    case 1:
                        _a = _b.sent(), data = _a.data, error = _a.error;
                        if (error)
                            throw error;
                        return [2 /*return*/, data];
                }
            });
        });
    };
    SupabaseStorage.prototype.getEncounters = function (affiliateId) {
        return __awaiter(this, void 0, void 0, function () {
            var data;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, supabase
                            .from("encounters")
                            .select("*")
                            .eq("affiliate_id", affiliateId)
                            .order("created_at", { ascending: false })];
                    case 1:
                        data = (_a.sent()).data;
                        return [2 /*return*/, data || []];
                }
            });
        });
    };
    SupabaseStorage.prototype.updateEncounterStatus = function (encounterId, status) {
        return __awaiter(this, void 0, void 0, function () {
            var error;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, supabase
                            .from("encounters")
                            .update({ status: status })
                            .eq("id", encounterId)];
                    case 1:
                        error = (_a.sent()).error;
                        if (error)
                            throw error;
                        return [2 /*return*/];
                }
            });
        });
    };
    SupabaseStorage.prototype.createLead = function (affiliateId, parentId, encounterId, trackingData) {
        return __awaiter(this, void 0, void 0, function () {
            var _a, data, error;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, supabase
                            .from("leads")
                            .insert({
                            affiliate_id: affiliateId,
                            user_id: parentId,
                            encounter_id: encounterId || null,
                            tracking_source: (trackingData === null || trackingData === void 0 ? void 0 : trackingData.trackingSource) || 'affiliate',
                            tracking_campaign: (trackingData === null || trackingData === void 0 ? void 0 : trackingData.trackingCampaign) || null,
                            tracking_source: (trackingData === null || trackingData === void 0 ? void 0 : trackingData.trackingSource) || 'affiliate',
                            tracking_campaign: (trackingData === null || trackingData === void 0 ? void 0 : trackingData.trackingCampaign) || null,
                        })
                            .select()
                            .single()];
                    case 1:
                        _a = _b.sent(), data = _a.data, error = _a.error;
                        if (error)
                            throw error;
                        return [2 /*return*/, data];
                }
            });
        });
    };
    SupabaseStorage.prototype.getLeads = function (affiliateId) {
        return __awaiter(this, void 0, void 0, function () {
            var leads, enriched;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, supabase
                            .from("leads")
                            .select("*")
                            .eq("affiliate_id", affiliateId)
                            .order("created_at", { ascending: false })];
                    case 1:
                        leads = (_a.sent()).data;
                        if (!leads)
                            return [2 /*return*/, []];
                        console.log("📊 Raw leads data from DB:", leads.length, "leads");
                        return [4 /*yield*/, Promise.all(leads.map(function (lead) { return __awaiter(_this, void 0, void 0, function () {
                                var user, encounterData, encounter;
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0: return [4 /*yield*/, supabase
                                                .from("users")
                                                .select("id, email, first_name, last_name, name")
                                                .eq("id", lead.user_id)
                                                .maybeSingle()];
                                        case 1:
                                            user = (_a.sent()).data;
                                            encounterData = null;
                                            if (!lead.encounter_id) return [3 /*break*/, 3];
                                            return [4 /*yield*/, supabase
                                                    .from("encounters")
                                                    .select("*")
                                                    .eq("id", lead.encounter_id)
                                                    .maybeSingle()];
                                        case 2:
                                            encounter = (_a.sent()).data;
                                            encounterData = encounter;
                                            _a.label = 3;
                                        case 3: return [2 /*return*/, {
                                                lead_id: lead.id,
                                                encounter_id: lead.encounter_id,
                                                parent_name: (encounterData === null || encounterData === void 0 ? void 0 : encounterData.parent_name) || (user === null || user === void 0 ? void 0 : user.name) || "".concat((user === null || user === void 0 ? void 0 : user.first_name) || '', " ").concat((user === null || user === void 0 ? void 0 : user.last_name) || '').trim() || null,
                                                parent_email: (encounterData === null || encounterData === void 0 ? void 0 : encounterData.parent_email) || (user === null || user === void 0 ? void 0 : user.email) || null,
                                                created_at: lead.created_at,
                                            }];
                                    }
                                });
                            }); }))];
                    case 2:
                        enriched = _a.sent();
                        console.log("📊 Enriched leads count:", enriched.length);
                        return [2 /*return*/, enriched];
                }
            });
        });
    };
    SupabaseStorage.prototype.recordClose = function (affiliateId, parentId, studentId, podId) {
        return __awaiter(this, void 0, void 0, function () {
            var lead, _a, data, error;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, supabase
                            .from("leads")
                            .select("id")
                            .eq("affiliate_id", affiliateId)
                            .eq("user_id", parentId)
                            .maybeSingle()];
                    case 1:
                        lead = (_b.sent()).data;
                        if (!lead) {
                            throw new Error("Lead not found");
                        }
                        return [4 /*yield*/, supabase
                                .from("closes")
                                .select("id")
                                .eq("affiliate_id", affiliateId)
                                .eq("lead_id", lead.id)
                                .eq("parent_id", parentId)
                                .eq("student_id", studentId)
                                .limit(1)
                                .maybeSingle()];
                    case 2:
                        if ((_b.sent()).data) {
                            throw new Error("A production reward has already been recorded for this conversion");
                        }
                        return [4 /*yield*/, supabase
                                .from("intro_session_drills")
                                .select("id")
                                .eq("student_id", studentId)
                                .limit(1)
                                .maybeSingle()];
                    case 3:
                        if (!((_b.sent()).data)) {
                            throw new Error("A completed trial is required before a production reward can be recorded");
                        }
                        return [4 /*yield*/, supabase
                                .from("payment_transactions")
                                .select("id")
                                .eq("parent_id", parentId)
                                .eq("student_id", studentId)
                                .eq("payment_status", "paid")
                                .limit(1)
                                .maybeSingle()];
                    case 4:
                        if (!((_b.sent()).data)) {
                            throw new Error("A verified paid subscription is required before a production reward can be recorded");
                        }
                        return [4 /*yield*/, supabase
                                .from("closes")
                                .insert({
                                affiliate_id: affiliateId,
                                parent_id: parentId,
                                lead_id: lead.id,
                                student_id: studentId,
                                pod_id: podId || null,
                                commission_amount: "100.00",
                                commission_status: "pending",
                                closed_at: new Date().toISOString(),
                            })
                                .select()
                                .single()];
                    case 5:
                        _a = _b.sent(), data = _a.data, error = _a.error;
                        if (error)
                            throw error;
                        return [2 /*return*/, data];
                }
            });
        });
    };
    SupabaseStorage.prototype.getCloses = function (affiliateId) {
        return __awaiter(this, void 0, void 0, function () {
            var closes, enriched;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, supabase
                            .from("closes")
                            .select("*")
                            .eq("affiliate_id", affiliateId)
                            .order("closed_at", { ascending: false })];
                    case 1:
                        closes = (_a.sent()).data;
                        if (!closes)
                            return [2 /*return*/, []];
                        console.log("📊 Raw closes data from DB:", closes.length, "closes");
                        return [4 /*yield*/, Promise.all(closes.map(function (close) { return __awaiter(_this, void 0, void 0, function () {
                                var lead, user, encounterData, encounter;
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0: return [4 /*yield*/, supabase
                                                .from("leads")
                                                .select("*")
                                                .eq("id", close.lead_id)
                                                .maybeSingle()];
                                        case 1:
                                            lead = (_a.sent()).data;
                                            return [4 /*yield*/, supabase
                                                    .from("users")
                                                    .select("id, email, first_name, last_name, name")
                                                    .eq("id", close.parent_id)
                                                    .maybeSingle()];
                                        case 2:
                                            user = (_a.sent()).data;
                                            encounterData = null;
                                            if (!(lead === null || lead === void 0 ? void 0 : lead.encounter_id)) return [3 /*break*/, 4];
                                            return [4 /*yield*/, supabase
                                                    .from("encounters")
                                                    .select("*")
                                                    .eq("id", lead.encounter_id)
                                                    .maybeSingle()];
                                        case 3:
                                            encounter = (_a.sent()).data;
                                            encounterData = encounter;
                                            _a.label = 4;
                                        case 4: return [2 /*return*/, {
                                                close_id: close.id,
                                                lead_id: close.lead_id,
                                                encounter_id: (lead === null || lead === void 0 ? void 0 : lead.encounter_id) || null,
                                                parent_name: (encounterData === null || encounterData === void 0 ? void 0 : encounterData.parent_name) || (user === null || user === void 0 ? void 0 : user.name) || "".concat((user === null || user === void 0 ? void 0 : user.first_name) || '', " ").concat((user === null || user === void 0 ? void 0 : user.last_name) || '').trim() || null,
                                                parent_email: (encounterData === null || encounterData === void 0 ? void 0 : encounterData.parent_email) || (user === null || user === void 0 ? void 0 : user.email) || null,
                                                commission_amount: close.commission_amount,
                                                commission_status: close.commission_status,
                                                closed_at: close.closed_at,
                                                created_at: close.created_at,
                                            }];
                                    }
                                });
                            }); }))];
                    case 2:
                        enriched = _a.sent();
                        console.log("📊 Enriched closes count:", enriched.length);
                        return [2 /*return*/, enriched];
                }
            });
        });
    };
    SupabaseStorage.prototype.getAffiliateStats = function (affiliateId) {
        return __awaiter(this, void 0, void 0, function () {
            var _a, encounters, leads, closes, objected;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, Promise.all([
                            supabase
                                .from("encounters")
                                .select("id", { count: "exact" })
                                .eq("affiliate_id", affiliateId),
                            supabase
                                .from("leads")
                                .select("id", { count: "exact" })
                                .eq("affiliate_id", affiliateId),
                            supabase
                                .from("closes")
                                .select("id", { count: "exact" })
                                .eq("affiliate_id", affiliateId),
                            supabase
                                .from("encounters")
                                .select("id", { count: "exact" })
                                .eq("affiliate_id", affiliateId)
                                .eq("status", "objected"),
                        ])];
                    case 1:
                        _a = _b.sent(), encounters = _a[0], leads = _a[1], closes = _a[2], objected = _a[3];
                        return [2 /*return*/, {
                                encounters: encounters.count || 0,
                                leads: leads.count || 0,
                                closes: closes.count || 0,
                                objected: objected.count || 0,
                            }];
                }
            });
        });
    };
    SupabaseStorage.prototype.saveAffiliateReflection = function (affiliateId, reflectionText) {
        return __awaiter(this, void 0, void 0, function () {
            var _a, data, error;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, supabase
                            .from("affiliate_reflections")
                            .upsert({
                            affiliate_id: affiliateId,
                            reflection_text: reflectionText,
                        }, { onConflict: "affiliate_id" })
                            .select()
                            .single()];
                    case 1:
                        _a = _b.sent(), data = _a.data, error = _a.error;
                        if (error)
                            throw error;
                        return [2 /*return*/, data];
                }
            });
        });
    };
    SupabaseStorage.prototype.getAffiliateReflection = function (affiliateId) {
        return __awaiter(this, void 0, void 0, function () {
            var data;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, supabase
                            .from("affiliate_reflections")
                            .select("*")
                            .eq("affiliate_id", affiliateId)
                            .maybeSingle()];
                    case 1:
                        data = (_a.sent()).data;
                        return [2 /*return*/, data || null];
                }
            });
        });
    };
    SupabaseStorage.prototype.getAffiliateLeadsByStatus = function (affiliateId) {
        return __awaiter(this, void 0, void 0, function () {
            var leads, closes, encounters, objected, breakdown;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.getLeads(affiliateId)];
                    case 1:
                        leads = _a.sent();
                        return [4 /*yield*/, this.getCloses(affiliateId)];
                    case 2:
                        closes = _a.sent();
                        return [4 /*yield*/, this.getEncounters(affiliateId)];
                    case 3:
                        encounters = _a.sent();
                        objected = encounters.filter(function (e) { return e.status === "objected"; });
                        console.log("🔍 DEBUGGING getAffiliateLeadsByStatus for affiliate:", affiliateId);
                        console.log("📊 Encounters count:", encounters.length, "Encounters:", encounters.map(function (e) { return ({ id: e.id, status: e.status, parent_email: e.parent_email }); }));
                        console.log("📊 Leads count:", leads.length, "Leads:", leads.map(function (l) { return ({ lead_id: l.lead_id, encounter_id: l.encounter_id, parent_email: l.parent_email }); }));
                        console.log("📊 Closes count:", closes.length);
                        console.log("📊 Objections count:", objected.length);
                        breakdown = {
                            all: encounters.length,
                            leads: leads.length,
                            closes: closes.length,
                            objections: objected.length,
                        };
                        console.log("📈 Final breakdown:", breakdown);
                        return [2 /*return*/, breakdown];
                }
            });
        });
    };
    // Initialize affiliate tables if they don't exist
    SupabaseStorage.prototype.initializeAffiliateTables = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _a, data, error, sql, neon, sqlClient, statements, _i, statements_1, statement, dbError_1, error_3;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 12, , 13]);
                        return [4 /*yield*/, supabase
                                .from("affiliate_codes")
                                .select("1")
                                .limit(1)];
                    case 1:
                        _a = _b.sent(), data = _a.data, error = _a.error;
                        if (!(error && error.code === 'PGRST116')) return [3 /*break*/, 10];
                        // Table doesn't exist, create all affiliate tables
                        console.log('📋 Creating affiliate tables...');
                        sql = "\n          -- Affiliate Codes Table\n          CREATE TABLE IF NOT EXISTS affiliate_codes (\n            id BIGSERIAL PRIMARY KEY,\n            affiliate_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,\n            code VARCHAR(20) NOT NULL UNIQUE,\n            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()\n          );\n          \n          CREATE INDEX IF NOT EXISTS idx_affiliate_codes_affiliate_id ON affiliate_codes(affiliate_id);\n          CREATE INDEX IF NOT EXISTS idx_affiliate_codes_code ON affiliate_codes(code);\n          \n          -- Encounters Table\n          CREATE TABLE IF NOT EXISTS encounters (\n            id BIGSERIAL PRIMARY KEY,\n            affiliate_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,\n            parent_name VARCHAR(255) NOT NULL,\n            parent_email VARCHAR(255),\n            parent_phone VARCHAR(20),\n            child_name VARCHAR(255),\n            child_grade VARCHAR(50),\n            status VARCHAR(50) DEFAULT 'prospect',\n            notes TEXT,\n            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()\n          );\n          \n          CREATE INDEX IF NOT EXISTS idx_encounters_affiliate_id ON encounters(affiliate_id);\n          CREATE INDEX IF NOT EXISTS idx_encounters_status ON encounters(status);\n          \n          -- Leads Table\n          CREATE TABLE IF NOT EXISTS leads (\n            id BIGSERIAL PRIMARY KEY,\n            affiliate_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,\n            encounter_id BIGINT REFERENCES encounters(id) ON DELETE SET NULL,\n            user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,\n            lead_type VARCHAR(50),\n            status VARCHAR(50) DEFAULT 'open',\n            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()\n          );\n          \n          CREATE INDEX IF NOT EXISTS idx_leads_affiliate_id ON leads(affiliate_id);\n          CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);\n          \n          -- Closes Table\n          CREATE TABLE IF NOT EXISTS closes (\n            id BIGSERIAL PRIMARY KEY,\n            affiliate_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,\n            lead_id BIGINT REFERENCES leads(id) ON DELETE SET NULL,\n            parent_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,\n            commission_amount DECIMAL(10, 2),\n            commission_status VARCHAR(50) DEFAULT 'pending',\n            closed_at TIMESTAMP WITH TIME ZONE,\n            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()\n          );\n          \n          CREATE INDEX IF NOT EXISTS idx_closes_affiliate_id ON closes(affiliate_id);\n          CREATE INDEX IF NOT EXISTS idx_closes_commission_status ON closes(commission_status);\n          \n          -- Affiliate Reflections Table\n          CREATE TABLE IF NOT EXISTS affiliate_reflections (\n            id BIGSERIAL PRIMARY KEY,\n            affiliate_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,\n            reflection_type VARCHAR(50),\n            content TEXT,\n            key_wins TEXT,\n            challenges TEXT,\n            next_steps TEXT,\n            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()\n          );\n          \n          CREATE INDEX IF NOT EXISTS idx_affiliate_reflections_affiliate_id ON affiliate_reflections(affiliate_id);\n        ";
                        _b.label = 2;
                    case 2:
                        _b.trys.push([2, 8, , 9]);
                        return [4 /*yield*/, import("@neondatabase/serverless")];
                    case 3:
                        neon = (_b.sent()).neon;
                        sqlClient = neon(process.env.DATABASE_URL);
                        statements = sql.split(';').filter(function (stmt) { return stmt.trim(); });
                        _i = 0, statements_1 = statements;
                        _b.label = 4;
                    case 4:
                        if (!(_i < statements_1.length)) return [3 /*break*/, 7];
                        statement = statements_1[_i];
                        if (!statement.trim()) return [3 /*break*/, 6];
                        return [4 /*yield*/, sqlClient(statement)];
                    case 5:
                        _b.sent();
                        _b.label = 6;
                    case 6:
                        _i++;
                        return [3 /*break*/, 4];
                    case 7:
                        console.log('✅ Affiliate tables created successfully');
                        return [3 /*break*/, 9];
                    case 8:
                        dbError_1 = _b.sent();
                        console.warn('⚠️  Could not create tables via Neon client, tables may need manual creation:', dbError_1);
                        return [3 /*break*/, 9];
                    case 9: return [3 /*break*/, 11];
                    case 10:
                        if (!error) {
                            console.log('✅ Affiliate tables already exist');
                        }
                        _b.label = 11;
                    case 11: return [3 /*break*/, 13];
                    case 12:
                        error_3 = _b.sent();
                        console.error('Error initializing affiliate tables:', error_3);
                        return [3 /*break*/, 13];
                    case 13: return [2 /*return*/];
                }
            });
        });
    };
    return SupabaseStorage;
}());
export { SupabaseStorage };
export var storage = new SupabaseStorage();
// Initialize affiliate tables on startup
storage.initializeAffiliateTables().catch(function (err) {
    console.error('Failed to initialize affiliate tables:', err);
});
// Re-export db and tables for direct access in routes
export { db };
export { weeklyCheckIns } from "@shared/schema";
