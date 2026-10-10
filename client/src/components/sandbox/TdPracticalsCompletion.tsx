import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

type Status = {tutorAssignmentId:string;entry:{ready:boolean;blockers:string[]};proofs:Array<{key:string;status:string}>;allApproved:boolean;tdDecision?:{decision:string;evidence_note:string}|null;complete:boolean;readyForTDCompletionReview:boolean};
export function TdPracticalsCompletion({tutorId}:{tutorId:string}) {
 const client=useQueryClient();const {toast}=useToast();const [note,setNote]=useState("");
 const q=useQuery<Status>({queryKey:["td-practicals",tutorId],queryFn:async()=> (await apiRequest("GET",`/api/td/tutors/${encodeURIComponent(tutorId)}/practicals`)).json()});
 const mutation=useMutation({
  mutationFn:async(decision:"approved"|"remediation_required")=> (await apiRequest("POST",`/api/td/tutors/${encodeURIComponent(tutorId)}/practicals-completion`,{tutorAssignmentId:q.data!.tutorAssignmentId,decision,evidenceNote:note.trim()})).json(),
  onSuccess:async()=>{setNote("");toast({title:"TD Practicals decision recorded"});await client.invalidateQueries({queryKey:["td-practicals",tutorId]});},
  onError:(e:Error)=>toast({title:"Decision blocked",description:e.message,variant:"destructive"})
 });
 return <Card className="rounded-none"><CardHeader><CardTitle>Practicals completion</CardTitle></CardHeader><CardContent className="space-y-3">
  {q.isLoading?<p>Loading Practicals evidence...</p>:q.isError?<p role="alert">Unable to load Practicals: {String((q.error as Error).message)}</p>:<>
   <p className="text-sm">{q.data?.complete?"Practicals complete. Governed Trial entry may be reviewed.":q.data?.entry.ready?"Awaiting all three evidence approvals and TD completion decision.":"Sandbox readiness has not yet authorised Practicals."}</p>
   {q.data?.proofs.map(p=><p className="text-sm" key={p.key}><strong>{p.key}</strong>: {p.status}</p>)}
   {q.data?.entry.blockers.map((b,i)=><p className="text-sm" key={i}>{b}</p>)}
   <Button asChild variant="outline"><Link to="/operational/td/practicals-review">Open Practicals review queue</Link></Button>
   {q.data?.tdDecision&&<p className="text-sm">Latest TD decision: {q.data.tdDecision.decision}. {q.data.tdDecision.evidence_note}</p>}
   {!q.data?.complete&&<><Textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="Evidence observed, gaps or completion basis (minimum 30 characters)"/>
    <div className="flex flex-wrap gap-2"><Button disabled={!q.data?.readyForTDCompletionReview||note.trim().length<30||mutation.isPending} onClick={()=>mutation.mutate("approved")}>Approve Practicals completion</Button>
    <Button variant="outline" disabled={note.trim().length<30||mutation.isPending} onClick={()=>mutation.mutate("remediation_required")}>Record remediation</Button></div>
   </>}
  </>}
 </CardContent></Card>;
}
