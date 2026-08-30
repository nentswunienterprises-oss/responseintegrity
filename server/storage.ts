import { createClient } from "@supabase/supabase-js";
import { db } from "./db";
import {
  User, UpsertUser,
  Pod, InsertPod,
  TutorAssignment, InsertTutorAssignment,
  Student, InsertStudent,
  Session, InsertSession,
  Reflection, InsertReflection,
  AcademicProfile, InsertAcademicProfile,
  StruggleTarget, InsertStruggleTarget,
  VerificationDoc, InsertVerificationDoc,
  TutorApplication, InsertTutorApplication,
  Broadcast, InsertBroadcast,
  CooBrainLibraryItem, InsertCooBrainLibraryItem,
  Notification, InsertNotification,
  PushSubscriptionRecord, InsertPushSubscriptionRecord,
  TutorOnboardingAcceptance,
  InsertTutorOnboardingAcceptance,
  InsertTutorOnboardingClauseAcknowledgement,
  InsertTutorOnboardingAcceptanceEvent,
  RolePermission,
  affiliateCodes,
  weeklyCheckIns,
} from "@shared/schema";
import { isAllowedOdEmail, normalizeEmail } from "@shared/odAccess";
import type { TutorTrainingMode } from "@shared/battleTesting";

// Initialize Supabase client with service role key to bypass RLS
const supabaseUrl = process.env.SUPABASE_URL!;
// Use service role key if available (bypasses RLS), fall back to anon key
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY!;
export const supabase = createClient(supabaseUrl, supabaseKey);

// Create affiliate code (used by routes.ts)
export async function createAffiliateCode({ affiliateId, code, type, personName, entityName, schoolType, pipelineType = "demand", campaignName }: {
  affiliateId: string;
  code: string;
  type?: string;
  personName?: string;
  entityName?: string;
  schoolType?: string;
  pipelineType?: string;
  campaignName?: string;
}) {
  const text = `
    INSERT INTO affiliate_codes
      (affiliate_id, code, type, person_name, entity_name, school_type, pipeline_type, campaign_name, created_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING *;
  `;
  const values = [affiliateId, code, type, personName, entityName, schoolType, pipelineType, campaignName || null, new Date()];
  const result = await (await import('./db')).pool.query(text, values);
  return result.rows[0];
}

// Helper function to transform snake_case to camelCase
export function transformSnakeToCamel(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(transformSnakeToCamel);
  
  const result: any = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const camelKey = key.replace(/_([a-z0-9])/g, (_, char) => char.toUpperCase());
      result[camelKey] = transformSnakeToCamel(obj[key]);
    }
  }
  return result;
}

type SequentialDocumentStatus =
  | "not_started"
  | "pending_upload"
  | "pending_review"
  | "approved"
  | "rejected";

const INITIAL_TUTOR_DOCUMENT_STATUSES: Record<string, SequentialDocumentStatus> = {
  "1": "pending_upload",
  "2": "not_started",
  "3": "not_started",
  "4": "not_started",
  "5": "not_started",
  "6": "not_started",
};

const SEQUENTIAL_TUTOR_DOCUMENT_FIELDS: Record<
  number,
  {
    url: string;
    uploadedAt: string;
    verified: string;
    verifiedBy: string;
    verifiedAt: string;
    rejectionReason: string;
    completedTemplateUrl?: string;
    completedTemplateUploadedAt?: string;
    completedTemplateUploadedBy?: string;
    requiresCompletedTemplate: boolean;
  }
> = {
  1: {
    url: "doc_1_submission_url",
    uploadedAt: "doc_1_submission_uploaded_at",
    verified: "doc_1_submission_verified",
    verifiedBy: "doc_1_submission_verified_by",
    verifiedAt: "doc_1_submission_verified_at",
    rejectionReason: "doc_1_submission_rejection_reason",
    completedTemplateUrl: "doc_1_completed_template_url",
    completedTemplateUploadedAt: "doc_1_completed_template_uploaded_at",
    completedTemplateUploadedBy: "doc_1_completed_template_uploaded_by",
    requiresCompletedTemplate: true,
  },
  2: {
    url: "doc_2_submission_url",
    uploadedAt: "doc_2_submission_uploaded_at",
    verified: "doc_2_submission_verified",
    verifiedBy: "doc_2_submission_verified_by",
    verifiedAt: "doc_2_submission_verified_at",
    rejectionReason: "doc_2_submission_rejection_reason",
    completedTemplateUrl: "doc_2_completed_template_url",
    completedTemplateUploadedAt: "doc_2_completed_template_uploaded_at",
    completedTemplateUploadedBy: "doc_2_completed_template_uploaded_by",
    requiresCompletedTemplate: true,
  },
  3: {
    url: "doc_3_submission_url",
    uploadedAt: "doc_3_submission_uploaded_at",
    verified: "doc_3_submission_verified",
    verifiedBy: "doc_3_submission_verified_by",
    verifiedAt: "doc_3_submission_verified_at",
    rejectionReason: "doc_3_submission_rejection_reason",
    completedTemplateUrl: "doc_3_completed_template_url",
    completedTemplateUploadedAt: "doc_3_completed_template_uploaded_at",
    completedTemplateUploadedBy: "doc_3_completed_template_uploaded_by",
    requiresCompletedTemplate: true,
  },
  4: {
    url: "doc_4_submission_url",
    uploadedAt: "doc_4_submission_uploaded_at",
    verified: "doc_4_submission_verified",
    verifiedBy: "doc_4_submission_verified_by",
    verifiedAt: "doc_4_submission_verified_at",
    rejectionReason: "doc_4_submission_rejection_reason",
    completedTemplateUrl: "doc_4_completed_template_url",
    completedTemplateUploadedAt: "doc_4_completed_template_uploaded_at",
    completedTemplateUploadedBy: "doc_4_completed_template_uploaded_by",
    requiresCompletedTemplate: true,
  },
  5: {
    url: "doc_5_submission_url",
    uploadedAt: "doc_5_submission_uploaded_at",
    verified: "doc_5_submission_verified",
    verifiedBy: "doc_5_submission_verified_by",
    verifiedAt: "doc_5_submission_verified_at",
    rejectionReason: "doc_5_submission_rejection_reason",
    completedTemplateUrl: "doc_5_completed_template_url",
    completedTemplateUploadedAt: "doc_5_completed_template_uploaded_at",
    completedTemplateUploadedBy: "doc_5_completed_template_uploaded_by",
    requiresCompletedTemplate: true,
  },
  6: {
    url: "doc_6_submission_url",
    uploadedAt: "doc_6_submission_uploaded_at",
    verified: "doc_6_submission_verified",
    verifiedBy: "doc_6_submission_verified_by",
    verifiedAt: "doc_6_submission_verified_at",
    rejectionReason: "doc_6_submission_rejection_reason",
    requiresCompletedTemplate: false,
  },
};

function normalizeTutorDocumentStatuses(statuses: any): Record<string, SequentialDocumentStatus> {
  return {
    ...INITIAL_TUTOR_DOCUMENT_STATUSES,
    ...(statuses && typeof statuses === "object" ? statuses : {}),
  };
}

function getSequentialTutorDocumentFields(docStep: number) {
  const fields = SEQUENTIAL_TUTOR_DOCUMENT_FIELDS[docStep];
  if (!fields) {
    throw new Error(`Invalid sequential tutor document step: ${docStep}`);
  }

  return fields;
}

interface CreateTutorOnboardingAcceptanceInput {
  applicationId: string;
  userId: string;
  documentStep: number;
  documentCode: string;
  documentTitle: string;
  documentVersion: string;
  documentEffectiveDate?: string | null;
  documentLastUpdatedAt?: Date | null;
  documentSnapshot: string;
  documentChecksum: string;
  typedFullName: string;
  accountEmail: string;
  phoneNumberSnapshot?: string | null;
  acceptedTimezone?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  deviceType?: string | null;
  platform?: string | null;
  sessionId?: string | null;
  locale?: string | null;
  sourceFlow?: string | null;
  formSnapshotJson?: Record<string, string> | null;
  acceptedClauses: { key: string; label: string }[];
  scrollCompletionPercent?: number | null;
  viewStartedAt?: Date | null;
  viewCompletedAt?: Date | null;
  acceptClickedAt?: Date | null;
}

function buildCurrentStepFromStatuses(statuses: Record<string, SequentialDocumentStatus>): number {
  for (let step = 1; step <= 6; step++) {
    if (String(statuses[step.toString()] || "not_started") !== "approved") {
      return step;
    }
  }

  return 6;
}

function hasAcceptanceOnlyStep(docStep: number) {
  return docStep === 1 || docStep === 3 || docStep === 4 || docStep === 5;
}

async function hydrateTutorApplicationsWithOnboardingState(
  applications: TutorApplication[]
): Promise<TutorApplication[]> {
  if (!applications.length) {
    return applications;
  }

  const applicationIds = applications.map((application) => application.id).filter(Boolean);
  if (!applicationIds.length) {
    return applications;
  }

  const { data: acceptanceRows, error: acceptanceError } = await supabase
    .from("tutor_onboarding_acceptances")
    .select("*")
    .in("application_id", applicationIds)
    .order("accepted_at", { ascending: false });

  if (acceptanceError) {
    console.error("Error hydrating tutor onboarding acceptances:", acceptanceError);
  }

  const acceptancesByApplication = new Map<string, any[]>();
  for (const row of acceptanceRows ?? []) {
    const current = acceptancesByApplication.get(row.application_id) ?? [];
    current.push(transformSnakeToCamel(row));
    acceptancesByApplication.set(row.application_id, current);
  }

  return applications.map((application) => {
    const acceptanceRowsForApplication = acceptancesByApplication.get(application.id) ?? [];
    const latestAcceptanceByStep = acceptanceRowsForApplication.reduce<Record<string, any>>((accumulator, acceptance) => {
      const key = String(acceptance.documentStep);
      if (!accumulator[key]) {
        accumulator[key] = acceptance;
      }
      return accumulator;
    }, {});

    return {
      ...application,
      onboardingAcceptances: acceptanceRowsForApplication,
      onboardingAcceptanceMap: latestAcceptanceByStep,
    };
  });
}

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUsersByRole(role: string): Promise<User[]>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUserVerification(id: string, verified: boolean): Promise<User | undefined>;
  updateUserProfile(id: string, data: { phone?: string | null; bio?: string | null; profileImageUrl?: string | null }): Promise<User | undefined>;

  createPod(pod: InsertPod): Promise<Pod>;
  getPod(id: string): Promise<Pod | undefined>;
  getPods(): Promise<Pod[]>;
  getPodByTD(tdId: string): Promise<Pod | undefined>;
  getPodsByTD(tdId: string): Promise<Pod[]>;
  updatePodTD(podId: string, tdId: string): Promise<void>;

  createTutorAssignment(assignment: InsertTutorAssignment): Promise<TutorAssignment>;
  getTutorAssignment(tutorId: string): Promise<(TutorAssignment & { pod: Pod }) | undefined>;
  getTutorAssignmentsByPod(podId: string): Promise<TutorAssignment[]>;
  updateCertificationStatus(id: string, status: string): Promise<void>;
  updateTutorOperationalMode(id: string, operationalMode: TutorTrainingMode): Promise<void>;
  deleteTutorAssignment(id: string): Promise<void>;

  createStudent(student: InsertStudent): Promise<Student>;
  getStudent(id: string): Promise<Student | undefined>;
  getStudentsByTutor(tutorId: string): Promise<Student[]>;
  updateStudent(id: string, data: Partial<Student>): Promise<Student | undefined>;
  updateStudentProgress(id: string, sessionCount: number, confidenceDelta: number): Promise<void>;

  createSession(session: InsertSession): Promise<Session>;
  getSessionsByTutor(tutorId: string): Promise<Session[]>;
  getSessionsByStudent(studentId: string): Promise<Session[]>;
  getSessionsByPod(podId: string): Promise<Session[]>;

  createReflection(reflection: InsertReflection): Promise<Reflection>;
  getReflectionsByTutor(tutorId: string): Promise<Reflection[]>;

  getAcademicProfile(studentId: string): Promise<AcademicProfile | undefined>;
  upsertAcademicProfile(profile: InsertAcademicProfile): Promise<AcademicProfile>;

  getStruggleTargets(studentId: string): Promise<StruggleTarget[]>;
  createStruggleTarget(target: InsertStruggleTarget): Promise<StruggleTarget>;
  updateStruggleTarget(id: string, data: Partial<InsertStruggleTarget>): Promise<StruggleTarget | undefined>;
  deleteStruggleTarget(id: string): Promise<void>;

  createVerificationDoc(doc: InsertVerificationDoc): Promise<VerificationDoc>;
  getVerificationDocByTutor(tutorId: string): Promise<VerificationDoc | undefined>;
  updateVerificationStatus(tutorId: string, status: string): Promise<void>;

  createBroadcast(broadcast: InsertBroadcast): Promise<Broadcast>;
  getBroadcasts(userCreatedAt?: string): Promise<Broadcast[]>;
  getCooBrainLibraryItems(): Promise<CooBrainLibraryItem[]>;
  createCooBrainLibraryItem(item: InsertCooBrainLibraryItem): Promise<CooBrainLibraryItem>;
  
  markBroadcastAsRead(userId: string, broadcastId: string): Promise<void>;
  getUnreadBroadcastCount(userId: string, userCreatedAt?: string): Promise<number>;
  getUserBroadcastReads(userId: string): Promise<string[]>; // Returns array of read broadcast IDs

  createNotification(notification: InsertNotification): Promise<Notification>;
  getNotifications(userId: string, userCreatedAt?: string): Promise<Notification[]>;
  markNotificationAsRead(userId: string, notificationId: string): Promise<void>;
  getUnreadNotificationCount(userId: string, userCreatedAt?: string): Promise<number>;
  upsertPushSubscription(subscription: InsertPushSubscriptionRecord): Promise<PushSubscriptionRecord>;
  getPushSubscriptionsByUser(userId: string): Promise<PushSubscriptionRecord[]>;
  deletePushSubscriptionByEndpoint(endpoint: string): Promise<void>;

  createTutorApplication(application: InsertTutorApplication): Promise<TutorApplication>;
  getTutorApplicationsByUser(userId: string): Promise<TutorApplication[]>;
  getTutorApplications(): Promise<TutorApplication[]>;
  getTutorApplicationsByStatus(status: "pending" | "approved" | "rejected"): Promise<TutorApplication[]>;
  approveTutorApplication(id: string, reviewedBy: string): Promise<TutorApplication | undefined>;
  rejectTutorApplication(id: string, reviewedBy: string, reason: string): Promise<TutorApplication | undefined>;
  getApprovedTutors(): Promise<User[]>;
  
  updateTutorSequentialDocument(
    applicationId: string,
    docStep: number,
    documentUrl: string
  ): Promise<TutorApplication | undefined>;
  createTutorOnboardingAcceptance(
    input: CreateTutorOnboardingAcceptanceInput
  ): Promise<{ application?: TutorApplication; acceptance?: TutorOnboardingAcceptance }>;
  uploadCompletedTutorSequentialDocument(
    applicationId: string,
    docStep: number,
    completedDocumentUrl: string,
    completedBy: string
  ): Promise<TutorApplication | undefined>;
  reviewTutorSequentialDocument(
    applicationId: string,
    docStep: number,
    approved: boolean,
    reviewedBy: string,
    completedDocumentUrl?: string,
    rejectionReason?: string
  ): Promise<TutorApplication | undefined>;
  completeTutorOnboarding(applicationId: string): Promise<TutorApplication | undefined>;

  checkRoleAuthorization(email: string, role: "tutor" | "td" | "coo" | "od"): Promise<boolean>;
  addRolePermission(permission: RolePermission): Promise<void>;
  getRolePermissions(): Promise<RolePermission[]>;
  checkTDPodAssignment(email: string): Promise<string | null>;
}

export class SupabaseStorage implements IStorage {
  // Drizzle DB instance for direct queries (used for weekly check-ins, etc.)
  db = db;
  weeklyCheckIns = weeklyCheckIns;

  // Users
  // In-memory cache for the duration of a request (keyed by userId)
  __userCache: Record<string, User | undefined> = {};

  async getUser(id: string): Promise<User | undefined> {
    // Check in-memory cache first
    if (this.__userCache[id]) {
      return this.__userCache[id];
    }
    try {
      // Explicitly select only user columns to avoid any relationship pollution
      const { data, error } = await supabase
        .from("users")
        .select("id,email,first_name,last_name,phone,bio,profile_image_url,password,role,name,grade,school,verified,created_at,updated_at")
        .eq("id", id)
        .maybeSingle();
      if (error) {
        console.error("Error fetching user:", error);
        return undefined;
      }
      if (!data) {
        return undefined;
      }
      // Transform snake_case to camelCase
      const user = {
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
      // Validate role is one of the expected values
      const validRoles = ["parent", "student", "tutor", "td", "affiliate", "od", "coo", "hr", "ceo", "cto", "cmo"];
      if (!validRoles.includes(data.role as string)) {
        console.error("❌ INVALID ROLE DETECTED:", data.role, "for user", id);
        console.error("   Full user data:", JSON.stringify(data));
      }
      // Store in cache for this request
      this.__userCache[id] = user as User;
      return user as User;
    } catch (err) {
      console.error("Exception in getUser:", err);
      return undefined;
    }
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    try {
      // Explicitly select only user columns to avoid any relationship pollution
      const { data, error } = await supabase
        .from("users")
        .select("id,email,first_name,last_name,phone,bio,profile_image_url,password,role,name,grade,school,verified,created_at,updated_at")
        .eq("email", email)
        .maybeSingle();
      
      if (error) {
        console.error("❌ Error fetching user by email:", error);
        return undefined;
      }
      
      if (!data) {
        return undefined;
      }
      
      // Transform snake_case to camelCase
      const user = {
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
      
      // Validate role is one of the expected values
      const validRoles = ["parent", "student", "tutor", "td", "affiliate", "od", "coo", "hr", "ceo", "cto", "cmo"];
      if (!validRoles.includes(data.role as string)) {
        console.error("❌ INVALID ROLE DETECTED:", data.role, "for email", email);
        console.error("   Full user data:", JSON.stringify(data));
      }
      
      return user as User;
    } catch (err) {
      console.error("Exception in getUserByEmail:", err);
      return undefined;
    }
  }

  async getUsersByRole(role: string): Promise<User[]> {
    const { data } = await supabase.from("users").select("id,email,first_name,last_name,phone,bio,profile_image_url,password,role,name,grade,school,verified,created_at,updated_at").eq("role", role);
    if (!data) return [];
    
    // Transform snake_case to camelCase
    return data.map(d => ({
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
    }));
  }

  async upsertUser(user: any): Promise<User> {
    const dbUser: any = {
      id: user.id,
      email: user.email,
      first_name: user.firstName,
      last_name: user.lastName,
      phone: user.phone,
      bio: user.bio,
      profile_image_url: user.profileImageUrl,
      name: [user.firstName, user.lastName].filter(Boolean).join(" ") || "User",
    };
    if (user.role) {
      if (user.role === "od" && !isAllowedOdEmail(user.email)) {
        throw new Error("This email is not allowed to use the OD role");
      }
      dbUser.role = user.role;
    }

    const { data, error } = await supabase
      .from("users")
      .upsert(dbUser)
      .select("id,email,first_name,last_name,phone,bio,profile_image_url,password,role,name,grade,school,verified,created_at,updated_at")
      .single();
    if (error) throw new Error(`Supabase error: ${error.message}`);
    if (!data) throw new Error("Failed to upsert user");
    
    // Transform snake_case to camelCase
    return {
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
    } as User;
  }

  async updateUserVerification(id: string, verified: boolean): Promise<User | undefined> {
    const { data } = await supabase.from("users").update({ verified, updated_at: new Date() }).eq("id", id).select("id,email,first_name,last_name,phone,bio,profile_image_url,password,role,name,grade,school,verified,created_at,updated_at").single();
    if (!data) return undefined;
    
    // Transform snake_case to camelCase
    return {
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
    } as User;
  }

  async updateUserProfile(id: string, data: { phone?: string | null; bio?: string | null; profileImageUrl?: string | null }): Promise<User | undefined> {
    const updateData: any = { updated_at: new Date() };
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.bio !== undefined) updateData.bio = data.bio;
    if (data.profileImageUrl !== undefined) updateData.profile_image_url = data.profileImageUrl;

    const { data: result } = await supabase.from("users").update(updateData).eq("id", id).select("id,email,first_name,last_name,phone,bio,profile_image_url,password,role,name,grade,school,verified,created_at,updated_at").single();
    if (!result) return undefined;
    
    // Transform snake_case to camelCase
    return {
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
    } as User;
  }

  // Pods
  async createPod(pod: any): Promise<Pod> {
    console.log("💾 Inserting pod into database:", pod);
    const dbPod = {
      pod_name: pod.podName,
      pod_type: pod.podType,
      phase: pod.phase,
      td_id: pod.tdId,
      status: pod.status,
      start_date: pod.startDate,
      end_date: pod.endDate,
    };
    const { data, error } = await supabase.from("pods").insert(dbPod).select().single();
    if (error) {
      console.error("❌ Supabase error creating pod:", error);
      throw new Error(`Failed to create pod: ${error.message}`);
    }
    if (!data) {
      console.error("❌ No data returned from pod creation");
      throw new Error("Failed to create pod: No data returned");
    }
    console.log("✅ Pod created in database:", data);
    return data;
  }

  async getPod(id: string): Promise<Pod | undefined> {
    const { data } = await supabase.from("pods").select("*").eq("id", id).maybeSingle();
    if (!data) return undefined;
    // Transform snake_case to camelCase
    return {
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
    };
  }

  async getPods(): Promise<Pod[]> {
    const { data } = await supabase.from("pods").select("*").is("deleted_at", null);
    if (!data) return [];
    // Transform snake_case to camelCase
    return data.map((pod: any) => ({
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
    }));
  }

  async getDeletedPods(): Promise<Pod[]> {
    const { data } = await supabase.from("pods").select("*").not("deleted_at", "is", null);
    if (!data) return [];
    // Transform snake_case to camelCase
    return data.map((pod: any) => ({
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
    }));
  }

  async deletePod(podId: string): Promise<void> {
    // Soft delete: set deleted_at timestamp and clear td_id
    const { error } = await supabase
      .from("pods")
      .update({ deleted_at: new Date().toISOString(), td_id: null })
      .eq("id", podId);
    if (error) {
      throw new Error(`Failed to soft-delete pod ${podId}: ${error.message}`);
    }
  }

  async getPodByTD(tdId: string): Promise<Pod | undefined> {
    const { data } = await supabase
      .from("pods")
      .select("*")
      .eq("td_id", tdId)
      .is("deleted_at", null)
      .limit(1)
      .maybeSingle();
    if (!data) return undefined;
    // Transform snake_case to camelCase
    return {
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
    };
  }

  async getPodsByTD(tdId: string): Promise<Pod[]> {
    const { data } = await supabase
      .from("pods")
      .select("*")
      .eq("td_id", tdId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true });
    if (!data) return [];
    // Transform snake_case to camelCase
    return data.map(pod => ({
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
    }));
  }

  async updatePodTD(podId: string, tdId: string): Promise<void> {
    await supabase.from("pods").update({ td_id: tdId }).eq("id", podId);
  }

  // Tutor Assignments
  async createTutorAssignment(assignment: any): Promise<TutorAssignment> {
    const existingAssignment = await this.getTutorAssignment(assignment.tutorId);
    if (existingAssignment) {
      if (existingAssignment.podId === assignment.podId) {
        throw new Error("Tutor is already assigned to this pod");
      }

      throw new Error("Tutor is already assigned to another pod");
    }

    const dbAssignment = {
      tutor_id: assignment.tutorId,
      pod_id: assignment.podId,
      student_count: assignment.studentCount || 0,
      certification_status: assignment.certificationStatus,
      operational_mode: assignment.operationalMode || "training",
    };
    const { data } = await supabase.from("tutor_assignments").insert(dbAssignment).select().single();
    if (!data) throw new Error("Failed to create tutor assignment");
    // Transform snake_case to camelCase
    return {
      id: data.id,
      tutorId: data.tutor_id,
      podId: data.pod_id,
      studentCount: data.student_count,
      certificationStatus: data.certification_status,
      operationalMode: data.operational_mode,
      createdAt: data.created_at,
    };
  }

  async getTutorAssignment(tutorId: string): Promise<(TutorAssignment & { pod: Pod }) | undefined> {
    console.log("🔍 Looking for tutor assignment for tutorId:", tutorId);
    const { data, error } = await supabase.from("tutor_assignments").select("*").eq("tutor_id", tutorId).maybeSingle();
    if (error) {
      console.log("ℹ️ No assignment found (expected for single()):", error.message);
    }
    if (!data) {
      console.log("❌ No assignment data returned");
      return undefined;
    }
    console.log("✅ Found assignment:", JSON.stringify(data, null, 2));
    const pod = await this.getPod(data.pod_id);
    if (!pod) {
      console.log("❌ Pod not found for pod_id:", data.pod_id);
      return undefined;
    }
    // Transform snake_case to camelCase
    return {
      id: data.id,
      tutorId: data.tutor_id,
      podId: data.pod_id,
      studentCount: data.student_count,
      certificationStatus: data.certification_status,
      operationalMode: data.operational_mode,
      createdAt: data.created_at,
      pod,
    };
  }

  async getTutorAssignmentsByPod(podId: string): Promise<TutorAssignment[]> {
    const { data } = await supabase.from("tutor_assignments").select("*").eq("pod_id", podId);
    if (!data) return [];
    // Transform snake_case to camelCase
    return data.map((assignment: any) => ({
      id: assignment.id,
      tutorId: assignment.tutor_id,
      podId: assignment.pod_id,
      studentCount: assignment.student_count,
      certificationStatus: assignment.certification_status,
      operationalMode: assignment.operational_mode,
      createdAt: assignment.created_at,
    }));
  }

  async updateCertificationStatus(id: string, status: string): Promise<void> {
    await supabase.from("tutor_assignments").update({ certification_status: status }).eq("id", id);
  }

  async updateTutorOperationalMode(id: string, operationalMode: TutorTrainingMode): Promise<void> {
    await supabase.from("tutor_assignments").update({ operational_mode: operationalMode }).eq("id", id);
  }

  async deleteTutorAssignment(id: string): Promise<void> {
    const { error } = await supabase.from("tutor_assignments").delete().eq("id", id);
    if (error) {
      throw new Error(`Failed to delete tutor assignment ${id}: ${error.message}`);
    }
  }

  // Students
  async createStudent(student: any): Promise<Student> {
    // Bulletproof parent_id assignment with explicit logging
    let parentId: string | null = (student as any).parent_id || null;
    let parentEnrollmentId: string | null = null;
    if (!parentId && student.parentContact) {
      const { data: parentRow, error: parentLookupError } = await supabase
        .from("parent_enrollments")
        .select("user_id, id")
        .eq("parent_email", student.parentContact)
        .maybeSingle();
      if (parentLookupError) {
        console.error("[createStudent] Error looking up parent_enrollments:", parentLookupError);
      }
      if (parentRow && parentRow.user_id) {
        parentId = parentRow.user_id;
        parentEnrollmentId = parentRow.id || null;
      } else {
        console.error("[createStudent] No parent_enrollments row found for parentContact:", student.parentContact);
      }
    }
    if (!parentId) {
      console.error("[createStudent] Failed to resolve parent_id for student:", student);
      throw new Error("Cannot create student without parent_id. Provide parent_id or valid parentContact.");
    }
    // Try to find parentEnrollmentId if not already set
    if (!parentEnrollmentId && parentId && student.tutorId) {
      const { data: enroll } = await supabase
        .from("parent_enrollments")
        .select("id")
        .eq("user_id", parentId)
        .eq("assigned_tutor_id", student.tutorId)
        .maybeSingle();
      if (enroll && enroll.id) {
        parentEnrollmentId = enroll.id;
      }
    }
    // Ensure all required fields are present
    if (!student.name || !student.grade || !student.tutorId) {
      console.error("[createStudent] Missing required student fields:", student);
      throw new Error("Missing required student fields (name, grade, tutorId)");
    }
    const dbStudent = {
      name: student.name,
      grade: student.grade,
      tutor_id: student.tutorId,
      session_progress: student.sessionProgress ?? 0,
      concept_mastery: student.conceptMastery ?? {},
      parent_contact: student.parentContact,
      parent_id: parentId,
      parent_enrollment_id: parentEnrollmentId,
    };
    const { data, error: insertError } = await supabase.from("students").insert(dbStudent).select().single();
    if (insertError) {
      console.error("[createStudent] Supabase insert error:", insertError, dbStudent);
      throw new Error("Failed to create student: " + insertError.message);
    }
    if (!data) {
      console.error("[createStudent] Supabase insert returned no data:", dbStudent);
      throw new Error("Failed to create student: No data returned");
    }
    return transformSnakeToCamel(data);
  }

  async getStudent(id: string): Promise<Student | undefined> {
    const { data } = await supabase.from("students").select("*").eq("id", id).maybeSingle();
    if (!data) return undefined;
    return transformSnakeToCamel(data);
  }

  async getStudentsByTutor(tutorId: string): Promise<Student[]> {
    const { data } = await supabase.from("students").select("*").eq("tutor_id", tutorId);
    if (!data) return [];
    return (data ?? [])
      .filter(student => student.id && student.id.trim() !== "")
      .map(student => transformSnakeToCamel(student));
  }

  async updateStudentProgress(id: string, sessionCount: number, confidenceDelta: number): Promise<void> {
    const student = await this.getStudent(id);
    if (!student) return;
    await supabase.from("students").update({ session_progress: sessionCount, updated_at: new Date() }).eq("id", id);
  }

  async updateStudent(id: string, data: Partial<Student>): Promise<Student | undefined> {
    // Convert camelCase keys to snake_case for database
    const dbData: any = {};
    for (const [key, value] of Object.entries(data)) {
      if (key === 'id' || key === 'createdAt') continue; // Skip readonly fields
      const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
      dbData[snakeKey] = value;
    }

    const { data: updated, error } = await supabase
      .from("students")
      .update(dbData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating student:", error);
      return undefined;
    }

    return transformSnakeToCamel(updated);
  }

  // Session
  async createSession(session: any): Promise<Session> {
    const dbSession = {
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
    const { data } = await supabase.from("tutoring_sessions").insert(dbSession).select().single();
    if (!data) throw new Error("Failed to create session");
    return transformSnakeToCamel(data) as Session;
  }

  async getSessionsByTutor(tutorId: string): Promise<Session[]> {
    const { data } = await supabase.from("tutoring_sessions").select("*").eq("tutor_id", tutorId).order("date", { ascending: false });
    return (data ?? []).map(transformSnakeToCamel) as Session[];
  }

  async getSessionsByStudent(studentId: string): Promise<Session[]> {
    const { data } = await supabase.from("tutoring_sessions").select("*").eq("student_id", studentId).order("date", { ascending: false });
    return (data ?? []).map(transformSnakeToCamel) as Session[];
  }

  async getSessionsByPod(podId: string): Promise<Session[]> {
    // Get all tutors in this pod, then get all their sessions
    const { data: assignments } = await supabase
      .from("tutor_assignments")
      .select("tutor_id")
      .eq("pod_id", podId);
    
    if (!assignments || assignments.length === 0) {
      return [];
    }

    const tutorIds = assignments.map((a: any) => a.tutor_id);
    
    // Get all sessions for these tutors
    const { data } = await supabase
      .from("tutoring_sessions")
      .select("*")
      .in("tutor_id", tutorIds)
      .order("date", { ascending: false });
    
    return (data ?? []).map(transformSnakeToCamel) as Session[];
  }

  // Reflections
  async createReflection(reflection: any): Promise<Reflection> {
    const { data } = await supabase.from("reflections").insert({
      tutor_id: reflection.tutorId,
      date: reflection.date,
      reflection_text: reflection.reflectionText,
    }).select("id, tutor_id, date, reflection_text, created_at");
    
    if (!data || data.length === 0) throw new Error("Failed to create reflection");
    
    const row = data[0];
    return {
      id: row.id,
      tutorId: row.tutor_id,
      reflectionText: row.reflection_text,
      date: row.date,
      createdAt: row.created_at,
    } as Reflection;
  }

  async getReflectionsByTutor(tutorId: string): Promise<Reflection[]> {
    const { data } = await supabase
      .from("reflections")
      .select("id, tutor_id, date, reflection_text, created_at")
      .eq("tutor_id", tutorId)
      .order("date", { ascending: false });
    
    if (!data) return [];
    
    return data.map(row => ({
      id: row.id,
      tutorId: row.tutor_id,
      reflectionText: row.reflection_text,
      date: row.date,
      createdAt: row.created_at,
    } as Reflection));
  }

  // Academic Profiles (School Tracker)
  async getAcademicProfile(studentId: string): Promise<AcademicProfile | undefined> {
    const { data } = await supabase
      .from("academic_profiles")
      .select("*")
      .eq("student_id", studentId)
      .maybeSingle();
    
    if (!data) return undefined;
    
    // Map snake_case to camelCase
    return {
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
    };
  }

  async upsertAcademicProfile(profile: any): Promise<AcademicProfile> {
    const dbProfile = {
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
    const { data, error } = await supabase
      .from("academic_profiles")
      .upsert(dbProfile, { onConflict: "student_id" })
      .select()
      .maybeSingle();
    
    if (error) {
      console.error("Supabase upsert error:", error);
      throw new Error(`Failed to save academic profile: ${error.message}`);
    }
    if (!data) throw new Error("Failed to save academic profile");
    
    // Map snake_case to camelCase
    return {
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
    };
  }

  // Struggle Targets (Target Center)
  async getStruggleTargets(studentId: string): Promise<StruggleTarget[]> {
    const { data } = await supabase
      .from("struggle_targets")
      .select("*")
      .eq("student_id", studentId)
      .order("created_at", { ascending: false });
    
    // Map snake_case to camelCase
    return (data ?? []).map((item: any) => ({
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
    }));
  }

  async createStruggleTarget(target: any): Promise<StruggleTarget> {
    const dbTarget = {
      student_id: target.studentId,
      subject: target.subject,
      topic_concept: target.topicConcept,
      my_struggle: target.myStruggle,
      strategy: target.strategy,
      consolidation_date: target.consolidationDate,
    };
    const { data, error } = await supabase
      .from("struggle_targets")
      .insert(dbTarget)
      .select()
      .single();
    
    if (error) {
      console.error("Supabase insert error:", error);
      throw new Error(`Failed to create struggle target: ${error.message}`);
    }
    if (!data) throw new Error("Failed to create struggle target - no data returned");
    
    // Map snake_case to camelCase
    return {
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
    };
  }

  async updateStruggleTarget(
    id: string,
    updates: any
  ): Promise<StruggleTarget | undefined> {
    const dbUpdates: any = { updated_at: new Date() };
    if (updates.subject !== undefined) dbUpdates.subject = updates.subject;
    if (updates.topicConcept !== undefined) dbUpdates.topic_concept = updates.topicConcept;
    if (updates.myStruggle !== undefined) dbUpdates.my_struggle = updates.myStruggle;
    if (updates.strategy !== undefined) dbUpdates.strategy = updates.strategy;
    if (updates.consolidationDate !== undefined) dbUpdates.consolidation_date = updates.consolidationDate;
    if ((updates as any).overcame !== undefined) dbUpdates.overcame = (updates as any).overcame;

    const { data, error } = await supabase
      .from("struggle_targets")
      .update(dbUpdates)
      .eq("id", id)
      .select()
      .single();
    
    if (error) {
      console.error("Supabase update error:", error);
      throw new Error(`Failed to update struggle target: ${error.message}`);
    }
    
    if (!data) return undefined;
    
    // Map snake_case to camelCase
    return {
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
    };
  }

  async deleteStruggleTarget(id: string): Promise<void> {
    await supabase.from("struggle_targets").delete().eq("id", id);
  }

  // Verification Docs
  async createVerificationDoc(doc: any): Promise<VerificationDoc> {
    const dbDoc = {
      tutor_id: doc.tutorId,
      file_url_agreement: doc.fileUrlAgreement,
      file_url_consent: doc.fileUrlConsent,
      status: doc.status,
    };
    const { data } = await supabase.from("verification_docs").insert(dbDoc).select().single();
    if (!data) throw new Error("Failed to create verification doc");
    return data;
  }

  async getVerificationDocByTutor(tutorId: string): Promise<VerificationDoc | undefined> {
    const { data } = await supabase.from("verification_docs").select("*").eq("tutor_id", tutorId).maybeSingle();
    return data ?? undefined;
  }

  async updateVerificationStatus(tutorId: string, status: string): Promise<void> {
    await supabase.from("verification_docs").update({ status, updated_at: new Date() }).eq("tutor_id", tutorId);
  }

  // Broadcasts
  async createBroadcast(broadcast: any): Promise<Broadcast> {
    const dbBroadcast = {
      subject: broadcast.subject,
      message: broadcast.message,
      sender_role: broadcast.senderRole,
      visibility: broadcast.visibility,
    };
    console.log("📝 Inserting broadcast:", JSON.stringify(dbBroadcast, null, 2));
    const { data, error } = await supabase.from("broadcasts").insert(dbBroadcast).select().single();
    if (error) {
      console.error("❌ Supabase insert error:", error);
      throw new Error(`Failed to create broadcast: ${error.message}`);
    }
    if (!data) {
      console.error("❌ No data returned from insert");
      throw new Error("Failed to create broadcast: no data returned");
    }
    
    console.log("✅ Created broadcast data from DB:", JSON.stringify(data, null, 2));
    
    // Transform snake_case to camelCase
    return {
      id: data.id,
      subject: data.subject || "(No Subject)",
      message: data.message,
      senderRole: data.sender_role,
      visibility: data.visibility,
      createdAt: data.created_at,
    };
  }

  async getBroadcasts(userCreatedAt?: string): Promise<Broadcast[]> {
    let query = supabase.from("broadcasts").select("*").order("created_at", { ascending: false });
    
    // Filter broadcasts to only show those created after user's account was created
    if (userCreatedAt) {
      query = query.gte("created_at", userCreatedAt);
    }

    const { data } = await query;
    if (!data) return [];
    
    console.log("📊 Total broadcasts fetched:", data.length);
    
    // Transform snake_case to camelCase
    const transformed = data.map((broadcast: any) => {
      const result = {
        id: broadcast.id,
        subject: broadcast.subject || "(No Subject)",
        message: broadcast.message,
        senderRole: broadcast.sender_role,
        visibility: broadcast.visibility,
        createdAt: broadcast.created_at,
      };
      return result;
    });
    
    return transformed;
  }

  async getCooBrainLibraryItems(): Promise<CooBrainLibraryItem[]> {
    const { data, error } = await supabase
      .from("coo_brain_library_items")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching COO brain library items:", error);
      throw new Error(`Failed to fetch COO brain library items: ${error.message}`);
    }

    return (data || []).map((item: any) => transformSnakeToCamel(item) as CooBrainLibraryItem);
  }

  async createCooBrainLibraryItem(item: InsertCooBrainLibraryItem): Promise<CooBrainLibraryItem> {
    const payload = {
      name: item.name,
      kind: item.kind,
      content: item.content ?? null,
      pdf_url: item.pdfUrl ?? null,
      pdf_file_name: item.pdfFileName ?? null,
      created_by: item.createdBy,
    };

    const { data, error } = await supabase
      .from("coo_brain_library_items")
      .insert(payload)
      .select()
      .single();

    if (error || !data) {
      console.error("Error creating COO brain library item:", error);
      throw new Error(`Failed to create COO brain library item: ${error?.message || "No data returned"}`);
    }

    return transformSnakeToCamel(data) as CooBrainLibraryItem;
  }

  // Notifications
  async createNotification(notification: InsertNotification): Promise<Notification> {
    const dbNotification = {
      recipient_user_id: notification.recipientUserId,
      actor_user_id: notification.actorUserId || null,
      channel: notification.channel || "informational",
      title: notification.title,
      message: notification.message,
      link: notification.link || null,
      entity_type: notification.entityType || null,
      entity_id: notification.entityId || null,
      is_read: false,
    };

    const { data, error } = await supabase.from("notifications").insert(dbNotification).select().single();
    if (error) {
      throw new Error(`Failed to create notification: ${error.message}`);
    }
    if (!data) {
      throw new Error("Failed to create notification: no data returned");
    }

    return {
      id: data.id,
      recipientUserId: data.recipient_user_id,
      actorUserId: data.actor_user_id,
      channel: data.channel || "informational",
      title: data.title,
      message: data.message,
      link: data.link,
      entityType: data.entity_type,
      entityId: data.entity_id,
      isRead: data.is_read,
      readAt: data.read_at,
      createdAt: data.created_at,
    };
  }

  async getNotifications(userId: string, userCreatedAt?: string): Promise<Notification[]> {
    let query = supabase
      .from("notifications")
      .select("*")
      .eq("recipient_user_id", userId)
      .order("created_at", { ascending: false });

    if (userCreatedAt) {
      query = query.gte("created_at", userCreatedAt);
    }

    const { data } = await query;
    if (!data) return [];

    return data.map((notification: any) => ({
      id: notification.id,
      recipientUserId: notification.recipient_user_id,
      actorUserId: notification.actor_user_id,
      channel: notification.channel || "informational",
      title: notification.title,
      message: notification.message,
      link: notification.link,
      entityType: notification.entity_type,
      entityId: notification.entity_id,
      isRead: notification.is_read,
      readAt: notification.read_at,
      createdAt: notification.created_at,
    }));
  }

  async markNotificationAsRead(userId: string, notificationId: string): Promise<void> {
    await supabase
      .from("notifications")
      .update({ is_read: true, read_at: new Date() })
      .eq("id", notificationId)
      .eq("recipient_user_id", userId);
  }

  async getUnreadNotificationCount(userId: string, userCreatedAt?: string): Promise<number> {
    let query = supabase
      .from("notifications")
      .select("id")
      .eq("recipient_user_id", userId)
      .eq("is_read", false);

    if (userCreatedAt) {
      query = query.gte("created_at", userCreatedAt);
    }

    const { data } = await query;
    return data?.length || 0;
  }

  async upsertPushSubscription(subscription: InsertPushSubscriptionRecord): Promise<PushSubscriptionRecord> {
    const payload = {
      user_id: subscription.userId,
      endpoint: subscription.endpoint,
      p256dh_key: subscription.p256dhKey,
      auth_key: subscription.authKey,
      expiration_time: subscription.expirationTime ?? null,
      user_agent: subscription.userAgent ?? null,
      updated_at: new Date(),
      last_used_at: new Date(),
    };

    const { data, error } = await supabase
      .from("push_subscriptions")
      .upsert(payload, { onConflict: "endpoint" })
      .select("*")
      .single();

    if (error || !data) {
      throw new Error(`Failed to upsert push subscription: ${error?.message || "no data returned"}`);
    }

    return transformSnakeToCamel(data) as PushSubscriptionRecord;
  }

  async getPushSubscriptionsByUser(userId: string): Promise<PushSubscriptionRecord[]> {
    const { data, error } = await supabase
      .from("push_subscriptions")
      .select("*")
      .eq("user_id", userId);

    if (error) {
      throw new Error(`Failed to fetch push subscriptions: ${error.message}`);
    }

    return (data ?? []).map(transformSnakeToCamel) as PushSubscriptionRecord[];
  }

  async deletePushSubscriptionByEndpoint(endpoint: string): Promise<void> {
    const { error } = await supabase
      .from("push_subscriptions")
      .delete()
      .eq("endpoint", endpoint);

    if (error) {
      throw new Error(`Failed to delete push subscription: ${error.message}`);
    }
  }

  // Broadcast Reads (Track which broadcasts users have read)
  async markBroadcastAsRead(userId: string, broadcastId: string): Promise<void> {
    try {
      // Validate broadcast exists
      const { data: broadcast, error: broadcastError } = await supabase
        .from("broadcasts")
        .select("id")
        .eq("id", broadcastId)
        .single();
      
      if (broadcastError || !broadcast) {
        console.error("Broadcast not found:", broadcastId);
        throw new Error("Broadcast not found");
      }
      
      // Validate user exists
      const { data: user, error: userError } = await supabase
        .from("users")
        .select("id")
        .eq("id", userId)
        .single();
      
      if (userError || !user) {
        console.error("User not found:", userId);
        throw new Error("User not found");
      }
      
      // Check if already marked as read
      const { data: existing, error: existingError } = await supabase
        .from("broadcast_reads")
        .select("id")
        .eq("user_id", userId)
        .eq("broadcast_id", broadcastId)
        .single();
      
      // If table doesn't exist, the existingError will have a code
      if (existingError && existingError.code === 'PGRST205') {
        console.warn("⚠️  broadcast_reads table not found. Please run BROADCAST_READS_TABLE.sql in Supabase");
        return;
      }
      
      // Only insert if not already read
      if (!existing) {
        const { error } = await supabase.from("broadcast_reads").insert({
          user_id: userId,
          broadcast_id: broadcastId,
        });
        if (error) {
          // If table doesn't exist, log warning but don't throw
          if (error.code === 'PGRST205') {
            console.warn("⚠️  broadcast_reads table not found. Please run BROADCAST_READS_TABLE.sql in Supabase");
          } else {
            throw error;
          }
        }
      }
    } catch (error: any) {
      // If table doesn't exist (PGRST205), log warning but don't crash
      if (error?.code === 'PGRST205') {
        console.warn("⚠️  broadcast_reads table not found. Please run BROADCAST_READS_TABLE.sql in Supabase");
      } else {
        throw error;
      }
    }
  }

  async getUnreadBroadcastCount(userId: string, userCreatedAt?: string): Promise<number> {
    try {
      // Use direct query to filter by user creation date
      let broadcastQuery = supabase
        .from("broadcasts")
        .select("id, created_at");
      
      // Only show broadcasts created after user's account was created
      if (userCreatedAt) {
        broadcastQuery = broadcastQuery.gte("created_at", userCreatedAt);
      }

      const { data: broadcasts } = await broadcastQuery;
      
      if (!broadcasts || broadcasts.length === 0) return 0;

      const broadcastIds = broadcasts.map((b: any) => b.id);
      
      const { data: reads } = await supabase
        .from("broadcast_reads")
        .select("broadcast_id")
        .eq("user_id", userId)
        .in("broadcast_id", broadcastIds);

      const readIds = new Set((reads || []).map((r: any) => r.broadcast_id));
      const unreadCount = broadcastIds.filter((id: string) => !readIds.has(id)).length;
      
      return unreadCount;
    } catch (error) {
      console.error("Error getting unread count:", error);
      return 0;
    }
  }

  async getUserBroadcastReads(userId: string): Promise<string[]> {
    const { data } = await supabase
      .from("broadcast_reads")
      .select("broadcast_id")
      .eq("user_id", userId);
    
    return (data || []).map((r: any) => r.broadcast_id);
  }

  // Tutor Applications
  async createTutorApplication(application: any): Promise<TutorApplication> {
    const normalizedIdType =
      String(application?.idType ?? application?.id_type ?? "")
        .trim()
        .toLowerCase();
    const dbApplication = {
      user_id: application.userId,
      full_name: application.fullName,
      age: application.age,
      phone: application.phone,
      email: application.email,
      city: application.city,
      completed_matric: application.completedMatric,
      matric_year: application.matricYear,
      math_level: application.mathLevel,
      math_result: application.mathResult,
      other_subjects: application.otherSubjects,
      current_situation: application.currentSituation,
      current_situation_other: application.currentSituationOther,
      interest_reason: application.interestReason,
      helped_before: application.helpedBefore,
      help_explanation: application.helpExplanation,
      student_dont_get: application.studentDontGet,
      pressure_story: application.pressureStory,
      pressure_response: application.pressureResponse,
      panic_cause: application.panicCause,
      discipline_reason: application.disciplineReason,
      repeat_mistake_response: application.repeatMistakeResponse,
      tt_meaning: application.ttMeaning,
      structure_preference: application.structurePreference,
      hours_per_week: application.hoursPerWeek,
      available_afternoon: application.availableAfternoon,
      final_reason: application.finalReason,
      commitment: application.commitment,
      status: application.status,
      ...(normalizedIdType === "sa_id" || normalizedIdType === "passport"
        ? { id_type: normalizedIdType }
        : {}),
    };
    const { data, error } = await supabase
      .from("tutor_applications")
      .insert(dbApplication)
      .select()
      .single();
    if (error) throw new Error(`Failed to create tutor application: ${error.message}`);
    if (!data) throw new Error("Failed to create tutor application: No data returned");
    return data;
  }

  async getTutorApplicationsByUser(userId: string): Promise<TutorApplication[]> {
    const { data } = await supabase
      .from("tutor_applications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    return hydrateTutorApplicationsWithOnboardingState(
      (data ?? []).map(transformSnakeToCamel) as TutorApplication[]
    );
  }

  async getTutorApplications(): Promise<TutorApplication[]> {
    const { data, error } = await supabase
      .from("tutor_applications")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      console.error("Error fetching tutor applications:", error);
      throw new Error(`Failed to fetch tutor applications: ${error.message}`);
    }
    return hydrateTutorApplicationsWithOnboardingState(
      (data ?? []).map(transformSnakeToCamel) as TutorApplication[]
    );
  }

  async getTutorApplicationsByStatus(status: "pending" | "approved" | "rejected"): Promise<TutorApplication[]> {
    const { data, error } = await supabase
      .from("tutor_applications")
      .select("*")
      .eq("status", status)
      .order("created_at", { ascending: false });
    if (error) {
      console.error(`Error fetching tutor applications by status ${status}:`, error);
      throw new Error(`Failed to fetch tutor applications: ${error.message}`);
    }
    return hydrateTutorApplicationsWithOnboardingState(
      (data ?? []).map(transformSnakeToCamel) as TutorApplication[]
    );
  }

  async approveTutorApplication(id: string, reviewedBy: string): Promise<TutorApplication | undefined> {
    const { data, error } = await supabase
      .from("tutor_applications")
      .update({
        status: "approved",
        reviewed_by: reviewedBy,
        reviewed_at: new Date(),
        document_submission_step: 1,
        documents_status: INITIAL_TUTOR_DOCUMENT_STATUSES,
        updated_at: new Date(),
      })
      .eq("id", id)
      .select()
      .single();
    if (error) {
      console.error("Error approving tutor application:", error);
      return undefined;
    }
    return data ? (transformSnakeToCamel(data) as TutorApplication) : undefined;
  }

  async rejectTutorApplication(id: string, reviewedBy: string, reason: string): Promise<TutorApplication | undefined> {
    const { data } = await supabase
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
      .single();
    return data ?? undefined;
  }

  async getApprovedTutors(): Promise<User[]> {
    const { data: eligibleApplications } = await supabase
      .from("tutor_applications")
      .select("user_id, full_name, email, phone, city, documents_status")
      .eq("status", "approved")
      .not("user_id", "is", null);

    if (!eligibleApplications || eligibleApplications.length === 0) {
      return [];
    }

    const approvedUserIds = [
      ...new Set(
        eligibleApplications
          .filter((app) => {
            const statuses = normalizeTutorDocumentStatuses(app.documents_status);
            return ["1", "2", "3", "4", "5", "6"].every(
              (step) => String(statuses[step] || "") === "approved"
            );
          })
          .map((app) => app.user_id)
          .filter(Boolean)
      ),
    ];

    if (approvedUserIds.length === 0) {
      return [];
    }

    const { data: users } = await supabase
      .from("users")
      .select("*")
      .in("id", approvedUserIds);

    const usersById = new Map((users || []).map((user: any) => [user.id, user]));

    return approvedUserIds.map((userId) => {
      const existingUser = usersById.get(userId);
      if (existingUser) return existingUser as User;

      const application = eligibleApplications.find((app) => app.user_id === userId);
      return {
        id: userId,
        email: application?.email || "",
        firstName: null,
        lastName: null,
        phone: application?.phone || null,
        bio: null,
        profileImageUrl: null,
        password: null,
        role: "tutor",
        name: application?.full_name || application?.email || "Tutor",
        grade: null,
        school: null,
        verified: false,
        createdAt: null,
        updatedAt: null,
      } as User;
    });
  }

  async updateTutorSequentialDocument(
    applicationId: string,
    docStep: number,
    documentUrl: string
  ): Promise<TutorApplication | undefined> {
    const fields = getSequentialTutorDocumentFields(docStep);
    const { data: existing, error: existingError } = await supabase
      .from("tutor_applications")
      .select("documents_status, document_submission_step")
      .eq("id", applicationId)
      .single();

    if (existingError) {
      console.error("Error fetching sequential document status:", existingError);
      return undefined;
    }

    const documentsStatus = normalizeTutorDocumentStatuses(existing?.documents_status);
    const submissionStepRaw = Number(existing?.document_submission_step);
    let expectedStep = 0;
    for (let step = 1; step <= 6; step++) {
      if (String(documentsStatus[step.toString()] || "not_started") !== "approved") {
        expectedStep = step;
        break;
      }
    }
    if (
      !expectedStep &&
      Number.isInteger(submissionStepRaw) &&
      submissionStepRaw >= 1 &&
      submissionStepRaw <= 6
    ) {
      expectedStep = submissionStepRaw;
    }

    if (!expectedStep) {
      throw new Error("All sequential onboarding steps are already approved.");
    }

    for (let step = 1; step < docStep; step++) {
      if (String(documentsStatus[step.toString()] || "not_started") !== "approved") {
        throw new Error(
          `Sequential step order violation: step ${docStep} is blocked until step ${step} is approved.`
        );
      }
    }

    if (docStep !== expectedStep) {
      throw new Error(
        `Sequential step order violation: current upload step is ${expectedStep}, received ${docStep}.`
      );
    }

    if (String(documentsStatus[docStep.toString()] || "") === "approved") {
      throw new Error(`Step ${docStep} is already approved and cannot be re-uploaded.`);
    }

    documentsStatus[docStep.toString()] = "pending_review";

    const updateData: Record<string, any> = {
      document_submission_step: docStep,
      documents_status: documentsStatus,
      updated_at: new Date(),
      [fields.url]: documentUrl,
      [fields.uploadedAt]: new Date(),
      [fields.verified]: false,
      [fields.verifiedBy]: null,
      [fields.verifiedAt]: null,
      [fields.rejectionReason]: null,
    };
    if (fields.completedTemplateUrl) {
      updateData[fields.completedTemplateUrl] = null;
    }
    if (fields.completedTemplateUploadedAt) {
      updateData[fields.completedTemplateUploadedAt] = null;
    }
    if (fields.completedTemplateUploadedBy) {
      updateData[fields.completedTemplateUploadedBy] = null;
    }

    const { data, error } = await supabase
      .from("tutor_applications")
      .update(updateData)
      .eq("id", applicationId)
      .select()
      .single();

    if (error) {
      console.error("Error updating sequential onboarding document:", error);
      return undefined;
    }

    return data ? (transformSnakeToCamel(data) as TutorApplication) : undefined;
  }

  async createTutorOnboardingAcceptance(
    input: CreateTutorOnboardingAcceptanceInput
  ): Promise<{ application?: TutorApplication; acceptance?: TutorOnboardingAcceptance }> {
    const { data: existing, error: existingError } = await supabase
      .from("tutor_applications")
      .select("id, user_id, documents_status, document_submission_step, phone, email")
      .eq("id", input.applicationId)
      .eq("user_id", input.userId)
      .single();

    if (existingError || !existing) {
      console.error("Error fetching application for onboarding acceptance:", existingError);
      return {};
    }

    const documentsStatus = normalizeTutorDocumentStatuses(existing.documents_status);
    const currentStep = buildCurrentStepFromStatuses(documentsStatus);

    for (let step = 1; step < input.documentStep; step++) {
      if (String(documentsStatus[step.toString()] || "not_started") !== "approved") {
        throw new Error(`Sequential step order violation: step ${step} must be completed first.`);
      }
    }

    if (input.documentStep !== currentStep) {
      throw new Error(`Sequential step order violation: current acceptance step is ${currentStep}.`);
    }

    if (String(documentsStatus[input.documentStep.toString()] || "not_started") === "approved") {
      throw new Error(`Step ${input.documentStep} has already been accepted.`);
    }

    const acceptancePayload: InsertTutorOnboardingAcceptance = {
      applicationId: input.applicationId,
      userId: input.userId,
      documentStep: input.documentStep,
      documentCode: input.documentCode,
      documentTitle: input.documentTitle,
      documentVersion: input.documentVersion,
      documentEffectiveDate: input.documentEffectiveDate ?? null,
      documentLastUpdatedAt: input.documentLastUpdatedAt ?? null,
      documentSnapshot: input.documentSnapshot,
      documentChecksum: input.documentChecksum,
      typedFullName: input.typedFullName,
      accountEmail: input.accountEmail,
      phoneNumberSnapshot: input.phoneNumberSnapshot ?? null,
      acceptedTimezone: input.acceptedTimezone ?? null,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
      deviceType: input.deviceType ?? null,
      platform: input.platform ?? null,
      sessionId: input.sessionId ?? null,
      locale: input.locale ?? null,
      sourceFlow: input.sourceFlow ?? null,
      formSnapshotJson: input.formSnapshotJson ?? null,
      acceptedClausesJson: input.acceptedClauses.map((clause) => clause.key),
      scrollCompletionPercent: input.scrollCompletionPercent ?? null,
      viewStartedAt: input.viewStartedAt ?? null,
      viewCompletedAt: input.viewCompletedAt ?? null,
      acceptClickedAt: input.acceptClickedAt ?? null,
    };

    const { data: acceptanceRow, error: acceptanceError } = await supabase
      .from("tutor_onboarding_acceptances")
      .insert({
        application_id: acceptancePayload.applicationId,
        user_id: acceptancePayload.userId,
        document_step: acceptancePayload.documentStep,
        document_code: acceptancePayload.documentCode,
        document_title: acceptancePayload.documentTitle,
        document_version: acceptancePayload.documentVersion,
        document_effective_date: acceptancePayload.documentEffectiveDate,
        document_last_updated_at: acceptancePayload.documentLastUpdatedAt,
        document_snapshot: acceptancePayload.documentSnapshot,
        document_checksum: acceptancePayload.documentChecksum,
        typed_full_name: acceptancePayload.typedFullName,
        account_email: acceptancePayload.accountEmail,
        phone_number_snapshot: acceptancePayload.phoneNumberSnapshot,
        accepted_timezone: acceptancePayload.acceptedTimezone,
        ip_address: acceptancePayload.ipAddress,
        user_agent: acceptancePayload.userAgent,
        device_type: acceptancePayload.deviceType,
        platform: acceptancePayload.platform,
        session_id: acceptancePayload.sessionId,
        locale: acceptancePayload.locale,
        source_flow: acceptancePayload.sourceFlow,
        form_snapshot_json: acceptancePayload.formSnapshotJson,
        accepted_clauses_json: acceptancePayload.acceptedClausesJson,
        scroll_completion_percent: acceptancePayload.scrollCompletionPercent,
        view_started_at: acceptancePayload.viewStartedAt,
        view_completed_at: acceptancePayload.viewCompletedAt,
        accept_clicked_at: acceptancePayload.acceptClickedAt,
      })
      .select("*")
      .single();

    if (acceptanceError || !acceptanceRow) {
      throw new Error(`Failed to create onboarding acceptance: ${acceptanceError?.message || "no data returned"}`);
    }

    const clauseRows: InsertTutorOnboardingClauseAcknowledgement[] = input.acceptedClauses.map((clause) => ({
      acceptanceId: acceptanceRow.id,
      clauseKey: clause.key,
      clauseLabel: clause.label,
    }));

    if (clauseRows.length) {
      const { error: clauseError } = await supabase
        .from("tutor_onboarding_clause_acknowledgements")
        .insert(
          clauseRows.map((clause) => ({
            acceptance_id: clause.acceptanceId,
            clause_key: clause.clauseKey,
            clause_label: clause.clauseLabel,
          }))
        );

      if (clauseError) {
        throw new Error(`Failed to save onboarding clause acknowledgements: ${clauseError.message}`);
      }
    }

    const eventRows: InsertTutorOnboardingAcceptanceEvent[] = [
      {
        acceptanceId: acceptanceRow.id,
        applicationId: input.applicationId,
        userId: input.userId,
        documentStep: input.documentStep,
        eventType: "view_started",
        payload: { at: input.viewStartedAt?.toISOString?.() ?? null },
      },
      {
        acceptanceId: acceptanceRow.id,
        applicationId: input.applicationId,
        userId: input.userId,
        documentStep: input.documentStep,
        eventType: "view_completed",
        payload: {
          at: input.viewCompletedAt?.toISOString?.() ?? null,
          scrollCompletionPercent: input.scrollCompletionPercent ?? null,
        },
      },
      {
        acceptanceId: acceptanceRow.id,
        applicationId: input.applicationId,
        userId: input.userId,
        documentStep: input.documentStep,
        eventType: "accepted",
        payload: {
          at: input.acceptClickedAt?.toISOString?.() ?? null,
          method: "checkbox_typed_name",
          clauses: input.acceptedClauses.map((clause) => clause.key),
          formSnapshot: input.formSnapshotJson ?? null,
        },
      },
    ];

    const { error: eventError } = await supabase
      .from("tutor_onboarding_acceptance_events")
      .insert(
        eventRows.map((eventRow) => ({
          acceptance_id: eventRow.acceptanceId,
          application_id: eventRow.applicationId,
          user_id: eventRow.userId,
          document_step: eventRow.documentStep,
          event_type: eventRow.eventType,
          payload: eventRow.payload ?? null,
        }))
      );

    if (eventError) {
      throw new Error(`Failed to save onboarding acceptance events: ${eventError.message}`);
    }

    const isAcceptanceOnlyStep = hasAcceptanceOnlyStep(input.documentStep);
    const documentFields = getSequentialTutorDocumentFields(input.documentStep);
    const acceptanceRecordedAt = new Date();
    documentsStatus[input.documentStep.toString()] = isAcceptanceOnlyStep ? "approved" : "pending_upload";
    if (isAcceptanceOnlyStep && input.documentStep < 6) {
      const nextStep = (input.documentStep + 1).toString();
      if (documentsStatus[nextStep] !== "approved") {
        documentsStatus[nextStep] = "pending_upload";
      }
    }

    const updateData: Record<string, any> = {
      documents_status: documentsStatus,
      document_submission_step:
        isAcceptanceOnlyStep && input.documentStep < 6 ? input.documentStep + 1 : input.documentStep,
      updated_at: acceptanceRecordedAt,
    };

    if (isAcceptanceOnlyStep) {
      updateData[documentFields.verified] = true;
      updateData[documentFields.verifiedBy] = input.userId;
      updateData[documentFields.verifiedAt] = acceptanceRecordedAt;
      updateData[documentFields.rejectionReason] = null;
    }

    const acceptedIdType = String(input.formSnapshotJson?.idType ?? "")
      .trim()
      .toLowerCase();
    if (acceptedIdType === "sa_id" || acceptedIdType === "passport") {
      updateData.id_type = acceptedIdType;
    }

    updateData[documentFields.rejectionReason] = null;

    const { data: updatedApplication, error: updateError } = await supabase
      .from("tutor_applications")
      .update(updateData)
      .eq("id", input.applicationId)
      .select("*")
      .single();

    if (updateError || !updatedApplication) {
      throw new Error(`Failed to update onboarding application state: ${updateError?.message || "no data returned"}`);
    }

    const [hydratedApplication] = await hydrateTutorApplicationsWithOnboardingState([
      transformSnakeToCamel(updatedApplication) as TutorApplication,
    ]);

    return {
      application: hydratedApplication,
      acceptance: transformSnakeToCamel(acceptanceRow) as TutorOnboardingAcceptance,
    };
  }

  async uploadCompletedTutorSequentialDocument(
    applicationId: string,
    docStep: number,
    completedDocumentUrl: string,
    completedBy: string
  ): Promise<TutorApplication | undefined> {
    const fields = getSequentialTutorDocumentFields(docStep);
    if (!fields.requiresCompletedTemplate) {
      throw new Error(`Step ${docStep} does not require a platform-completed template upload.`);
    }
    if (!fields.completedTemplateUrl || !fields.completedTemplateUploadedAt || !fields.completedTemplateUploadedBy) {
      throw new Error(`Completed template fields are not configured for step ${docStep}.`);
    }

    const { data: existing, error: existingError } = await supabase
      .from("tutor_applications")
      .select(`documents_status, ${fields.url}`)
      .eq("id", applicationId)
      .single();

    if (existingError) {
      console.error("Error fetching sequential state before completed upload:", existingError);
      return undefined;
    }

    const documentsStatus = normalizeTutorDocumentStatuses(existing?.documents_status);
    const stepStatus = String(documentsStatus[docStep.toString()] || "not_started");
    if (stepStatus !== "pending_review" && stepStatus !== "approved") {
      throw new Error(
        `Completed template upload is only allowed while step ${docStep} is pending review or already approved.`
      );
    }
    if (!existing?.[fields.url]) {
      throw new Error(
        `Tutor-signed document is required before uploading the platform-completed version for step ${docStep}.`
      );
    }

    const updateData: Record<string, any> = {
      updated_at: new Date(),
      [fields.completedTemplateUrl]: completedDocumentUrl,
      [fields.completedTemplateUploadedAt]: new Date(),
      [fields.completedTemplateUploadedBy]: completedBy,
    };

    const { data, error } = await supabase
      .from("tutor_applications")
      .update(updateData)
      .eq("id", applicationId)
      .select()
      .single();

    if (error) {
      console.error("Error uploading completed sequential document:", error);
      return undefined;
    }

    return data ? (transformSnakeToCamel(data) as TutorApplication) : undefined;
  }

  async reviewTutorSequentialDocument(
    applicationId: string,
    docStep: number,
    approved: boolean,
    reviewedBy: string,
    completedDocumentUrl?: string,
    rejectionReason?: string
  ): Promise<TutorApplication | undefined> {
    if (docStep !== 2 && docStep !== 6) {
      throw new Error("Only step 2 Matric certificate uploads and step 6 certified ID uploads require COO review.");
    }

    const fields = getSequentialTutorDocumentFields(docStep);
    const { data: existing, error: existingError } = await supabase
      .from("tutor_applications")
      .select(
        "documents_status, doc_1_completed_template_url, doc_2_completed_template_url, doc_3_completed_template_url, doc_4_completed_template_url, doc_5_completed_template_url, doc_1_submission_url, doc_2_submission_url, doc_3_submission_url, doc_4_submission_url, doc_5_submission_url, doc_6_submission_url"
      )
      .eq("id", applicationId)
      .single();

    if (existingError) {
      console.error("Error fetching sequential review state:", existingError);
      return undefined;
    }

    const documentsStatus = normalizeTutorDocumentStatuses(existing?.documents_status);
    const currentStepStatus = String(documentsStatus[docStep.toString()] || "not_started");
    if (currentStepStatus !== "pending_review") {
      throw new Error(`Step ${docStep} is not currently pending review.`);
    }

    const updateData: Record<string, any> = {
      updated_at: new Date(),
      [fields.verified]: approved,
      [fields.verifiedBy]: approved ? reviewedBy : null,
      [fields.verifiedAt]: approved ? new Date() : null,
      [fields.rejectionReason]: approved ? null : (rejectionReason || "Please review and resubmit"),
    };

    if (approved) {
      const tutorSignedUrl = existing?.[fields.url];
      if (!tutorSignedUrl) {
        throw new Error(`Tutor-signed document is required before approving step ${docStep}.`);
      }

      const effectiveCompletedUrl =
        completedDocumentUrl ||
        (fields.completedTemplateUrl ? existing?.[fields.completedTemplateUrl] : null);

      documentsStatus[docStep.toString()] = "approved";

      if (docStep < 6) {
        const nextStep = (docStep + 1).toString();
        if (documentsStatus[nextStep] !== "approved") {
          documentsStatus[nextStep] = "pending_upload";
        }
        updateData.document_submission_step = docStep + 1;
      } else {
        updateData.document_submission_step = 6;
      }

      const allSequentialDocumentsApproved = ["1", "2", "3", "4", "5", "6"].every(
        (step) => String(documentsStatus[step] || "") === "approved"
      );
      if (allSequentialDocumentsApproved) {
        updateData.onboarding_completed_at = new Date();
      }

      if (fields.completedTemplateUrl && effectiveCompletedUrl) {
        updateData[fields.completedTemplateUrl] = effectiveCompletedUrl;
      }

      // Keep persisted status within DB enum values.
      // Gateway status "confirmed" is derived from documents_status at read time.
    } else {
      documentsStatus[docStep.toString()] = "rejected";
      updateData.document_submission_step = docStep;
      if (fields.completedTemplateUrl) {
        updateData[fields.completedTemplateUrl] = null;
      }
      if (fields.completedTemplateUploadedAt) {
        updateData[fields.completedTemplateUploadedAt] = null;
      }
      if (fields.completedTemplateUploadedBy) {
        updateData[fields.completedTemplateUploadedBy] = null;
      }
    }

    updateData.documents_status = documentsStatus;

    const { data, error } = await supabase
      .from("tutor_applications")
      .update(updateData)
      .eq("id", applicationId)
      .select()
      .single();

    if (error) {
      console.error("Error reviewing sequential onboarding document:", error);
      return undefined;
    }

    return data ? (transformSnakeToCamel(data) as TutorApplication) : undefined;
  }

  async completeTutorOnboarding(applicationId: string): Promise<TutorApplication | undefined> {
    const { data, error } = await supabase
      .from("tutor_applications")
      .update({
        onboarding_completed_at: new Date(),
        updated_at: new Date(),
      })
      .eq("id", applicationId)
      .select()
      .single();
    
    if (error) {
      console.error("Error completing onboarding:", error);
      return undefined;
    }
    return data ? (transformSnakeToCamel(data) as TutorApplication) : undefined;
  }

  // Roles
  async checkRoleAuthorization(email: string, role: "tutor" | "td" | "coo" | "od"): Promise<boolean> {
    if (role === "tutor") return true;
    if (role === "od") return isAllowedOdEmail(email);
    const { data } = await supabase.from("role_permissions").select("*").eq("email", email).maybeSingle();
    return data ? data.role === role : false;
  }

  async addRolePermission(permission: RolePermission): Promise<void> {
    if (permission.role === "od" && !isAllowedOdEmail(permission.email)) {
      throw new Error("Only approved OD emails can be granted the OD role");
    }
    await supabase.from("role_permissions").upsert({
      ...permission,
      email: normalizeEmail(permission.email),
    });
  }

  async getRolePermissions(): Promise<RolePermission[]> {
    const { data } = await supabase.from("role_permissions").select("*");
    return data ?? [];
  }

  async checkTDPodAssignment(email: string): Promise<string | null> {
    // First get the user ID from email
    const { data: user } = await supabase
      .from("users")
      .select("id")
      .eq("email", email)
      .maybeSingle();
    
    if (!user) return null;
    
    // Check if this TD has any assigned pods in the pods table
    const { data: pod } = await supabase
      .from("pods")
      .select("id")
      .eq("td_id", user.id)
      .is("deleted_at", null)
      .limit(1)
      .maybeSingle();
    
    return pod?.id ?? null;
  }

  // ============================================
  // AFFILIATE PROSPECTING SYSTEM
  // ============================================

  async getOrCreateAffiliateCode(affiliateId: string): Promise<any> {
    // Check if affiliate already has a code
    const { data: existing } = await supabase
      .from("affiliate_codes")
      .select("*")
      .eq("affiliate_id", affiliateId)
      .maybeSingle();
    
    if (existing) return existing;
    
    // Generate unique code (e.g., AFIX001)
    const randomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
    const code = `AFIX${randomSuffix}`;
    
    const { data: newCode, error } = await supabase
      .from("affiliate_codes")
      .insert({
        affiliate_id: affiliateId,
        code: code,
      })
      .select()
      .single();
    
    if (error) throw error;
    return newCode;
  }

  async getAffiliateCode(affiliateId: string): Promise<any | null> {
    const { data } = await supabase
      .from("affiliate_codes")
      .select("*")
      .eq("affiliate_id", affiliateId)
      .maybeSingle();
    
    return data || null;
  }

  async getAffiliateByCode(code: string): Promise<any | null> {
    const { data } = await supabase
      .from("affiliate_codes")
      .select("affiliate_id, code, type, person_name, entity_name, pipeline_type, campaign_name, status")
      .eq("code", code)
      .maybeSingle();
    if (!data) return null;
    // Compose affiliate_name: prefer person_name, fallback to entity_name, fallback to null
    let affiliate_name = data.person_name || data.entity_name || null;
    return {
      affiliate_id: data.affiliate_id,
      affiliate_type: data.type || null,
      affiliate_name,
      production_link_code: data.code,
      pipeline_type: data.pipeline_type || "demand",
      campaign_name: data.campaign_name || null,
      status: data.status || "active",
    };
  }

  async logEncounter(affiliateId: string, encounter: any): Promise<any> {
    const { data, error } = await supabase
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
      .single();
    
    if (error) throw error;
    return data;
  }

  async getEncounters(affiliateId: string): Promise<any[]> {
    const { data } = await supabase
      .from("encounters")
      .select("*")
      .eq("affiliate_id", affiliateId)
      .order("created_at", { ascending: false });
    
    return data || [];
  }

  async updateEncounterStatus(encounterId: string, status: string): Promise<void> {
    const { error } = await supabase
      .from("encounters")
      .update({ status })
      .eq("id", encounterId);
    
    if (error) throw error;
  }

  /**
   * Create a lead for a user/affiliate/encounter, but prevent duplicates.
   * If a lead already exists for the user (and encounter, if provided), return it instead of inserting.
   * Optionally supports leadType for future extensibility.
   */
  async createLead(
    affiliateId: string,
    parentId: string,
    encounterId?: string,
    trackingData?: { trackingSource?: string; trackingCampaign?: string; leadType?: string; affiliateType?: string; affiliateName?: string; productionLinkCode?: string }
  ): Promise<any> {
    // Use null for organic leads (no affiliate)
    let query = supabase
      .from("leads")
      .select("*")
      .eq("user_id", parentId);
    if (affiliateId) {
      query = query.eq("affiliate_id", affiliateId);
    } else {
      query = query.is("affiliate_id", null);
    }
    if (encounterId) {
      query = query.eq("encounter_id", encounterId);
    }
    const { data: existingLead, error: findError } = await query.maybeSingle();
    if (findError) {
      console.error("[createLead] Error finding existing lead:", findError);
      throw findError;
    }
    if (existingLead) {
      console.log("[createLead] Lead already exists:", existingLead);
      return existingLead;
    }

    // Insert new lead
    const insertObj: any = {
      affiliate_id: affiliateId || null,
      user_id: parentId,
      encounter_id: encounterId || null,
      tracking_source: trackingData?.trackingSource || 'affiliate',
      tracking_campaign: trackingData?.trackingCampaign || null,
      production_link_code: trackingData?.productionLinkCode || null,
      onboarding_type: trackingData?.onboardingType || 'pilot',
      full_name: trackingData?.fullName || '',
    };
    if (trackingData?.leadType) {
      insertObj.lead_type = trackingData.leadType;
    }
    if (trackingData?.affiliateType) {
      insertObj.affiliate_type = trackingData.affiliateType;
    }
    if (trackingData?.affiliateName) {
      insertObj.affiliate_name = trackingData.affiliateName;
    }

    console.log("[createLead] Inserting new lead:", insertObj);
    const { data, error } = await supabase
      .from("leads")
      .insert(insertObj)
      .select()
      .single();
    if (error) {
      console.error("[createLead] Error inserting lead:", error, "Insert object:", insertObj);
      throw error;
    }
    console.log("[createLead] Lead inserted successfully:", data);
    return data;
  }

  async getLeads(affiliateId: string): Promise<any[]> {
    // Get all leads for this affiliate
    const { data: leads } = await supabase
      .from("leads")
      .select("*")
      .eq("affiliate_id", affiliateId)
      .order("created_at", { ascending: false });
    
    if (!leads) return [];
    
    console.log("📊 Raw leads data from DB:", leads.length, "leads");
    
    // For each lead, get parent and encounter info
    const enriched = await Promise.all(leads.map(async (lead: any) => {
      // Get user info
      const { data: user } = await supabase
        .from("users")
        .select("id, email, first_name, last_name, name")
        .eq("id", lead.user_id)
        .maybeSingle();
      
      // Get encounter info if exists
      let encounterData = null;
      if (lead.encounter_id) {
        const { data: encounter } = await supabase
          .from("encounters")
          .select("*")
          .eq("id", lead.encounter_id)
          .maybeSingle();
        encounterData = encounter;
      }
      
      return {
        lead_id: lead.id,
        encounter_id: lead.encounter_id,
        parent_name: encounterData?.parent_name || user?.name || `${user?.first_name || ''} ${user?.last_name || ''}`.trim() || null,
        parent_email: encounterData?.parent_email || user?.email || null,
        created_at: lead.created_at,
      };
    }));
    
    console.log("📊 Enriched leads count:", enriched.length);
    return enriched;
  }

  async recordClose(affiliateId: string, parentId: string, studentId: string, podId?: string): Promise<any> {
    // First get the lead
    const { data: lead } = await supabase
      .from("leads")
      .select("id")
      .eq("affiliate_id", affiliateId)
      .eq("user_id", parentId)
      .maybeSingle();
    
    if (!lead) {
      throw new Error("Lead not found");
    }

    const { data: existingClose } = await supabase
      .from("closes")
      .select("id")
      .eq("affiliate_id", affiliateId)
      .eq("lead_id", lead.id)
      .eq("parent_id", parentId)
      .eq("student_id", studentId)
      .limit(1)
      .maybeSingle();

    if (existingClose) {
      throw new Error("A production reward has already been recorded for this conversion");
    }

    const { data: trialEvidence } = await supabase
      .from("intro_session_drills")
      .select("id")
      .eq("student_id", studentId)
      .limit(1)
      .maybeSingle();

    if (!trialEvidence) {
      throw new Error("A completed trial is required before a production reward can be recorded");
    }

    const { data: paidSubscription } = await supabase
      .from("payment_transactions")
      .select("id")
      .eq("parent_id", parentId)
      .eq("student_id", studentId)
      .eq("payment_status", "paid")
      .limit(1)
      .maybeSingle();

    if (!paidSubscription) {
      throw new Error("A verified paid subscription is required before a production reward can be recorded");
    }
    
    const { data, error } = await supabase
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
      .single();
    
    if (error) throw error;
    return data;
  }

  async getCloses(affiliateId: string): Promise<any[]> {
    // Get all closes for this affiliate
    const { data: closes } = await supabase
      .from("closes")
      .select("*")
      .eq("affiliate_id", affiliateId)
      .order("closed_at", { ascending: false });
    
    if (!closes) return [];
    
    console.log("📊 Raw closes data from DB:", closes.length, "closes");
    
    // For each close, get parent and lead info
    const enriched = await Promise.all(closes.map(async (close: any) => {
      // Get lead info
      const { data: lead } = await supabase
        .from("leads")
        .select("*")
        .eq("id", close.lead_id)
        .maybeSingle();
      
      // Get user info
      const { data: user } = await supabase
        .from("users")
        .select("id, email, first_name, last_name, name")
        .eq("id", close.parent_id)
        .maybeSingle();
      
      // Get encounter info if lead has one
      let encounterData = null;
      if (lead?.encounter_id) {
        const { data: encounter } = await supabase
          .from("encounters")
          .select("*")
          .eq("id", lead.encounter_id)
          .maybeSingle();
        encounterData = encounter;
      }
      
      return {
        close_id: close.id,
        lead_id: close.lead_id,
        encounter_id: lead?.encounter_id || null,
        parent_name: encounterData?.parent_name || user?.name || `${user?.first_name || ''} ${user?.last_name || ''}`.trim() || null,
        parent_email: encounterData?.parent_email || user?.email || null,
        commission_amount: close.commission_amount,
        commission_status: close.commission_status,
        closed_at: close.closed_at,
        created_at: close.created_at,
      };
    }));
    
    console.log("📊 Enriched closes count:", enriched.length);
    return enriched;
  }

  async getAffiliateStats(affiliateId: string): Promise<any> {
    // Get counts for all statuses
    const [encounters, leads, closes, objected] = await Promise.all([
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
    ]);
    
    return {
      encounters: encounters.count || 0,
      leads: leads.count || 0,
      closes: closes.count || 0,
      objected: objected.count || 0,
    };
  }

  async saveAffiliateReflection(affiliateId: string, reflectionText: string): Promise<any> {
    const { data, error } = await supabase
      .from("affiliate_reflections")
      .upsert({
        affiliate_id: affiliateId,
        reflection_text: reflectionText,
      }, { onConflict: "affiliate_id" })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  async getAffiliateReflection(affiliateId: string): Promise<any | null> {
    const { data } = await supabase
      .from("affiliate_reflections")
      .select("*")
      .eq("affiliate_id", affiliateId)
      .maybeSingle();
    
    return data || null;
  }

  async getAffiliateLeadsByStatus(affiliateId: string): Promise<any> {
    const leads = await this.getLeads(affiliateId);
    const closes = await this.getCloses(affiliateId);
    const encounters = await this.getEncounters(affiliateId);

    const objected = encounters.filter((e: any) => e.status === "objected");
    
    console.log("🔍 DEBUGGING getAffiliateLeadsByStatus for affiliate:", affiliateId);
    console.log("📊 Encounters count:", encounters.length, "Encounters:", encounters.map((e: any) => ({ id: e.id, status: e.status, parent_email: e.parent_email })));
    console.log("📊 Leads count:", leads.length, "Leads:", leads.map((l: any) => ({ lead_id: l.lead_id, encounter_id: l.encounter_id, parent_email: l.parent_email })));
    console.log("📊 Closes count:", closes.length);
    console.log("📊 Objections count:", objected.length);
    
    const breakdown = {
      all: encounters.length,
      leads: leads.length,
      closes: closes.length,
      objections: objected.length,
    };
    
    console.log("📈 Final breakdown:", breakdown);
    return breakdown;
  }

  // Initialize affiliate tables if they don't exist
  async initializeAffiliateTables(): Promise<void> {
    try {
      // Check if affiliate_codes table exists
      const { data, error } = await supabase
        .from("affiliate_codes")
        .select("1")
        .limit(1);
      
      if (error && error.code === 'PGRST116') {
        // Table doesn't exist, create all affiliate tables
        console.log('📋 Creating affiliate tables...');
        
        const sql = `
          -- Affiliate Codes Table
          CREATE TABLE IF NOT EXISTS affiliate_codes (
            id BIGSERIAL PRIMARY KEY,
            affiliate_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
            code VARCHAR(20) NOT NULL UNIQUE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );
          
          CREATE INDEX IF NOT EXISTS idx_affiliate_codes_affiliate_id ON affiliate_codes(affiliate_id);
          CREATE INDEX IF NOT EXISTS idx_affiliate_codes_code ON affiliate_codes(code);
          
          -- Encounters Table
          CREATE TABLE IF NOT EXISTS encounters (
            id BIGSERIAL PRIMARY KEY,
            affiliate_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
            parent_name VARCHAR(255) NOT NULL,
            parent_email VARCHAR(255),
            parent_phone VARCHAR(20),
            child_name VARCHAR(255),
            child_grade VARCHAR(50),
            status VARCHAR(50) DEFAULT 'prospect',
            notes TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );
          
          CREATE INDEX IF NOT EXISTS idx_encounters_affiliate_id ON encounters(affiliate_id);
          CREATE INDEX IF NOT EXISTS idx_encounters_status ON encounters(status);
          
          -- Leads Table
          CREATE TABLE IF NOT EXISTS leads (
            id BIGSERIAL PRIMARY KEY,
            affiliate_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
            encounter_id BIGINT REFERENCES encounters(id) ON DELETE SET NULL,
            user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
            lead_type VARCHAR(50),
            status VARCHAR(50) DEFAULT 'open',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );
          
          CREATE INDEX IF NOT EXISTS idx_leads_affiliate_id ON leads(affiliate_id);
          CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
          
          -- Closes Table
          CREATE TABLE IF NOT EXISTS closes (
            id BIGSERIAL PRIMARY KEY,
            affiliate_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
            lead_id BIGINT REFERENCES leads(id) ON DELETE SET NULL,
            parent_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
            commission_amount DECIMAL(10, 2),
            commission_status VARCHAR(50) DEFAULT 'pending',
            closed_at TIMESTAMP WITH TIME ZONE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );
          
          CREATE INDEX IF NOT EXISTS idx_closes_affiliate_id ON closes(affiliate_id);
          CREATE INDEX IF NOT EXISTS idx_closes_commission_status ON closes(commission_status);
          
          -- Affiliate Reflections Table
          CREATE TABLE IF NOT EXISTS affiliate_reflections (
            id BIGSERIAL PRIMARY KEY,
            affiliate_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
            reflection_type VARCHAR(50),
            content TEXT,
            key_wins TEXT,
            challenges TEXT,
            next_steps TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );
          
          CREATE INDEX IF NOT EXISTS idx_affiliate_reflections_affiliate_id ON affiliate_reflections(affiliate_id);
        `;
        
        // Use the Neon SQL client to execute raw SQL
        try {
          const { neon } = await import("@neondatabase/serverless");
          const sqlClient = neon(process.env.DATABASE_URL!);
          // Split and execute statements individually
          const statements = sql.split(';').filter(stmt => stmt.trim());
          for (const statement of statements) {
            if (statement.trim()) {
              await sqlClient(statement);
            }
          }
          console.log('✅ Affiliate tables created successfully');
        } catch (dbError) {
          console.warn('⚠️  Could not create tables via Neon client, tables may need manual creation:', dbError);
        }
      } else if (!error) {
        console.log('✅ Affiliate tables already exist');
      }
    } catch (error) {
      console.error('Error initializing affiliate tables:', error);
    }
  }
}

export const storage = new SupabaseStorage();

// Initialize affiliate tables on startup
storage.initializeAffiliateTables().catch(err => {
  console.error('Failed to initialize affiliate tables:', err);
});

// Re-export db and tables for direct access in routes
export { db };
export { weeklyCheckIns } from "@shared/schema";
