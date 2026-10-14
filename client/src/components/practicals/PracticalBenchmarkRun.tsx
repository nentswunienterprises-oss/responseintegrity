import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card,CardContent,CardHeader,CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import PracticalCaseWorkbench from "./PracticalCaseWorkbench";
import { PracticalRecordingRecoveryControls } from "./PracticalRecordingRecoveryControls";
import {
  PRACTICAL_BENCHMARK_CASE_COUNT,
  PRACTICAL_VIDEO_REQUIREMENTS,
  type PracticalBenchmarkProof,
} from "@shared/practicalBenchmarkPolicy";

type IssuedCase = {
  caseKey:string;caseVersion:number;sequence:number;phase:string;
  assessedCapability:string;title:string;situation:string;systemDirection:string;
  liveDemonstration:string;revealedAt:string;
  completedOperations:number;requiredOperations:number;
};
export type BenchmarkRun = {
  started:boolean;allowed?:boolean;reason?:string|null;completed:boolean;
  runId?:string;proofVersion?:number;bankVersion?:number;attemptNumber?:number;
  reference?:string;history?:IssuedCase[];currentCase?:IssuedCase|null;
  startedAt?:string;completedAt?:string;requiredCases?:number;
  recovery?:null|{requestId:string;decision:"approve_repeat"|"deny"|"integrity_review"|null;incidentNote:string};
};

export default function PracticalBenchmarkRun({
  assignmentId,proofKey,enabled,onComplete,onExecuteComplete,
}:{
  assignmentId:string;proofKey:PracticalBenchmarkProof;enabled:boolean;
  onComplete:(runId:string|null)=>void;
  onExecuteComplete:(challengeId:string|null)=>void;
}) {
  const {toast}=useToast(),queryClient=useQueryClient();
  const [preflight,setPreflight]=useState(false);
  const [recordingStarted,setRecordingStarted]=useState(false);
  const [privacyConfirmed,setPrivacyConfirmed]=useState(false);
  const [consentConfirmed,setConsentConfirmed]=useState(false);
  const key=["practical-common-benchmark",assignmentId,proofKey];
  const q=useQuery<BenchmarkRun>({
    queryKey:key,enabled:!!assignmentId&&enabled,
    queryFn:async()=> (await apiRequest("GET",
      `/api/tutor/capability-practicals/benchmark?tutorAssignmentId=${encodeURIComponent(assignmentId)}&proofKey=${proofKey}`)).json(),
  });
  const start=useMutation({
    mutationFn:async():Promise<BenchmarkRun>=> (await apiRequest("POST",
      "/api/tutor/capability-practicals/benchmark/start",{
        tutorAssignmentId:assignmentId,proofKey,
        preflightConfirmed:true,recordingStartedBeforeReveal:true,
        consentToRecording:true,privacyScopeConfirmed:true,
      })).json(),
    onSuccess:(result)=>queryClient.setQueryData(key,result),
    onError:(e:Error)=>toast({title:"Case assignment blocked",description:e.message,variant:"destructive"}),
  });
  const advance=useMutation({
    mutationFn:async(action:"next"|"finish"):Promise<BenchmarkRun>=>{
      if(!q.data?.runId)throw Error("No system-issued assessment is active.");
      return(await apiRequest("POST",
        `/api/tutor/capability-practicals/benchmark/${encodeURIComponent(q.data.runId)}/advance`,
        {tutorAssignmentId:assignmentId,proofKey,action})).json();
    },
    onSuccess:(result)=>queryClient.setQueryData(key,result),
    onError:(e:Error)=>toast({title:"Case cannot advance",description:e.message,variant:"destructive"}),
  });
  const completedId=q.data?.completed?q.data.runId||null:null;
  useEffect(()=>onComplete(completedId),[onComplete,completedId]);
  const current=q.data?.currentCase;
  const recordingHeld=Boolean(q.data?.recovery);
  const canAdvance=Boolean(!recordingHeld&&current&&!q.data?.completed&&
    current.requiredOperations>0&&current.completedOperations===current.requiredOperations);
  return <Card className="rounded-none">
    <CardHeader>
      <CardTitle>System-issued common cases</CardTitle>
      <p className="text-sm text-muted-foreground">
        Each Specialist faces the same {PRACTICAL_BENCHMARK_CASE_COUNT} versioned situations for {proofKey}.
        Record one uninterrupted screen + webcam + microphone video of all three. The case sequence cannot be selected, skipped or restarted.
      </p>
      <p className="text-sm font-medium">
        Preserve the complete video and actual issued case operations. Duration is measured for verification and calibration, not a fixed pass/fail window.
      </p>
    </CardHeader>
    <CardContent className="space-y-4">
      {q.isLoading&&<p className="text-sm">Loading assigned assessment...</p>}
      {q.isError&&<p role="alert" className="text-sm">Unable to load case: {String((q.error as Error).message)}</p>}
      {q.data&&!q.data.started&&q.data.allowed===false&&<p className="text-sm">{q.data.reason}</p>}
      {q.data&&!q.data.started&&q.data.allowed!==false&&<>
        <div className="space-y-2 rounded-md border p-3">
          <h3 className="font-semibold">Before case 1 is revealed</h3>
          <ul className="list-disc pl-5 text-sm space-y-1">
            {PRACTICAL_VIDEO_REQUIREMENTS.map(rule=><li key={rule}>{rule}</li>)}
          </ul>
          <p className="text-sm text-muted-foreground">
            Do not show household details or other people. A neutral background is acceptable.
            The TD evaluates session readiness, observability and actual use of tools, not the cost or appearance of the workspace.
          </p>
        </div>
        <label className="flex items-start gap-2 text-sm">
          <Checkbox checked={preflight} onCheckedChange={v=>setPreflight(v===true)}/>
          I have shown my working area, camera, microphone, visible work surface and required tools on the recording.
        </label>
        <label className="flex items-start gap-2 text-sm">
          <Checkbox checked={recordingStarted} onCheckedChange={v=>setRecordingStarted(v===true)}/>
          My continuous screen, face and microphone recording is ALREADY running. I have not seen the assessment case.
        </label>
        <label className="flex items-start gap-2 text-sm">
          <Checkbox checked={privacyConfirmed} onCheckedChange={v=>setPrivacyConfirmed(v===true)}/>
          Only fictional student material and essential setup are visible; no household members, private credentials or real student data.
        </label>
        <label className="flex items-start gap-2 text-sm">
          <Checkbox checked={consentConfirmed} onCheckedChange={v=>setConsentConfirmed(v===true)}/>
          I understand and consent to my screen, voice, face and professional conduct
          being recorded solely to assess the assigned Practicals cases. Only
          necessary exam material should be captured; I must provide the original
          recording privately to the assigned TD, not publish it.
        </label>
        <Button disabled={!preflight||!recordingStarted||!privacyConfirmed||!consentConfirmed||start.isPending}
          onClick={()=>start.mutate()}>
          {start.isPending?"Issuing...":"Reveal case 1 while recording"}
        </Button>
      </>}
      {q.data?.started&&<>
        <div className="rounded-md border bg-muted/20 p-3 space-y-1">
          <p className="font-medium">Attempt reference: {q.data.reference}</p>
          <p className="text-xs text-muted-foreground">Keep the reference, case prompts and your real-time execution visible in one continuous recording. Benchmark bank v{q.data.bankVersion}, attempt {q.data.attemptNumber}.</p>
          <Badge variant="outline">{q.data.completed?"All three completed":`${q.data.history?.length||0} of 3 cases revealed`}</Badge>
        </div>
        {(q.data.history||[]).map(item=><div className="space-y-2 rounded-lg border p-4" key={item.caseKey}>
          <div className="flex flex-wrap justify-between gap-2">
            <p className="font-semibold">Case {item.sequence}: {item.title}</p>
            <Badge variant="outline">{item.phase}</Badge>
          </div>
          <p className="text-xs text-muted-foreground">Comparable case ID: {item.caseKey}, version {item.caseVersion}. Issued {new Date(item.revealedAt).toLocaleTimeString("en-ZA")}.</p>
          <p className="text-sm"><strong>System state:</strong> {item.situation}</p>
          <p className="text-sm"><strong>System direction:</strong> {item.systemDirection}</p>
          <p className="text-sm"><strong>Demonstrate live:</strong> {item.liveDemonstration}</p>
          <p className="text-xs text-muted-foreground">Recorded operations: {item.completedOperations} of {item.requiredOperations}</p>
        </div>)}
        {q.data.runId&&!q.data.completed&&
          <PracticalRecordingRecoveryControls
            runId={q.data.runId} assignmentId={assignmentId} proofKey={proofKey}/>}
        {recordingHeld&&<p className="rounded-md border p-3 text-sm font-medium">
          Recording incident recorded. This assessment is held until the assigned TD
          makes a recovery decision. Do not continue with a broken original recording.
        </p>}
        {!recordingHeld&&current&&!q.data.completed&&q.data.runId&&
          <PracticalCaseWorkbench runId={q.data.runId} caseSequence={current.sequence}
            proofKey={proofKey} assignmentId={assignmentId} onExecuteComplete={onExecuteComplete}/>}
        {q.data.completed?<div className="rounded-lg border p-3">
          <p className="font-semibold">System benchmark complete</p>
          <p className="text-sm">Stop the continuous recording now and preserve the original, full-length file. Submit the private recording link, measured duration and declarations below. The TD will check it against all three issued cases.</p>
        </div>:<>
          <p className="text-sm text-muted-foreground">
            Complete your visible response to this case before advancing. The next case will be revealed only after you choose to proceed. Keep recording running.
          </p>
          <Button disabled={!canAdvance||advance.isPending}
            onClick={()=>advance.mutate(current!.sequence===3?"finish":"next")}>
            {advance.isPending?"Saving...":current!.sequence===3?"Finish assessment (keep recording until confirmed)":"Advance after recorded operations"}
          </Button>
        </>}
      </>}
    </CardContent>
  </Card>;
}
