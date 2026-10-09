import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

type Proof = {key:string;version:number;title:string;purpose:string;mustShow:string[];requiredArtifactTypes:string[];declarationPrompts:Array<{key:string;prompt:string;minLength:number}>;reviewRubric:{version:number;criteria:Array<{key:string;label:string;observableStandard:string;clearAnchor:string;partialAnchor:string;failAnchor:string}>}};
type Evidence = {proofKey:string;attemptNumber:number;status:string;feedback:string|null};
type Data = {entry:{ready:boolean;blockers:string[]};completion:{complete:boolean;proofs:Array<{key:string;status:string}>};proofs:Proof[];evidence:Evidence[]};
type Pod = {assignment?:{id?:string}};

export default function SpecialistPracticals() {
  const navigate=useNavigate();
  const {toast}=useToast();
  const queryClient=useQueryClient();
  const [selected,setSelected]=useState<string>("prepare");
  const [url,setUrl]=useState("");
  const [artifactType,setArtifactType]=useState("screen_voice");
  const [declarations,setDeclarations]=useState<Record<string,string>>({});
  const [onlySandbox,setOnlySandbox]=useState(false);
  const pod=useQuery<Pod>({queryKey:["/api/tutor/pod"]});
  const assignmentId=pod.data?.assignment?.id || "";
  const q=useQuery<Data>({
    queryKey:["/api/tutor/capability-practicals",assignmentId],
    enabled:!!assignmentId,
    queryFn:async()=> (await apiRequest("GET", "/api/tutor/capability-practicals?tutorAssignmentId="+encodeURIComponent(assignmentId))).json(),
  });
  const proof=q.data?.proofs.find(p=>p.key===selected);
  const status=q.data?.completion?.proofs.find(p=>p.key===selected)?.status || "not_submitted";
  const history=q.data?.evidence.filter(e=>e.proofKey===selected)||[];
  const submit=useMutation({
    mutationFn:async()=>{
      if(!proof) throw new Error("Select a practical.");
      return (await apiRequest("POST","/api/tutor/capability-practicals/"+proof.key,{
        tutorAssignmentId:assignmentId,proofVersion:proof.version,artifactUrl:url,artifactType,
        declaration:declarations,noRealStudentDataConfirmed:onlySandbox,
      })).json();
    },
    onSuccess:async()=>{toast({title:"Practical submitted for TD review"});setUrl("");setDeclarations({});setOnlySandbox(false);await queryClient.invalidateQueries({queryKey:["/api/tutor/capability-practicals",assignmentId]});},
    onError:(error:Error)=>toast({title:"Submission blocked",description:error.message,variant:"destructive"}),
  });
  const canSubmit=!!proof && q.data?.entry.ready && (status==="not_submitted"||status==="repeat_required")
    && proof.requiredArtifactTypes.includes(artifactType)&&url.startsWith("https://")&&onlySandbox
    && proof.declarationPrompts.every(p=>(declarations[p.key]||"").trim().length>=p.minLength);
  return <div className="mx-auto max-w-5xl space-y-5 p-4 md:p-8">
    <Button variant="ghost" onClick={()=>navigate("/specialist/pod")}>Back to Pod</Button>
    <div><h1 className="text-2xl font-semibold">Practicals</h1><p className="text-sm text-muted-foreground">Demonstrate operational execution with simulated student evidence. Your TD reviews observable conduct against fixed standards.</p></div>
    {q.isLoading?<p>Loading Practicals...</p>:q.isError?<p role="alert">Practicals could not load: {String((q.error as Error)?.message||"unknown error")}</p>:<>
    {!q.data?.entry.ready && <Card><CardContent className="space-y-2 pt-5"><strong>Practicals not available yet</strong>{q.data?.entry.blockers.map((b,i)=><p key={i} className="text-sm">{b}</p>)}</CardContent></Card>}
    <div className="grid gap-3 md:grid-cols-3">{q.data?.proofs.map(p=><button key={p.key} type="button" onClick={()=>{setSelected(p.key);setUrl("");setDeclarations({});setArtifactType(p.requiredArtifactTypes[0]);setOnlySandbox(false)}} className={"rounded-md border p-4 text-left "+(selected===p.key?"border-primary":"")}>
      <p className="font-semibold">{p.title}</p><p className="mt-1 text-xs text-muted-foreground">{p.purpose}</p><Badge variant="outline" className="mt-3">{q.data?.completion?.proofs.find(x=>x.key===p.key)?.status||"Not submitted"}</Badge>
    </button>)}</div>
    {proof&&<Card><CardHeader><CardTitle>{proof.title}</CardTitle><p className="text-sm">{proof.purpose}</p></CardHeader><CardContent className="space-y-5">
      <div><h2 className="font-medium">Your demonstration must show</h2><ul className="list-disc pl-5 text-sm space-y-1">{proof.mustShow.map((t,i)=><li key={i}>{t}</li>)}</ul></div>
      <div className="space-y-3"><h2 className="font-medium">What your TD will observe</h2>{proof.reviewRubric.criteria.map(c=><div key={c.key} className="border-b pb-2 text-sm"><p className="font-medium">{c.label}</p><p>{c.observableStandard}</p><p className="text-muted-foreground">Clear: {c.clearAnchor}</p><p className="text-muted-foreground">Partial: {c.partialAnchor}</p><p className="text-muted-foreground">Fail: {c.failAnchor}</p></div>)}</div>
      {history.length>0&&<div><h2 className="font-medium">Previous attempts</h2>{history.map((h,i)=><p key={i} className="text-sm">Attempt {h.attemptNumber}: {h.status}{h.feedback?" — "+h.feedback:""}</p>)}</div>}
      {(status==="not_submitted"||status==="repeat_required")&&<div className="space-y-3"><h2 className="font-medium">Submit your demonstration</h2>
        <label className="block text-sm">Recording type<select className="mt-1 w-full rounded-md border bg-background p-2" value={artifactType} onChange={e=>setArtifactType(e.target.value)}>{proof.requiredArtifactTypes.map(t=><option key={t} value={t}>{t.replaceAll("_"," + ")}</option>)}</select></label>
        <label className="block text-sm">HTTPS recording link<Input value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://..." /></label>
        <p className="text-xs text-muted-foreground">Do not include real student or family information, credentials or private tokens. Ensure your assigned TD can access the recording.</p>
        {proof.declarationPrompts.map(p=><label className="block text-sm" key={p.key}>{p.prompt}<Textarea className="mt-1" value={declarations[p.key]||""} onChange={e=>setDeclarations(x=>({...x,[p.key]:e.target.value}))}/><span className="text-xs text-muted-foreground">Minimum {p.minLength} characters</span></label>)}
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={onlySandbox} onChange={e=>setOnlySandbox(e.target.checked)}/>I confirm this recording uses only simulated data.</label>
        <Button disabled={!canSubmit||submit.isPending} onClick={()=>submit.mutate()}>{submit.isPending?"Submitting...":"Submit for TD review"}</Button>
      </div>}
    </CardContent></Card>}
    <p className="text-sm text-muted-foreground">Practicals approval is not a certification or permission to take live families. Trial is a separate governed stage.</p>
    </>}
  </div>;
}
