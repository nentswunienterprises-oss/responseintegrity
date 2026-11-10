import { useState } from "react";
import { useMutation,useQuery,useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import type { PracticalBenchmarkProof } from "@shared/practicalBenchmarkPolicy";

type RecoveryState={
 runId:string|null;status:string|null;attemptNumber:number;
 recovery:null|{reason:string;incidentNote:string;requestedAt:string;
   decision:"approve_repeat"|"deny"|"integrity_review"|null;rationale:string|null};
};
const reasons=[
 {value:"recording_interrupted",label:"Recording stopped or lost an assessed interval"},
 {value:"recording_unusable",label:"Original audio, video or screen recording unusable"},
 {value:"accessibility_failure",label:"Accessibility or essential observation tool failed"},
] as const;
export function PracticalRecordingRecoveryControls({runId,assignmentId,proofKey}:{
 runId:string;assignmentId:string;proofKey:PracticalBenchmarkProof;
}){
 const [open,setOpen]=useState(false);
 const [reason,setReason]=useState<(typeof reasons)[number]["value"]>("recording_interrupted");
 const [note,setNote]=useState("");
 const {toast}=useToast();const client=useQueryClient();
 const queryKey=["practical-recovery",assignmentId,proofKey,runId];
 const q=useQuery<RecoveryState>({
   queryKey,enabled:!!runId,
   queryFn:async()=>(await apiRequest("GET",
     "/api/tutor/capability-practicals/recording-recovery?tutorAssignmentId="+encodeURIComponent(assignmentId)+"&proofKey="+proofKey)).json(),
 });
 const mutation=useMutation({
   mutationFn:async()=>(await apiRequest("POST",
     "/api/tutor/capability-practicals/benchmark/"+encodeURIComponent(runId)+"/recovery",
     {tutorAssignmentId:assignmentId,proofKey,reason,incidentNote:note.trim()})).json(),
   onSuccess:async()=>{
     await Promise.all([
       client.invalidateQueries({queryKey}),
       client.invalidateQueries({queryKey:["practical-common-benchmark",assignmentId,proofKey]}),
     ]);
     setOpen(false);
   },
   onError:(e:Error)=>toast({title:"Recovery not recorded",description:e.message,variant:"destructive"}),
 });
 const recovery=q.data?.runId===runId?q.data?.recovery:null;
 return <div className="rounded-md border p-3 space-y-2">
   <p className="text-sm font-semibold">Recording interrupted or unusable?</p>
   <p className="text-xs text-muted-foreground">Do not edit, stitch or restart the issued recording. Report what happened; the original case history remains preserved. Only your assigned TD can authorize another attempt.</p>
   {q.isError&&<p role="alert" className="text-sm">Recovery status unavailable. Do not attempt another recording: {String((q.error as Error).message)}</p>}
   {recovery&&<p className="text-sm">{recovery.decision==="approve_repeat"
     ?"The assigned TD authorized a new assessment attempt. The original record is retained."
     :recovery.decision==="deny"?"The TD denied an independent repeat; preserve the original and follow the recorded review decision."
     :recovery.decision==="integrity_review"?"This recording is under formal integrity review. No new attempt is authorized."
     :"Your incident is recorded; the assigned TD must review it before a replacement can be issued."}
     {recovery.rationale&&<span className="block mt-1 text-xs text-muted-foreground">{recovery.rationale}</span>}</p>}
   {!q.isLoading&&!q.isError&&!recovery&&<>
     {!open?<Button type="button" variant="outline" onClick={()=>setOpen(true)}>Report a recording incident</Button>:<>
       <label className="block text-sm font-medium">Incident category
         <select className="mt-1 w-full rounded border bg-background p-2" value={reason}
           onChange={e=>setReason(e.target.value as typeof reason)}>
           {reasons.map(r=><option value={r.value} key={r.value}>{r.label}</option>)}
         </select>
       </label>
       <label className="block text-sm font-medium">What actually failed?
         <Textarea rows={4} maxLength={3000} value={note} onChange={e=>setNote(e.target.value)}
           placeholder="Explain when the original recording became unusable, what evidence was affected and whether the original file still exists."/>
       </label>
       <div className="flex gap-2 flex-wrap">
         <Button type="button" disabled={note.trim().length<30||mutation.isPending}
           onClick={()=>mutation.mutate()}>{mutation.isPending?"Recording incident...":"Send to assigned TD"}</Button>
         <Button type="button" variant="ghost" onClick={()=>setOpen(false)}>Cancel</Button>
       </div>
     </>}
   </>}
 </div>;
}
