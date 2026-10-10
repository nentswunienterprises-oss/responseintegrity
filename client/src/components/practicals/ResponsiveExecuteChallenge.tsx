import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import type { ExecuteResponse } from "@shared/practicalExecuteChallenge";

type CurrentTurn = { number:number;kind:string;studentBehavior:string;evidenceQuestion:string };
type Challenge = {
 started:boolean;allowed?:boolean;reason?:string|null;challengeId?:string;completed:boolean;
 attemptNumber?:number;brief?:{phase:string;context:string;student:string;operatingBoundary:string;totalTurns:number};
 currentTurn?:CurrentTurn|null;turnCount?:number;
 history?:Array<{number:number;situation:CurrentTurn;response:ExecuteResponse}>;
};
type Draft = {[K in keyof ExecuteResponse]:string};
const BLANK:Draft={
 intervention:"",studentFacingResponse:"",observedBehavior:"",
 evidenceStatus:"",independenceClaim:"",nextAction:"",decisionReason:"",
};
const INTERVENTIONS=[
 ["none","No intervention"],["neutral_clarification","Neutral clarification"],
 ["first_step_confirmation","First-step confirmation"],["method_or_step_prompt","Method/step prompt"],
 ["full_rescue_or_teaching","Rescue or teaching"],["timer_changed","Changed timing"],
];
function OptionField({label,value,onChange,options}:{label:string;value:string;onChange:(x:string)=>void;options:string[][]}) {
 return <label className="block text-sm font-medium">{label}
  <select className="mt-1 w-full rounded-md border bg-background p-2 text-sm" value={value} onChange={e=>onChange(e.target.value)}>
   <option value="">Select what actually happened</option>
   {options.map(([key,title])=><option key={key} value={key}>{title}</option>)}
  </select>
 </label>;
}

export default function ResponsiveExecuteChallenge({assignmentId,enabled,onComplete}:{
 assignmentId:string;enabled:boolean;onComplete:(challengeId:string|null)=>void;
}) {
 const {toast}=useToast(); const client=useQueryClient();
 const [draft,setDraft]=useState<Draft>({...BLANK});
 const key=["practicals-execute-challenge",assignmentId];
 const q=useQuery<Challenge>({
  queryKey:key,enabled:!!assignmentId&&enabled,
  queryFn:async()=> (await apiRequest("GET",
   "/api/tutor/capability-practicals/execute-challenge?tutorAssignmentId="+encodeURIComponent(assignmentId))).json(),
 });
 const start=useMutation({
  mutationFn:async():Promise<Challenge>=> (await apiRequest("POST",
   "/api/tutor/capability-practicals/execute-challenge/start",{tutorAssignmentId:assignmentId})).json(),
  onSuccess:r=>client.setQueryData(key,r),
  onError:(error:Error)=>toast({title:"Challenge could not start",description:error.message,variant:"destructive"}),
 });
 const turn=useMutation({
  mutationFn:async():Promise<Challenge>=> {
   if(!q.data?.challengeId||!q.data.currentTurn)throw Error("No active challenge turn.");
   return (await apiRequest("POST",
    "/api/tutor/capability-practicals/execute-challenge/"+encodeURIComponent(q.data.challengeId)+"/turn",
    {tutorAssignmentId:assignmentId,turnNumber:q.data.currentTurn.number,response:draft})).json();
  },
  onSuccess:r=>{client.setQueryData(key,r);setDraft({...BLANK});},
  onError:(error:Error)=>toast({title:"Challenge response not saved",description:error.message,variant:"destructive"}),
 });
 const id=q.data?.completed?q.data.challengeId||null:null;
 useEffect(()=>{onComplete(id)},[id,onComplete]);
 const update=(name:keyof ExecuteResponse,value:string)=>setDraft(p=>({...p,[name]:value}));
 const valid=Boolean(draft.intervention&&draft.evidenceStatus&&draft.independenceClaim&&draft.nextAction
   &&draft.studentFacingResponse.trim().length>=30
   &&draft.observedBehavior.trim().length>=30
   &&draft.decisionReason.trim().length>=30);
 if(!enabled)return null;
 return <Card className="rounded-none">
  <CardHeader><CardTitle>Live Execute challenge</CardTitle>
   <p className="text-sm text-muted-foreground">The next simulated student response is withheld until you record the current decision. You cannot select a different case or rewrite earlier turns.</p>
  </CardHeader>
  <CardContent className="space-y-4">
   {q.isLoading&&<p className="text-sm">Loading your assigned challenge...</p>}
   {q.isError&&<p role="alert" className="text-sm">Unable to load challenge: {String((q.error as Error).message)}</p>}
   {q.data&&!q.data.started&&q.data.allowed===false&&<p className="text-sm">{q.data.reason}</p>}
   {q.data&&!q.data.started&&q.data.allowed!==false&&
    <Button disabled={start.isPending} onClick={()=>start.mutate()}>{start.isPending?"Assigning...":"Begin system-assigned Execute challenge"}</Button>}
   {q.data?.started&&q.data.brief&&<>
    <div className="rounded-md border p-3 space-y-1">
     <p className="text-sm font-semibold">Challenge reference: {q.data.challengeId?.slice(0,8).toUpperCase()}</p>
     <p className="text-xs text-muted-foreground">Show this assigned reference at the beginning of your recording so the TD can match the video to this exact attempt.</p>
     <div className="flex items-center justify-between"><strong className="text-sm">{q.data.brief.phase}</strong><Badge variant="outline">{q.data.turnCount} of {q.data.brief.totalTurns} saved</Badge></div>
     <p className="text-sm">{q.data.brief.context}</p>
     <p className="text-sm text-muted-foreground">{q.data.brief.operatingBoundary}</p>
    </div>
    {q.data.history?.length? <div className="space-y-2">
     <h3 className="font-medium text-sm">Saved, uneditable responses</h3>
     {q.data.history.map(entry=><div key={entry.number} className="border p-3 text-sm space-y-1">
       <p className="font-medium">Turn {entry.number}: {entry.situation.kind.replaceAll("_"," ")}</p>
       <p>{entry.situation.studentBehavior}</p>
       <p className="text-muted-foreground">Your response: {entry.response.studentFacingResponse}</p>
       <p className="text-muted-foreground">Evidence: {entry.response.evidenceStatus}, {entry.response.independenceClaim}</p>
     </div>)}
    </div>:null}
    {q.data.completed?<div className="rounded-md border p-3 space-y-1">
     <strong>All three unexpected turns recorded</strong>
     <p className="text-sm">The server has preserved your actions and observations. Include a recording of the same exercise for your assigned TD to compare with this transcript. Completing the challenge is not an approval.</p>
    </div>:q.data.currentTurn&&<div className="space-y-3 border-t pt-4">
     <p className="font-medium">Unexpected turn {q.data.currentTurn.number}</p>
     <p className="rounded-md border p-3 text-sm">{q.data.currentTurn.studentBehavior}</p>
     <p className="text-sm text-muted-foreground">{q.data.currentTurn.evidenceQuestion}</p>
     <label className="block text-sm font-medium">What did you say to the student?
      <Textarea className="mt-1" value={draft.studentFacingResponse} onChange={e=>update("studentFacingResponse",e.target.value)} placeholder="Record your actual student-facing instructions or response (30+ characters)."/>
     </label>
     <OptionField label="What intervention occurred?" value={draft.intervention} onChange={v=>update("intervention",v)} options={INTERVENTIONS}/>
     <label className="block text-sm font-medium">What was directly observed?
      <Textarea className="mt-1" value={draft.observedBehavior} onChange={e=>update("observedBehavior",e.target.value)} placeholder="Record the actual response, including limitations (30+ characters)."/>
     </label>
     <OptionField label="Evidence status" value={draft.evidenceStatus} onChange={v=>update("evidenceStatus",v)}
      options={[["observed","Observed"],["not_observed","Not observed"],["confounded","Confounded"]]}/>
     <OptionField label="Independence claim" value={draft.independenceClaim} onChange={v=>update("independenceClaim",v)}
      options={[["independent","Independent"],["assisted","Assisted"],["not_established","Cannot establish independence"]]}/>
     <OptionField label="What happens next?" value={draft.nextAction} onChange={v=>update("nextAction",v)}
      options={[["continue","Continue assigned condition"],["pause_for_evidence","Pause for evidence"],["escalate","Escalate beyond Specialist authority"]]}/>
     <label className="block text-sm font-medium">Evidence and authority basis for that action
      <Textarea className="mt-1" value={draft.decisionReason} onChange={e=>update("decisionReason",e.target.value)} placeholder="Explain the evidence supporting the next action and what remains system-owned (30+ characters)."/>
     </label>
     <Button disabled={!valid||turn.isPending} onClick={()=>turn.mutate()}>
      {turn.isPending?"Saving...":q.data.currentTurn.number===3?"Record final turn":"Record turn and reveal next student response"}
     </Button>
    </div>}
   </>}
  </CardContent>
 </Card>;
}
