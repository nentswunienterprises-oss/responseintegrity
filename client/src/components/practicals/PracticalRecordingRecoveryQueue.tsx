import { useState } from "react";
import { useQuery,useMutation,useQueryClient } from "@tanstack/react-query";
import { Card,CardContent,CardHeader,CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type Recovery={
 requestId:string;runId:string;reason:string;incidentNote:string;requestedAt:string;
 tutorAssignmentId:string;tutorId:string;specialistName:string;podName:string|null;
 proofKey:string;proofVersion:number;bankVersion:number;attemptNumber:number;
 activeCaseIndex:number;startedAt:string;
};
type Decision="approve_repeat"|"deny"|"integrity_review";

export default function PracticalRecordingRecoveryQueue(){
 const {toast}=useToast(),cache=useQueryClient();
 const [notes,setNotes]=useState<Record<string,string>>({});
 const [outcomes,setOutcomes]=useState<Record<string,Decision>>({});
 const queryKey=["practical-recording-recovery-td"];
 const q=useQuery<{queue:Recovery[]}>({
   queryKey,queryFn:async()=>(await apiRequest("GET",
     "/api/capability-review/practicals/recording-recoveries/pending")).json(),
   retry:false,
 });
 const action=useMutation({
   mutationFn:async(input:{requestId:string;decision:Decision;rationale:string})=>
     (await apiRequest("POST",
       "/api/capability-review/practicals/recording-recoveries/"+encodeURIComponent(input.requestId)+"/decision",
       {decision:input.decision,rationale:input.rationale})).json(),
   onSuccess:()=>cache.invalidateQueries({queryKey}),
   onError:(e:Error)=>toast({title:"TD recovery decision not recorded",description:e.message,variant:"destructive"}),
 });
 return <Card>
   <CardHeader>
     <CardTitle>Recording incidents awaiting assigned TD</CardTitle>
     <p className="text-sm text-muted-foreground">These are interrupted or unusable assessment recordings, not ordinary failed competency reviews. Review the incident evidence before authorizing a separate new attempt. The original cases, actions and recording remain immutable.</p>
   </CardHeader>
   <CardContent className="space-y-4">
     {q.isLoading&&<p className="text-sm">Checking assigned recording incidents...</p>}
     {q.isError&&<p role="alert" className="text-sm">Could not load assigned incident reviews: {String((q.error as Error).message)}</p>}
     {!q.isLoading&&!q.isError&&!q.data?.queue.length&&
       <p className="text-sm text-muted-foreground">No recordings awaiting recovery authorization.</p>}
     {(q.data?.queue||[]).map(item=>{
       const value=outcomes[item.requestId]||"";
       const rationale=notes[item.requestId]||"";
       return <div className="border rounded-lg p-4 space-y-2" key={item.requestId}>
         <p className="font-semibold">{item.specialistName||"Specialist"} · {item.proofKey} · attempt {item.attemptNumber}</p>
         <p className="text-xs text-muted-foreground">{item.podName||"Assigned Pod"} · Case {item.activeCaseIndex} · {new Date(item.requestedAt).toLocaleString("en-ZA")} · Reference {item.runId.slice(0,8).toUpperCase()}</p>
         <p className="text-sm"><strong>Declared issue:</strong> {item.reason.replaceAll("_"," ")}</p>
         <p className="text-sm whitespace-pre-wrap">{item.incidentNote}</p>
         <p className="text-xs text-muted-foreground">Compare the incident with the preserved operating and original recording evidence. Do not infer an edit or manipulation without evidence.</p>
         <label className="block text-sm font-medium">Independent TD decision
           <select value={value} className="block w-full rounded border bg-background mt-1 p-2"
             onChange={e=>setOutcomes(x=>({...x,[item.requestId]:e.target.value as Decision}))}>
             <option value="">Choose after checking the incident</option>
             <option value="approve_repeat">Approve one new full attempt; preserve old history</option>
             <option value="deny">Do not authorize replacement</option>
             <option value="integrity_review">Escalate suspected manipulation for integrity review</option>
           </select>
         </label>
         <label className="block text-sm font-medium">TD's observed reason
           <Textarea value={rationale} onChange={e=>setNotes(x=>({...x,[item.requestId]:e.target.value}))}
             rows={3} maxLength={3000} placeholder="Explain the concrete incident evidence, missing intervals, decision and next action."/>
         </label>
         <Button type="button" disabled={!value||rationale.trim().length<30||action.isPending}
           onClick={()=>action.mutate({requestId:item.requestId,decision:value as Decision,rationale:rationale.trim()})}>
           {action.isPending?"Recording decision...":"Record immutable TD decision"}
         </Button>
       </div>;
     })}
   </CardContent>
 </Card>;
}
