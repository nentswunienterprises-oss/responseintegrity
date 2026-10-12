import type { Express, Request, Response } from "express";
import { z } from "zod";
import { isAuthenticated } from "../supabaseAuth";
import { pool } from "../db";
import { getExecuteChallengeStatus,startExecuteChallenge,recordExecuteTurn } from "../practicalExecuteChallenge";
import { getBenchmarkRunStatus,startBenchmarkRun,advanceBenchmarkRun } from "../practicalBenchmarkRuns";
import { getPracticalCaseWork,recordPracticalCaseAction } from "../practicalCaseWork";
import {
  getSpecialistRecordingRecovery,requestPracticalRecordingRecovery,
  getAssignedTdRecordingRecoveryQueue,decidePracticalRecordingRecovery,
} from "../practicalRecordingRecovery";
import type { ExecuteResponse } from "@shared/practicalExecuteChallenge";
import type { PracticalRecordingDeclaration, PracticalCaseReview, PracticalVideoVerification, PracticalBenchmarkProof } from "@shared/practicalBenchmarkPolicy";
import type { CapabilityPracticalCriterionReviewInput } from "@shared/capabilityPracticalEvidence";
import {
  buildPublicPracticalDefinitions,
  getPracticalReviewQueue,
  getSpecialistPracticalEvidence,
  getPracticalEntryStatus,
  getPracticalCompletionStatus,
  recordPracticalTdCompletion,
  reviewPracticalCapabilityEvidence,
  submitPracticalCapabilityEvidence,
} from "../capabilityPracticalEvidence";

const practicalSubmissionSchema = z.object({
  tutorAssignmentId: z.string().trim().min(1),
  proofVersion: z.number().int().positive(),
  artifactUrl: z.string().trim().url(),
  artifactType: z.enum(["screen_voice", "screen_video", "video"]),
  declaration: z.record(z.string(), z.unknown()),
  noRealStudentDataConfirmed: z.literal(true),
  executeChallengeId: z.string().uuid().optional(),
  benchmarkRunId: z.string().uuid(),
  recording: z.object({
    durationSeconds: z.number().int().positive(),
    recordingStartedBeforeReveal: z.literal(true),
    continuousUneditedRecording: z.literal(true),
    setupToolsDemonstrated: z.literal(true),
  }).strict(),
}).strict();

const practicalReviewSchema = z.object({
  rubricVersion: z.number().int().positive(),
  criterionJudgments: z.array(z.object({
    criterionKey: z.string().trim().min(1),
    judgment: z.enum(["clear", "partial", "fail"]),
    evidenceNote: z.string().trim().max(2000).optional().nullable(),
  })).min(1),
  feedback: z.string().trim().max(4000).optional().nullable(),
  executeTraceVideoVerified: z.boolean().optional(),
  benchmarkCaseReviews: z.array(z.object({
    caseKey: z.string().min(1),
    judgment: z.enum(["clear","partial","fail"]),
    observedEvidence: z.string().trim().min(30).max(2000),
    videoTraceMatched: z.boolean(),
  }).strict()).length(3),
  videoVerification: z.object({
    observedDurationSeconds:z.number().int().positive(),
    recordingContinuous:z.boolean(),recordingBeginsBeforeReveal:z.boolean(),
    allThreeCasesVisible:z.boolean(),environmentAndToolsVisible:z.boolean(),
    specialistScreenFaceVoiceObservable:z.boolean(),
    flaggedCutOrManipulation:z.boolean(),flaggedTechnicalInterruption:z.boolean(),
  }).strict(),
}).strict();

function requireSpecialist(req: Request, res: Response) {
  const user = (req as any).dbUser;
  if (!user?.id) {
    res.status(401).json({ message: "Authentication required." });
    return null;
  }
  if (String(user.role || "").toLowerCase() !== "tutor") {
    res.status(403).json({ message: "Specialist access required." });
    return null;
  }
  return user;
}

function requireReviewer(req: Request, res: Response) {
  const user = (req as any).dbUser;
  if (!user?.id) {
    res.status(401).json({ message: "Authentication required." });
    return null;
  }
  const role = String(user.role || "").toLowerCase();
  if (role !== "td") {
    res.status(403).json({ message: "Capability practical review access is restricted." });
    return null;
  }
  return { ...user, role };
}

function respondError(res: Response, error: unknown, fallback: string) {
  if (error instanceof z.ZodError) {
    return res.status(400).json({ message: "Invalid practical capability request.", issues: error.issues });
  }
  const status = Number((error as any)?.status || 500);
  const message = error instanceof Error ? error.message : fallback;
  return res.status(status).json({ message });
}

export function registerCapabilityPracticalEvidenceRoutes(app: Express) {
  app.get(
    "/api/tutor/capability-practicals",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const user = requireSpecialist(req, res);
        if (!user) return;
        const tutorAssignmentId = String(req.query.tutorAssignmentId || "").trim();
        if (!tutorAssignmentId) {
          return res.status(400).json({ message: "tutorAssignmentId is required." });
        }

        const [entry, completion, evidence] = await Promise.all([getPracticalEntryStatus(tutorAssignmentId, String(user.id)), getPracticalCompletionStatus(tutorAssignmentId, String(user.id)), getSpecialistPracticalEvidence({
          tutorAssignmentId,
          tutorId: String(user.id),
        })]);

        return res.json({
          entry, completion,
          proofs: buildPublicPracticalDefinitions(),
          evidence,
        });
      } catch (error) {
        return respondError(res, error, "Failed to load practical capability evidence.");
      }
    },
  );

  app.post(
    "/api/tutor/capability-practicals/:proofKey",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const user = requireSpecialist(req, res);
        if (!user) return;
        const payload = practicalSubmissionSchema.parse(req.body);

        const result = await submitPracticalCapabilityEvidence({
          tutorAssignmentId: payload.tutorAssignmentId,
          tutorId: String(user.id),
          proofKey: String(req.params.proofKey || "").trim(),
          proofVersion: payload.proofVersion,
          artifactUrl: payload.artifactUrl,
          artifactType: payload.artifactType,
          declaration: payload.declaration,
          noRealStudentDataConfirmed: payload.noRealStudentDataConfirmed,
          executeChallengeId: payload.executeChallengeId || null,
          benchmarkRunId: payload.benchmarkRunId,
          recording: payload.recording as PracticalRecordingDeclaration,
        });

        return res.status(201).json(result);
      } catch (error) {
        return respondError(res, error, "Failed to submit practical capability evidence.");
      }
    },
  );


  type ConfirmedBenchmark={tutorAssignmentId:string;proofKey:PracticalBenchmarkProof};
  const proofKeySchema=z.enum(["prepare","execute","evidence"]);
  const benchmarkInput=z.object({
    tutorAssignmentId:z.string().trim().min(1),
    proofKey:proofKeySchema,
  }).strict();
  const requireEntry=async(tutorAssignmentId:string,tutorId:string)=>{
    const entry=await getPracticalEntryStatus(tutorAssignmentId,tutorId);
    if(!entry.ready)throw Object.assign(new Error(entry.blockers.join(" ")),{status:403});
  };
  app.get("/api/tutor/capability-practicals/benchmark",isAuthenticated,async(req,res)=>{
    try {
      const user=requireSpecialist(req,res);if(!user)return;
      const input=benchmarkInput.parse({
        tutorAssignmentId:req.query.tutorAssignmentId,
        proofKey:req.query.proofKey,
      }) as ConfirmedBenchmark;
      await requireEntry(input.tutorAssignmentId,String(user.id));
      return res.json(await getBenchmarkRunStatus({...input,tutorId:String(user.id)}));
    }catch(error){return respondError(res,error,"Failed to load system-issued Practicals case.");}
  });
  app.post("/api/tutor/capability-practicals/benchmark/start",isAuthenticated,async(req,res)=>{
    try {
      const user=requireSpecialist(req,res);if(!user)return;
      const input=benchmarkInput.extend({
        preflightConfirmed:z.literal(true),
        recordingStartedBeforeReveal:z.literal(true),
        consentToRecording:z.literal(true),privacyScopeConfirmed:z.literal(true),
      }).parse(req.body) as ConfirmedBenchmark & {
        preflightConfirmed:true;recordingStartedBeforeReveal:true;
        consentToRecording:true;privacyScopeConfirmed:true;
      };
      await requireEntry(input.tutorAssignmentId,String(user.id));
      return res.status(201).json(await startBenchmarkRun({...input,tutorId:String(user.id)}));
    }catch(error){return respondError(res,error,"Failed to issue Practicals cases.");}
  });
  app.post("/api/tutor/capability-practicals/benchmark/:runId/advance",isAuthenticated,async(req,res)=>{
    try {
      const user=requireSpecialist(req,res);if(!user)return;
      const input=benchmarkInput.extend({
        action:z.enum(["next","finish"]),
      }).parse(req.body) as ConfirmedBenchmark & {action:"next"|"finish"};
      const runId=z.string().uuid().parse(req.params.runId);
      await requireEntry(input.tutorAssignmentId,String(user.id));
      return res.status(201).json(await advanceBenchmarkRun({...input,runId,tutorId:String(user.id)}));
    }catch(error){return respondError(res,error,"Failed to advance Practicals cases.");}
  });

  const workSchema=benchmarkInput.extend({stepNumber:z.number().int().positive(),
    payload:z.record(z.string(),z.unknown())}).strict();
  app.get("/api/tutor/capability-practicals/benchmark/:runId/work",isAuthenticated,async(req,res)=>{
    try{
      const user=requireSpecialist(req,res);if(!user)return;
      const input=benchmarkInput.parse({tutorAssignmentId:req.query.tutorAssignmentId,proofKey:req.query.proofKey}) as ConfirmedBenchmark;
      const runId=z.string().uuid().parse(req.params.runId);
      await requireEntry(input.tutorAssignmentId,String(user.id));
      return res.json(await getPracticalCaseWork({...input,runId,tutorId:String(user.id)}));
    }catch(error){return respondError(res,error,"Failed to load the issued Practicals workbench.");}
  });
  app.post("/api/tutor/capability-practicals/benchmark/:runId/work",isAuthenticated,async(req,res)=>{
    try{
      const user=requireSpecialist(req,res);if(!user)return;
      const input=workSchema.parse(req.body) as ConfirmedBenchmark & {stepNumber:number;payload:Record<string,unknown>};
      const runId=z.string().uuid().parse(req.params.runId);
      await requireEntry(input.tutorAssignmentId,String(user.id));
      return res.status(201).json(await recordPracticalCaseAction({
        ...input,runId,tutorId:String(user.id),
      }));
    }catch(error){return respondError(res,error,"Failed to save the live Practicals operation.");}
  });

  // A broken or unusable original recording is never replaced by the
  // Specialist. Only an assigned TD can sign an immutable repeat authorization.
  const recoveryReason=z.enum(["recording_interrupted","recording_unusable","accessibility_failure"]);
  app.get("/api/tutor/capability-practicals/recording-recovery",isAuthenticated,async(req,res)=>{
    try{
      const user=requireSpecialist(req,res);if(!user)return;
      const input=benchmarkInput.parse({tutorAssignmentId:req.query.tutorAssignmentId,
        proofKey:req.query.proofKey}) as {tutorAssignmentId:string;proofKey:PracticalBenchmarkProof};
      return res.json(await getSpecialistRecordingRecovery({...input,tutorId:String(user.id)}));
    }catch(error){return respondError(res,error,"Could not read the recording recovery state.");}
  });
  app.post("/api/tutor/capability-practicals/benchmark/:runId/recovery",isAuthenticated,async(req,res)=>{
    try{
      const user=requireSpecialist(req,res);if(!user)return;
      const body=benchmarkInput.extend({
        reason:recoveryReason,incidentNote:z.string().trim().min(30).max(3000),
      }).strict().parse(req.body) as {
        tutorAssignmentId:string;proofKey:PracticalBenchmarkProof;
        reason:"recording_interrupted"|"recording_unusable"|"accessibility_failure";
        incidentNote:string;
      };
      const runId=z.string().uuid().parse(req.params.runId);
      return res.status(201).json(await requestPracticalRecordingRecovery({
        ...body,runId,tutorId:String(user.id),
      }));
    }catch(error){return respondError(res,error,"Unable to request a TD-authorised recording repeat.");}
  });
  app.get("/api/capability-review/practicals/recording-recoveries/pending",isAuthenticated,async(req,res)=>{
    try{
      const reviewer=requireReviewer(req,res);if(!reviewer)return;
      return res.json({queue:await getAssignedTdRecordingRecoveryQueue({
        reviewerId:String(reviewer.id),reviewerRole:String(reviewer.role),
      })});
    }catch(error){return respondError(res,error,"Unable to load assigned recording incidents.");}
  });
  app.post("/api/capability-review/practicals/recording-recoveries/:requestId/decision",isAuthenticated,async(req,res)=>{
    try{
      const reviewer=requireReviewer(req,res);if(!reviewer)return;
      const body=z.object({
        decision:z.enum(["approve_repeat","deny","integrity_review"]),
        rationale:z.string().trim().min(30).max(3000),
      }).strict().parse(req.body) as {
        decision:"approve_repeat"|"deny"|"integrity_review";rationale:string;
      };
      const requestId=z.string().uuid().parse(req.params.requestId);
      return res.status(201).json(await decidePracticalRecordingRecovery({
        ...body,requestId,reviewerId:String(reviewer.id),reviewerRole:String(reviewer.role),
      }));
    }catch(error){return respondError(res,error,"Recording recovery decision could not be recorded.");}
  });

  // A Specialist cannot choose the case, response sequence, or a new attempt to cherry-pick an easier outcome.
  app.get("/api/tutor/capability-practicals/execute-challenge",isAuthenticated,async (req,res)=>{
    try {
      const user=requireSpecialist(req,res); if(!user)return;
      const tutorAssignmentId=z.string().trim().min(1).parse(req.query.tutorAssignmentId);
      return res.json(await getExecuteChallengeStatus({tutorAssignmentId,tutorId:String(user.id)}));
    } catch(error){return respondError(res,error,"Failed to load Execute challenge.");}
  });
  app.post("/api/tutor/capability-practicals/execute-challenge/start",isAuthenticated,async (req,res)=>{
    try {
      const user=requireSpecialist(req,res); if(!user)return;
      const body=z.object({tutorAssignmentId:z.string().trim().min(1)}).strict().parse(req.body);
      return res.status(201).json(await startExecuteChallenge({tutorAssignmentId:body.tutorAssignmentId,tutorId:String(user.id)}));
    } catch(error){return respondError(res,error,"Failed to start Execute challenge.");}
  });
  app.post("/api/tutor/capability-practicals/execute-challenge/:challengeId/turn",isAuthenticated,async (req,res)=>{
    try {
      const user=requireSpecialist(req,res); if(!user)return;
      const responseSchema=z.object({
        intervention:z.enum(["none","neutral_clarification","first_step_confirmation","method_or_step_prompt","full_rescue_or_teaching","timer_changed"]),
        studentFacingResponse:z.string().trim().min(30).max(2000),
        observedBehavior:z.string().trim().min(30).max(2000),
        evidenceStatus:z.enum(["observed","not_observed","confounded"]),
        independenceClaim:z.enum(["independent","assisted","not_established"]),
        nextAction:z.enum(["continue","pause_for_evidence","escalate"]),
        decisionReason:z.string().trim().min(30).max(2000),
      }).strict();
      const body=z.object({
        tutorAssignmentId:z.string().trim().min(1),
        turnNumber:z.number().int().min(1).max(3),
        response:responseSchema,
      }).strict().parse(req.body);
      const challengeId=z.string().uuid().parse(req.params.challengeId);
      return res.status(201).json(await recordExecuteTurn({
        tutorAssignmentId:body.tutorAssignmentId,tutorId:String(user.id),challengeId,
        turnNumber:body.turnNumber,response:body.response as ExecuteResponse,
      }));
    } catch(error){return respondError(res,error,"Failed to record Execute turn.");}
  });

  app.get(
    "/api/capability-review/practicals/pending",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const user = requireReviewer(req, res);
        if (!user) return;
        const queue = await getPracticalReviewQueue({
          reviewerId: String(user.id),
          reviewerRole: String(user.role),
        });
        return res.json({ queue });
      } catch (error) {
        return respondError(res, error, "Failed to load practical capability review queue.");
      }
    },
  );

  app.post(
    "/api/capability-review/practicals/:evidenceId/review",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const user = requireReviewer(req, res);
        if (!user) return;
        const payload = practicalReviewSchema.parse(req.body);

        const result = await reviewPracticalCapabilityEvidence({
          evidenceId: String(req.params.evidenceId || "").trim(),
          reviewerId: String(user.id),
          reviewerRole: String(user.role),
          rubricVersion: payload.rubricVersion,
          criterionJudgments: payload.criterionJudgments as CapabilityPracticalCriterionReviewInput[],
          feedback: payload.feedback,
          executeTraceVideoVerified: payload.executeTraceVideoVerified===true,
          benchmarkCaseReviews: payload.benchmarkCaseReviews as PracticalCaseReview[],
          videoVerification: payload.videoVerification as PracticalVideoVerification,
        });

        return res.status(201).json(result);
      } catch (error) {
        return respondError(res, error, "Failed to review practical capability evidence.");
      }
    },
  );
  app.post("/api/td/tutors/:tutorId/practicals-completion", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const user = requireReviewer(req,res);
      if (!user) return;
      const body = z.object({
        tutorAssignmentId:z.string().trim().min(1),
        decision:z.enum(["approved","remediation_required"]),
        evidenceNote:z.string().trim().min(30).max(4000),
      }).strict().parse(req.body);
      const result=await recordPracticalTdCompletion({
        tutorAssignmentId:body.tutorAssignmentId,
        tutorId:String(req.params.tutorId || ""),
        reviewerId:String(user.id),
        decision:body.decision,
        evidenceNote:body.evidenceNote,
      });
      return res.status(201).json(result);
    } catch(error) { return respondError(res,error,"Failed to record Practicals completion."); }
  });

  app.get("/api/td/tutors/:tutorId/practicals", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const td=requireReviewer(req,res); if(!td)return;
      const tutorId=String(req.params.tutorId||"");
      const match=await pool.query(
        `SELECT ta.id FROM public.tutor_assignments ta JOIN public.pods p ON p.id=ta.pod_id
         WHERE ta.tutor_id=$1 AND p.td_id=$2 ORDER BY ta.created_at DESC LIMIT 1`,
        [tutorId,String(td.id)],
      );
      if(!match.rows.length)return res.status(403).json({message:"Specialist is not assigned to your Pod."});
      const tutorAssignmentId=String(match.rows[0].id);
      const status=await getPracticalCompletionStatus(tutorAssignmentId,tutorId);
      return res.json({tutorAssignmentId,...status});
    } catch(error){return respondError(res,error,"Failed to load Practicals status.");}
  });

}
