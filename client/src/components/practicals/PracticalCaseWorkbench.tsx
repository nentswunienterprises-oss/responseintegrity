import { useState } from "react";
import { useMutation,useQuery,useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card,CardContent,CardHeader,CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import ResponsiveExecuteChallenge from "./ResponsiveExecuteChallenge";
import { LivePhaseContext,LiveRepStage,LiveObservationField,LiveSandboxStudentResponse,liveObservationQuestion,liveObservationLabel } from "@/components/tutor/TrainingLiveDeliveryUi";
import type { PracticalDimensionObservation } from "@shared/practicalRepObservation";
import type { PracticalBenchmarkProof } from "@shared/practicalBenchmarkPolicy";

type Step = {
 number:number;kind:"configure"|"respond"|"begin_rep"|"rep"|"adaptive"|"decide";
 label:string;prompt:string;phase?:string;setId?:string;repNumber?:number;
 studentBehavior?:string;observedSupport?:string;
 registry?:{
   schemaId:string;schemaVersion:number;phase:string;setId?:string;setName?:string;repNumber?:number;
   setOptions?:Array<{setId:string;label:string;supportLevel:string;pressureLevel:string}>;
   fields?:Array<{fieldKey:string;dimensionId:string;options:Array<{optionId:string;label:string}>}>;
 };
};
type Work = {
 caseKey:string;caseSequence:number;stepCount:number;completed:boolean;completedSteps:number;
 currentStep:Step|null;
 events:Array<{stepNumber:number;operationKey:string;recordedAt:string;recordedPayload:Record<string,unknown>}>;
};
const INTERVENTIONS=[
 ["none","No intervention"],["neutral_clarification","Neutral clarification"],
 ["first_step_confirmation","First-step confirmation"],["method_or_step_prompt","Method/step prompt"],
 ["full_rescue_or_teaching","Full rescue or teaching"],["timer_changed","Changed timing"],
] as const;
const EVIDENCE=[["observed","Observed"],["not_observed","Not observed"],["confounded","Confounded"]] as const;
const INDEPENDENCE=[["independent","Independent"],["assisted","Assisted"],["not_established","Not established"]] as const;
const NEXT=[
 ["continue","Continue as authorized"],["pause_for_evidence","Pause for evidence"],
 ["evidence_recovery","Request evidence recovery"],["escalate","Escalate"],
 ["system_confirmation","Leave confirmation to system"],
] as const;
const TIMING=[["not_applicable","No timed claim"],["valid","Valid timed observation"],
 ["interrupted","Interrupted timer"],["unverified","Timing unverified"]] as const;
const CLAIM=[["not_established","Not established"],["assisted","Assisted evidence"],
 ["observed_independent","Observed independence"],["system_decision_pending","System confirmation pending"]] as const;
const SUPPORT=[["none","No support"],["minimal","Minimal"],["first_step_only","First step only"],["modeled","Modeled"]] as const;
const PRESSURE=[["none","None"],["difficulty","Difficulty"],["light_timer","Light timer"],
 ["repeated_timer","Repeated timer"],["full_constraint","Full constraint"]] as const;

function Field({label,value,onChange,options}:{
 label:string;value:string;onChange:(value:string)=>void;options:readonly (readonly [string,string])[];
}){
 return <label className="block space-y-1 text-sm font-medium">{label}
   <select className="w-full rounded-md border bg-background p-2" value={value}
     onChange={e=>onChange(e.target.value)}>
     <option value="">Choose the action you actually took</option>
     {options.map(([id,text])=><option key={id} value={id}>{text}</option>)}
   </select>
 </label>;
}
function Written({label,value,onChange}:{
 label:string;value:string;onChange:(value:string)=>void;
}){
 return <label className="block space-y-1 text-sm font-medium">{label}
   <Textarea className="min-h-20" value={value} onChange={e=>onChange(e.target.value)}
     placeholder="Describe exactly what you did, said or observed during this recording." maxLength={2000}/>
   <span className="text-xs text-muted-foreground">{value.trim().length} characters. Minimum 30.</span>
 </label>;
}
function PracticalWorkStepForm({step,onSave,pending,onExecuteComplete,assignmentId}:{
 step:Step;onSave:(payload:Record<string,unknown>)=>void;pending:boolean;
 onExecuteComplete:(id:string|null)=>void;assignmentId:string;
}){
 const [form,setForm]=useState<Record<string,string>>({});
 const [observations,setObservations]=useState<Record<string,PracticalDimensionObservation>>({});
 const [video,setVideo]=useState({cameraReady:false,microphoneReady:false,workSurfaceReady:false});
 const set=(key:string,value:string)=>setForm(v=>({...v,[key]:value}));
 const get=(key:string)=>form[key]||"";
 const long=(...keys:string[])=>keys.every(key=>get(key).trim().length>=30);
 const choices=(...keys:string[])=>keys.every(key=>!!get(key));
 const kind=step.kind;
 const setup=kind==="configure";
 const responding=kind==="respond";
 const rep=kind==="rep";
 const decision=kind==="decide";
 const ready=kind==="begin_rep"||kind==="adaptive"||
   (setup&&choices("selectedSetId","supportLevel","pressureLevel")&&
     Object.values(video).every(Boolean)&&long("spokenOpening","decisionReason"))||
   (responding&&choices("intervention","evidenceStatus","independenceClaim","nextAction")&&
     long("studentFacingResponse","observedBehavior","decisionReason"))||
   (rep&&choices("intervention","evidenceStatus","independenceClaim","timingStatus")&&
     long("studentFacingResponse","observedBehavior","decisionReason")&&
     (step.registry?.fields||[]).every(f=>{
       const selection=observations[f.fieldKey];
       return Boolean(selection&&(selection.evidenceStatus!=="observed"||!!selection.optionId));
     }))||
   (decision&&choices("nextAction","evidenceClaim")&&long("decisionReason","evidenceBoundary"));
 const submit=()=>{
   if(!ready)return;
   if(kind==="begin_rep"||kind==="adaptive")return onSave({});
   if(kind==="configure")return onSave({...form,...video});
   if(kind==="rep")return onSave({...form,observationSelections:observations});
   return onSave(form);
 };
 return <div className="space-y-4 rounded-md border p-4">
   <div className="space-y-1">
     <p className="text-xs text-muted-foreground">Live operation {step.number}: {kind.replaceAll("_"," ")}</p>
     <h3 className="font-semibold">{step.label}</h3>
     <p className="text-sm">{step.prompt}</p>
     {step.phase&&["Clarity","Structured Execution","Controlled Discomfort","Time Pressure Stability"].includes(step.phase)&&
       <LivePhaseContext phase={step.phase as "Clarity"|"Structured Execution"|"Controlled Discomfort"|"Time Pressure Stability"}/>}
     {kind==="begin_rep"&&<LiveRepStage stage="ready" sandbox/>}
     {kind==="rep"&&<LiveRepStage stage="observe" sandbox/>}
     {step.studentBehavior&&kind!=="begin_rep"&&
       <LiveSandboxStudentResponse>{step.studentBehavior}</LiveSandboxStudentResponse>}
   </div>
   {setup&&<>
     <Field label="Select the actual training drill/set to open" value={get("selectedSetId")}
       onChange={v=>set("selectedSetId",v)}
       options={(step.registry?.setOptions||[]).map(s=>[s.setId,s.label] as const)}/>
     <Field label="Support constraint applied" value={get("supportLevel")} onChange={v=>set("supportLevel",v)} options={SUPPORT}/>
     <Field label="Pressure constraint applied" value={get("pressureLevel")} onChange={v=>set("pressureLevel",v)} options={PRESSURE}/>
     {(["cameraReady","microphoneReady","workSurfaceReady"] as const).map(key=>
       <label className="flex items-center gap-2 text-sm" key={key}>
         <input type="checkbox" checked={video[key]} onChange={e=>setVideo(x=>({...x,[key]:e.target.checked}))}/>
         {key==="cameraReady"?"Camera and work view demonstrated":key==="microphoneReady"?
           "Voice/microphone demonstrated":"Student response/work surface demonstrated"}
       </label>)}
     <Written label="Student-facing opening actually spoken on video" value={get("spokenOpening")} onChange={v=>set("spokenOpening",v)}/>
     <Written label="Why this setup and support boundary were used" value={get("decisionReason")} onChange={v=>set("decisionReason",v)}/>
   </>}
   {responding&&<>
     <Field label="Intervention actually delivered" value={get("intervention")} onChange={v=>set("intervention",v)} options={INTERVENTIONS}/>
     <Written label="Exact student-facing language actually spoken" value={get("studentFacingResponse")} onChange={v=>set("studentFacingResponse",v)}/>
     <Written label="Response and behavior actually observable" value={get("observedBehavior")} onChange={v=>set("observedBehavior",v)}/>
     <Field label="Evidence status" value={get("evidenceStatus")} onChange={v=>set("evidenceStatus",v)} options={EVIDENCE}/>
     <Field label="Independence claim" value={get("independenceClaim")} onChange={v=>set("independenceClaim",v)} options={INDEPENDENCE}/>
     <Field label="Next action" value={get("nextAction")} onChange={v=>set("nextAction",v)} options={NEXT}/>
     <Written label="Why you chose the intervention and next action" value={get("decisionReason")} onChange={v=>set("decisionReason",v)}/>
   </>}
   {rep&&<>
     <p className="text-sm font-medium">Active training registry observation fields · {step.registry?.setName}</p>
     <p className="text-xs text-muted-foreground">Observe → record evidence. For unobserved or confounded work, record the exception without inventing a response option.</p>
     {(step.registry?.fields||[]).map(f=>{
       const current=observations[f.fieldKey];
       return <LiveObservationField key={f.fieldKey}
         question={liveObservationQuestion(f.dimensionId,f.dimensionId.replaceAll("."," "))}
         label={liveObservationLabel(f.dimensionId,f.dimensionId.replaceAll("."," "))}
         options={f.options.map(o=>({id:o.optionId,label:o.label}))}
         selected={current?.evidenceStatus==="observed"?current.optionId:null}
         onSelect={optionId=>setObservations(x=>({...x,[f.fieldKey]:{optionId,evidenceStatus:"observed"}}))}
         evidenceStatus={current?.evidenceStatus||"observed"}
         showEvidenceExceptions={true}
         allowEvidenceExceptionWithoutOption
         onEvidenceStatus={evidenceStatus=>setObservations(x=>({...x,[f.fieldKey]:{
           optionId:evidenceStatus==="observed"?(x[f.fieldKey]?.optionId||null):null,
           evidenceStatus,
         }}))}/>
     })}
     <Field label="Support that actually occurred" value={get("intervention")} onChange={v=>set("intervention",v)} options={INTERVENTIONS}/>
     <Field label="Evidence observability" value={get("evidenceStatus")} onChange={v=>set("evidenceStatus",v)} options={EVIDENCE}/>
     <Field label="Independence claim" value={get("independenceClaim")} onChange={v=>set("independenceClaim",v)} options={INDEPENDENCE}/>
     <Field label="Timing evidence status" value={get("timingStatus")} onChange={v=>set("timingStatus",v)} options={TIMING}/>
     <Written label="Your actual student-facing conduct while this rep occurred" value={get("studentFacingResponse")} onChange={v=>set("studentFacingResponse",v)}/>
     <Written label="Rep-specific observable student behavior" value={get("observedBehavior")} onChange={v=>set("observedBehavior",v)}/>
     <Written label="Why this rep was logged with these exact conditions" value={get("decisionReason")} onChange={v=>set("decisionReason",v)}/>
   </>}
   {decision&&<>
     <Field label="Authorized next action" value={get("nextAction")} onChange={v=>set("nextAction",v)} options={NEXT}/>
     <Field label="What the evidence permits claiming" value={get("evidenceClaim")} onChange={v=>set("evidenceClaim",v)} options={CLAIM}/>
     <Written label="Walk through the decision actually made" value={get("decisionReason")} onChange={v=>set("decisionReason",v)}/>
     <Written label="Explain what remains unsupported and system-owned" value={get("evidenceBoundary")} onChange={v=>set("evidenceBoundary",v)}/>
   </>}
   {kind==="begin_rep"&&<p className="text-sm">Begin the simulated observation now while recording. The server will timestamp this rep before revealing its response and evidence fields.</p>}
   {kind==="adaptive"&&<ResponsiveExecuteChallenge assignmentId={assignmentId}
     enabled={true} onComplete={onExecuteComplete}/>}
   <Button disabled={!ready||pending} onClick={submit}>
     {pending?"Saving operation...":kind==="adaptive"?"Verify saved three-turn execution":
       kind==="begin_rep"?"Begin system-observed rep":"Record completed live operation"}
   </Button>
   <p className="text-xs text-muted-foreground">Actions are immutable and matched against the continuous recording. An incorrect decision remains visible to the TD; it is never silently corrected.</p>
 </div>;
}

export default function PracticalCaseWorkbench({runId,caseSequence,proofKey,assignmentId,onExecuteComplete}:{
 runId:string;caseSequence:number;proofKey:PracticalBenchmarkProof;assignmentId:string;
 onExecuteComplete:(id:string|null)=>void;
}){
 const {toast}=useToast();const cache=useQueryClient();
 const key=["practical-case-work",runId,caseSequence];
 const endpoint="/api/tutor/capability-practicals/benchmark/"+encodeURIComponent(runId)+"/work";
 const q=useQuery<Work>({
   queryKey:key,enabled:!!runId,queryFn:async()=>(await apiRequest("GET",
     endpoint+"?tutorAssignmentId="+encodeURIComponent(assignmentId)+"&proofKey="+proofKey)).json(),
 });
 const save=useMutation({
   mutationFn:async(input:{stepNumber:number;payload:Record<string,unknown>}):Promise<Work>=>
     (await apiRequest("POST",endpoint,{
       tutorAssignmentId:assignmentId,proofKey,...input,
     })).json(),
   onSuccess:result=>{
     cache.setQueryData(key,result);
     cache.invalidateQueries({queryKey:["practical-common-benchmark",assignmentId,proofKey]});
   },
   onError:(e:Error)=>toast({title:"Live operation not recorded",description:e.message,variant:"destructive"}),
 });
 return <Card className="rounded-none">
   <CardHeader><CardTitle>System-provisioned execution workbench</CardTitle>
     <p className="text-sm text-muted-foreground">Operate the issued RI-OS workflow, not just describe it. Speak your decisions on the continuous recording while entering the real drill, intervention and rep-evidence fields below.</p>
   </CardHeader>
   <CardContent className="space-y-3">
     {q.isLoading&&<p className="text-sm">Loading real case workflow...</p>}
     {q.isError&&<p role="alert" className="text-sm">Could not load the case workflow: {String((q.error as Error).message)}</p>}
     {q.data&&<p className="text-sm font-medium">{q.data.completedSteps} of {q.data.stepCount} durable operations recorded for case {q.data.caseSequence}</p>}
     {q.data?.currentStep&&<PracticalWorkStepForm
       key={runId+"-"+caseSequence+"-"+q.data.currentStep.number}
       step={q.data.currentStep}
       assignmentId={assignmentId}
       onExecuteComplete={onExecuteComplete}
       pending={save.isPending}
       onSave={payload=>save.mutate({stepNumber:q.data!.currentStep!.number,payload})}/>}
     {q.data?.completed&&<p className="rounded-md border bg-muted/20 p-3 text-sm font-medium">
       All required system-issued actions are recorded. Continue to the next case while keeping the original video running.
     </p>}
     {(q.data?.events||[]).length>0&&<div className="space-y-1">
       <p className="text-sm font-medium">Permanent case operation trail</p>
       {q.data!.events.map(e=><p key={e.stepNumber} className="text-xs text-muted-foreground">
         {e.stepNumber}. {e.operationKey.replaceAll("_"," ")} saved · {new Date(e.recordedAt).toLocaleTimeString("en-ZA")}
       </p>)}
     </div>}
   </CardContent>
 </Card>;
}
