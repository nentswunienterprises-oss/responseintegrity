import type {Request,Response} from "express";
import {loadSandboxQualificationEvidence} from "./sandboxQualificationEvidence";
import {evaluateSandboxQualification} from "@shared/sandboxQualificationPolicy";
import {resolveSandboxBehaviorProfile} from "@shared/sandboxBehaviorProfiles";
type DB={query:(sql:string,values?:any[])=>Promise<{rows:any[]}>};

/** Read-only TD authority: latest Pod ownership is checked BEFORE private history. */
export function createTdSandboxQualificationReview(db?:DB){
 return async (req:Request,res:Response)=>{
  try {
   const td=(req as any).dbUser;
   if(!td?.id)return res.status(401).json({message:"Authentication required."});
   if(String(td.role||"").toLowerCase()!=="td")
    return res.status(403).json({message:"TD access required."});
   const tutorId=String(req.params.tutorId||"").trim();
   if(!tutorId)return res.status(400).json({message:"tutorId is required."});
   const sourceDb=db ?? (await import("./db")).pool;
   const assignment=await sourceDb.query(
    "SELECT ta.id FROM (SELECT id,pod_id FROM public.tutor_assignments "+
    "WHERE tutor_id=$1 ORDER BY created_at DESC,id DESC LIMIT 1) ta "+
    "JOIN public.pods p ON p.id=ta.pod_id WHERE p.td_id=$2",
    [tutorId,String(td.id)],
   );
   if(!assignment.rows[0])
    return res.status(403).json({message:"Specialist is outside your assigned Pod."});
   const tutorAssignmentId=String(assignment.rows[0].id);
   res.setHeader("Cache-Control","private,no-store,max-age=0");
   const [history, assigned]=await Promise.all([
    loadSandboxQualificationEvidence({tutorAssignmentId,tutorId},sourceDb),
    sourceDb.query(
     "SELECT t.id,truth.trajectory_seed FROM public.specialist_sandbox_trajectories t "+
     "JOIN private.specialist_sandbox_trajectory_truth truth ON truth.trajectory_id=t.id "+
     "WHERE t.tutor_assignment_id=$1 AND t.tutor_id=$2",
     [tutorAssignmentId,tutorId],
    ),
   ]);
   const activated=process.env.RI_SANDBOX_QUALIFICATION_V1_ACTIVE==="true";
   let qualification=evaluateSandboxQualification(history.events,{activated});
   if(history.sourceGaps.length)qualification={
     ...qualification,qualificationReady:false,
     technicalBlockers:[...qualification.technicalBlockers,...history.sourceGaps],
     reason:"Qualification cannot be accepted without complete historical source coverage.",
   };
   const assignedByProfile:Record<string,number>={};
   for(const row of assigned.rows){
    const name=resolveSandboxBehaviorProfile(String(row.trajectory_seed));
    assignedByProfile[name]=(assignedByProfile[name]||0)+1;
   }
   return res.json({
    tutorId,tutorAssignmentId,qualification,assignedByProfile,
    sourceGaps:history.sourceGaps,
    // TD may inspect recorded chronology, but no future/outcome-bank answers.
    evidence:history.events.slice(-250).map(e=>({
     id:e.id,occurredAt:e.occurredAt,kind:e.kind,mode:e.mode,
     studentId:e.studentId,trajectoryId:e.trajectoryId,phase:e.phase,
     profile:e.profile,situationTags:e.situationTags,observed:e.observed,
     complete:e.complete,canonicalPresent:e.canonicalPresent,
     conditionKept:e.conditionKept,observationExact:e.observationExact,
     evidenceExact:e.evidenceExact,authorityAligned:e.authorityAligned,
     stateAligned:e.stateAligned,materialError:e.materialError,
     technicallyValid:e.technicallyValid,sourceId:e.sourceId,sourceType:e.sourceType,
     bankVersion:e.bankVersion,outcomeVersion:e.outcomeVersion,
    })),
    note:"Historical completed evidence only. Assigned profile is not an observed capability. No future canonical responses.",
   });
  } catch(error){
   console.error("TD Sandbox qualification review unavailable",error);
   return res.status(500).json({message:"Sandbox qualification evidence unavailable; readiness cannot be inferred."});
  }
 };
}
