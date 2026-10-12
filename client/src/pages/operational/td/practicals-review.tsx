import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { AlertCircle, ArrowLeft, CheckCircle2, ExternalLink, RefreshCcw, ShieldAlert } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import type { ExecuteResponse } from "@shared/practicalExecuteChallenge";
import {
  validateCaseReviews,
  validatePracticalVideoVerification,
  type PracticalCaseReview,
  type PracticalVideoVerification,
} from "@shared/practicalBenchmarkPolicy";
import { apiRequest } from "@/lib/queryClient";
import PracticalRecordingRecoveryQueue from "@/components/practicals/PracticalRecordingRecoveryQueue";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  deriveCapabilityPracticalReview,
  type CapabilityPracticalCriterionJudgment,
  type CapabilityPracticalCriterionReviewInput,
  type CapabilityPracticalReviewRubric,
} from "@shared/capabilityPracticalEvidence";

type ReviewQueueItem = {
  evidenceId: string;
  tutorAssignmentId: string;
  tutorId: string;
  specialistName: string;
  podName: string | null;
  proofKey: "prepare" | "execute" | "evidence";
  proofVersion: number;
  rubricVersion: number;
  reviewRubric: CapabilityPracticalReviewRubric;
  attemptNumber: number;
  artifactUrl: string;
  artifactType: "screen_voice" | "screen_video" | "video";
  declaration: Record<string, string>;
  recordingDurationSeconds:number;
  benchmark:{
    reference:string;bankVersion:number;proofVersion:number;attemptNumber:number;
    startedAt:string;completedAt:string|null;completed:boolean;
    history:Array<{caseKey:string;caseVersion:number;sequence:number;phase:string;title:string;
      assessedCapability:string;situation:string;systemDirection:string;liveDemonstration:string;revealedAt:string;
      completedOperations:number;requiredOperations:number;
      operationHistory:Array<{stepNumber:number;operationKey:string;recordedPayload:Record<string,unknown>;
        systemSnapshot:{label:string;prompt:string;kind:string};recordedAt:string;riskFlags:string[]}>;}>;
  }|null;
  executeChallenge: {challengeId:string;completed:boolean;version:number;privateBankLineage?:{bankKey:string;bankVersion:number}|null;history:Array<{number:number;recordedAt?:string|null;situation:{kind:string;studentBehavior:string;evidenceQuestion:string};response:ExecuteResponse;riskFlags?:string[]}>} | null;
  submittedAt: string;
};

type CriterionDraft = {
  judgment: CapabilityPracticalCriterionJudgment | "";
  evidenceNote: string;
};

function proofTitle(key: ReviewQueueItem["proofKey"]) {
  if (key === "prepare") return "Practical 1 - Prepare";
  if (key === "execute") return "Practical 2 - Execute";
  return "Practical 3 - Evidence";
}

function declarationLabel(key: string) {
  return key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replaceAll("_", " ")
    .replace(/^./, (value) => value.toUpperCase());
}

function linkHost(url: string) {
  try {
    return new URL(url).hostname;
  } catch {
    return "external recording";
  }
}

function emptyCriterionDrafts(rubric: CapabilityPracticalReviewRubric): Record<string, CriterionDraft> {
  return Object.fromEntries(
    rubric.criteria.map((criterion) => [criterion.key, { judgment: "", evidenceNote: "" }]),
  );
}

function outcomePresentation(outcome: "approved" | "repeat_required" | "integrity_review") {
  if (outcome === "approved") {
    return {
      title: "Approved",
      detail: "Every rubric criterion is explicitly Clear.",
      Icon: CheckCircle2,
    };
  }
  if (outcome === "integrity_review") {
    return {
      title: "Integrity review",
      detail: "At least one integrity-critical criterion is explicitly Fail.",
      Icon: ShieldAlert,
    };
  }
  return {
    title: "Repeat required",
    detail: "At least one criterion is Partial or Fail and no integrity-critical failure is present.",
    Icon: RefreshCcw,
  };
}

export default function CapabilityPracticalReview() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, isLoading: authLoading } = useAuth();
  const role = String(user?.role || "").toLowerCase();
  const authorized = role === "td";
  const [selectedEvidenceId, setSelectedEvidenceId] = useState<string | null>(null);
  const [criterionDrafts, setCriterionDrafts] = useState<Record<string, CriterionDraft>>({});
  const [feedback, setFeedback] = useState("");
  const [traceMatched,setTraceMatched]=useState(false);
  const [caseDrafts,setCaseDrafts]=useState<Record<string,{judgment:""|"clear"|"partial"|"fail";observedEvidence:string;videoTraceMatched:boolean}>>({});
  const [durationMinutes,setDurationMinutes]=useState("");
  const [durationSeconds,setDurationSeconds]=useState("0");
  const [videoChecks,setVideoChecks]=useState({
    recordingContinuous:false,recordingBeginsBeforeReveal:false,
    allThreeCasesVisible:false,environmentAndToolsVisible:false,
    specialistScreenFaceVoiceObservable:false,
      recordingConsentVerified:false,recordingAccessRestricted:false,
      noRealStudentDataOrBystanders:false,
    flaggedCutOrManipulation:false,flaggedTechnicalInterruption:false,
  });

  const queueQuery = useQuery<{ queue: ReviewQueueItem[] }>({
    queryKey: ["capability-practical-review-queue"],
    enabled: Boolean(!authLoading && authorized),
    retry: false,
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/capability-review/practicals/pending");
      return (await response.json()) as { queue: ReviewQueueItem[] };
    },
  });

  const selected = useMemo(
    () => queueQuery.data?.queue.find((item) => item.evidenceId === selectedEvidenceId) || null,
    [queueQuery.data?.queue, selectedEvidenceId],
  );

  const clearDecision = () => {
    setCriterionDrafts({});
    setFeedback("");
    setTraceMatched(false);
    setCaseDrafts({});
    setDurationMinutes("");
    setDurationSeconds("0");
    setVideoChecks({
      recordingContinuous:false,recordingBeginsBeforeReveal:false,
      allThreeCasesVisible:false,environmentAndToolsVisible:false,
      specialistScreenFaceVoiceObservable:false,
      recordingConsentVerified:false,recordingAccessRestricted:false,
      noRealStudentDataOrBystanders:false,
      flaggedCutOrManipulation:false,flaggedTechnicalInterruption:false,
    });
  };

  const openEvidence = (item: ReviewQueueItem) => {
    setSelectedEvidenceId(item.evidenceId);
    setCriterionDrafts(emptyCriterionDrafts(item.reviewRubric));
    setFeedback("");
    setTraceMatched(false);
    setCaseDrafts(Object.fromEntries((item.benchmark?.history||[]).map(c=>[c.caseKey,{judgment:"",observedEvidence:"",videoTraceMatched:false}])));
    setDurationMinutes("");
    setDurationSeconds("0");
    setVideoChecks({
      recordingContinuous:false,recordingBeginsBeforeReveal:false,
      allThreeCasesVisible:false,environmentAndToolsVisible:false,
      specialistScreenFaceVoiceObservable:false,
      recordingConsentVerified:false,recordingAccessRestricted:false,
      noRealStudentDataOrBystanders:false,
      flaggedCutOrManipulation:false,flaggedTechnicalInterruption:false,
    });
  };

  const criterionJudgments = useMemo<CapabilityPracticalCriterionReviewInput[]>(() => {
    if (!selected) return [];
    return selected.reviewRubric.criteria.flatMap((criterion) => {
      const draft = criterionDrafts[criterion.key];
      if (!draft?.judgment) return [];
      return [{
        criterionKey: criterion.key,
        judgment: draft.judgment,
        evidenceNote: draft.evidenceNote.trim() || null,
      }];
    });
  }, [criterionDrafts, selected]);

  const allJudged = Boolean(
    selected && selected.reviewRubric.criteria.every((criterion) => criterionDrafts[criterion.key]?.judgment),
  );
  const notesValid = Boolean(
    selected && selected.reviewRubric.criteria.every((criterion) => {
      const draft = criterionDrafts[criterion.key];
      if (!draft?.judgment || draft.judgment === "clear") return true;
      return draft.evidenceNote.trim().length >= 20;
    }),
  );

  const derivedPreview = useMemo(() => {
    if (!selected || !allJudged || !notesValid) return null;
    try {
      return deriveCapabilityPracticalReview(selected.reviewRubric, criterionJudgments);
    } catch {
      return null;
    }
  }, [allJudged, criterionJudgments, notesValid, selected]);

  const caseKeys=selected?.benchmark?.history.map(c=>c.caseKey)||[];
  const benchmarkCaseReviews:PracticalCaseReview[]=caseKeys.flatMap(caseKey=>{
    const draft=caseDrafts[caseKey];
    return draft?.judgment?[{caseKey,judgment:draft.judgment,observedEvidence:draft.observedEvidence.trim(),videoTraceMatched:draft.videoTraceMatched}]:[];
  });
  const caseReviewsValid=selected?.benchmark?.completed===true &&
    validateCaseReviews(caseKeys,benchmarkCaseReviews).length===0;
  const observedSeconds=Number(durationMinutes)*60+Number(durationSeconds);
  const videoTimeValid=durationMinutes.trim()!==""&&durationSeconds.trim()!==""&&
    Number.isInteger(Number(durationMinutes))&&Number(durationMinutes)>=0&&
    Number.isInteger(Number(durationSeconds))&&Number(durationSeconds)>=0&&Number(durationSeconds)<60;
  const videoVerification:PracticalVideoVerification={...videoChecks,observedDurationSeconds:observedSeconds};
  const videoProblems=selected&&videoTimeValid
    ?validatePracticalVideoVerification(selected.proofKey,videoVerification)
    :["Confirm actual full-length video duration."];
  const videoMatchesDeclaration=selected&&Math.abs(observedSeconds-selected.recordingDurationSeconds)<=10;
  const videoCanApprove=videoProblems.length===0&&videoMatchesDeclaration===true;
  const remediationSummaryRequired = derivedPreview !== null && derivedPreview.outcome !== "approved";
  const feedbackValid = !remediationSummaryRequired || feedback.trim().length >= 20;

  const reviewMutation = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error("Select practical evidence first.");
      if (!allJudged) throw new Error("Judge every rubric criterion before submitting the review.");
      if (!notesValid) throw new Error("Every Partial or Fail judgment needs at least 20 characters of observed evidence.");
      if (!derivedPreview) throw new Error("The rubric result could not be derived from the current judgments.");
      if(!caseReviewsValid)throw new Error("Review every issued benchmark case and cite its directly observable video evidence.");
      if(!videoTimeValid)throw new Error("Enter the actual full video duration as observed by the TD.");
      if(derivedPreview.outcome==="approved" &&
        (!videoCanApprove||benchmarkCaseReviews.some(c=>c.judgment!=="clear"||!c.videoTraceMatched)))
        throw new Error("Approval requires all three cases Clear, intact continuous video, no interruptions, demonstrated setup and matching duration. Mark a failed criterion when the evidence does not support approval.");
      if(videoChecks.flaggedCutOrManipulation && derivedPreview.outcome!=="integrity_review")
        throw new Error("Suspected cuts or manipulation require an integrity-critical Fail, not an ordinary repeat.");
      if (selected.proofKey==="execute" && !traceMatched) throw new Error("Verify the server trace, challenge reference and demonstration recording before review.");
      if (selected.proofKey==="execute" && (!selected.executeChallenge?.completed || selected.executeChallenge.history.length!==3)) throw new Error("A complete three-turn Execute trace is required.");
      if (derivedPreview.outcome !== "approved" && feedback.trim().length < 20) {
        throw new Error("Repeat required and integrity review outcomes need at least 20 characters of actionable reviewer feedback.");
      }

      const response = await apiRequest(
        "POST",
        `/api/capability-review/practicals/${encodeURIComponent(selected.evidenceId)}/review`,
        {
          rubricVersion: selected.rubricVersion,
          criterionJudgments,
          feedback: feedback.trim() || null,
          executeTraceVideoVerified:selected.proofKey==="execute" && traceMatched,
          benchmarkCaseReviews,
          videoVerification,
        },
      );
      return response.json();
    },
    onSuccess: async () => {
      setSelectedEvidenceId(null);
      clearDecision();
      await queryClient.invalidateQueries({ queryKey: ["capability-practical-review-queue"] });
    },
  });

  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">Loading review access...</div>;
  }

  if (!authorized) {
    return (
      <div className="min-h-screen bg-background px-4 py-12">
        <div className="mx-auto max-w-xl space-y-5">
          <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>Only the assigned TD may review Specialist Practicals.</AlertDescription></Alert>
          <Button variant="outline" onClick={() => navigate("/")}><ArrowLeft className="mr-2 h-4 w-4" />Return</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto max-w-6xl space-y-7">
        <div>
          <Button variant="ghost" className="-ml-3 mb-3" onClick={() => navigate(-1)}><ArrowLeft className="mr-2 h-4 w-4" />Back</Button>
          <p className="text-sm font-medium text-muted-foreground">Specialist Development</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">Practicals review queue</h1>
          <p className="mt-2 max-w-3xl text-muted-foreground">
            Compare the permanent, system-assigned Execute transcript with the recording. Judge observable execution against the frozen rubric; the system derives the outcome.
          </p>
        </div>

        <PracticalRecordingRecoveryQueue />

        {queueQuery.error && (
          <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>Practical evidence queue could not be loaded.</AlertDescription></Alert>
        )}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,0.72fr)_minmax(0,1.28fr)]">
          <Card>
            <CardHeader>
              <CardTitle>Pending review ({queueQuery.data?.queue.length || 0})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {queueQuery.isLoading && <p className="text-sm text-muted-foreground">Loading evidence...</p>}
              {!queueQuery.isLoading && (queueQuery.data?.queue.length || 0) === 0 && (
                <p className="text-sm text-muted-foreground">No practical evidence is waiting for your review.</p>
              )}
              {(queueQuery.data?.queue || []).map((item) => (
                <button
                  key={item.evidenceId}
                  type="button"
                  onClick={() => openEvidence(item)}
                  className={`w-full rounded-lg border p-4 text-left transition ${selectedEvidenceId === item.evidenceId ? "border-primary bg-primary/5" : "hover:bg-muted/40"}`}
                >
                  <p className="font-semibold">{item.specialistName || "Specialist"}</p>
                  <p className="mt-1 text-sm">{proofTitle(item.proofKey)} - attempt {item.attemptNumber}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{item.podName || "No pod label"} - rubric v{item.rubricVersion}</p>
                </button>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{selected ? proofTitle(selected.proofKey) : "Select evidence"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {!selected ? (
                <p className="text-sm text-muted-foreground">Choose a pending submission to inspect the demonstration and declaration.</p>
              ) : (
                <>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Specialist</p><p className="font-medium">{selected.specialistName || "Specialist"}</p></div>
                    <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Attempt</p><p className="font-medium">{selected.attemptNumber}</p></div>
                    <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Frozen rubric</p><p className="font-medium">v{selected.rubricVersion}</p></div>
                  </div>

                  <Alert>
                    <ExternalLink className="h-4 w-4" />
                    <AlertDescription>
                      Recording is hosted externally at <span className="font-medium">{linkHost(selected.artifactUrl)}</span>. Verify that it shows only the sandbox scenario before relying on it.
                    </AlertDescription>
                  </Alert>

                  <Button asChild variant="outline">
                    <a href={selected.artifactUrl} target="_blank" rel="noopener noreferrer">
                      Open practical recording <ExternalLink className="ml-2 h-4 w-4" />
                    </a>
                  </Button>

                  <div className="space-y-3">
                    <h2 className="font-semibold">Specialist declaration</h2>
                    {Object.entries(selected.declaration || {}).map(([key, value]) => (
                      <div key={key} className="rounded-lg border p-4">
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{declarationLabel(key)}</p>
                        <p className="mt-2 text-sm leading-relaxed">{String(value)}</p>
                      </div>
                    ))}
                  </div>

                  {selected.proofKey === "execute" ? (
                    <div className="space-y-3 border-t pt-5">
                      <h2 className="font-semibold">System-assigned responsive Execute record</h2>
                      <p className="text-sm font-medium">Recording reference must show: {selected.executeChallenge?.challengeId?.slice(0,8).toUpperCase()}</p>
                      {selected.executeChallenge?.privateBankLineage?<p className="text-xs text-muted-foreground">Source: controlled Sandbox environment, bank v{selected.executeChallenge.privateBankLineage.bankVersion}. Only visible student behaviour is included in this review; answer truth remains private.</p>:null}
                      <p className="text-sm text-muted-foreground">
                        These turns were revealed sequentially. Confirm that the recording and the saved Specialist interventions, observations and decisions agree. The Specialist cannot rewrite previously saved turns.
                      </p>
                      {!selected.executeChallenge?.completed || selected.executeChallenge.history.length !== 3 ? (
                        <Alert variant="destructive"><AlertCircle className="h-4 w-4"/><AlertDescription>Execute's required three-turn trace is missing. This submission cannot pass.</AlertDescription></Alert>
                      ) : selected.executeChallenge.history.map(turn => (
                        <div key={turn.number} className="space-y-2 rounded-md border p-4 text-sm">
                          <p className="font-semibold">Turn {turn.number}: {turn.situation.kind.replaceAll("_", " ")}</p>
                          {turn.recordedAt?<p className="text-xs text-muted-foreground">Recorded at {new Date(turn.recordedAt).toLocaleString("en-ZA")}</p>:null}
                          <p><span className="font-medium">Simulated student:</span> {turn.situation.studentBehavior}</p>
                          <p><span className="font-medium">Specialist said:</span> {turn.response.studentFacingResponse}</p>
                          <p><span className="font-medium">Intervention:</span> {turn.response.intervention.replaceAll("_", " ")}</p>
                          <p><span className="font-medium">Observed:</span> {turn.response.observedBehavior}</p>
                          <p><span className="font-medium">Evidence:</span> {turn.response.evidenceStatus} / {turn.response.independenceClaim}</p>
                          <p><span className="font-medium">Next action:</span> {turn.response.nextAction.replaceAll("_"," ")} — {turn.response.decisionReason}</p>
                          {(turn.riskFlags || []).length > 0 ? (
                            <Alert variant="destructive"><ShieldAlert className="h-4 w-4"/><AlertDescription>
                              Verify in the recording: {(turn.riskFlags || []).join(", ").replaceAll("_"," ")}. Objective integrity contradictions cannot be cleared by averaging good criteria.
                            </AlertDescription></Alert>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : null}

                  <div className="space-y-4 border-t pt-5">
                    <h2 className="font-semibold">Shared benchmark: case-by-case comparison</h2>
                    <p className="text-sm text-muted-foreground">
                      These same frozen cases and versions are issued to every Specialist. Judge the observed response to each exact case, not a general impression of the recording.
                    </p>
                    {!selected.benchmark?.completed||selected.benchmark.history.length!==3?
                      <Alert variant="destructive"><AlertCircle className="h-4 w-4"/>
                        <AlertDescription>The full three-case system assignment is missing. Do not approve.</AlertDescription>
                      </Alert>:
                      selected.benchmark.history.map(item=>{
                        const draft=caseDrafts[item.caseKey]||{judgment:"" as const,observedEvidence:"",videoTraceMatched:false};
                        return <div className="space-y-3 rounded-lg border p-4" key={item.caseKey}>
                          <p className="font-semibold">Case {item.sequence} — {item.title}</p>
                          <p className="text-xs text-muted-foreground">{item.caseKey} · Bank v{item.caseVersion} · {item.phase} · {item.assessedCapability}</p>
                          <p className="text-sm"><strong>Issued condition:</strong> {item.situation}</p>
                          <p className="text-sm"><strong>System boundary:</strong> {item.systemDirection}</p>
                          <p className="text-sm"><strong>Expected demonstration:</strong> {item.liveDemonstration}</p>
                          {item.examinerStandard&&<div className="rounded-md border p-3 space-y-1 text-sm">
                            <p className="font-semibold">TD-only case standard</p>
                            <p>{item.examinerStandard.coreJudgment}</p>
                            <p className="text-xs text-muted-foreground">{item.examinerStandard.evidenceRule}</p>
                            <p className="text-xs text-muted-foreground">Critical failures: {(item.examinerStandard.criticalFail||[]).join("; ")}</p>
                          </div>}
                          <div className="rounded-md border bg-muted/10 p-3 space-y-2">
                            <p className="text-sm font-medium">Durable RI-OS action trail: {item.completedOperations}/{item.requiredOperations}</p>
                            {item.operationHistory.map(e=><div key={e.stepNumber} className="rounded border p-2 text-xs space-y-1">
                              <p className="font-semibold">Operation {e.stepNumber}: {e.systemSnapshot.label} · {new Date(e.recordedAt).toLocaleTimeString("en-ZA")}</p>
                              <p><strong>Action:</strong> {e.operationKey.replaceAll("_"," ")}</p>
                              <pre className="whitespace-pre-wrap break-words">{JSON.stringify(e.recordedPayload,null,2)}</pre>
                              {e.riskFlags?.length>0&&<p className="text-destructive">Review: {e.riskFlags.join(", ").replaceAll("_"," ")}</p>}
                            </div>)}
                            {item.completedOperations!==item.requiredOperations&&
                              <p role="alert" className="text-destructive">Incomplete executable case. TD approval is prohibited.</p>}
                          </div>
                          <div className="flex gap-2 flex-wrap">{(["clear","partial","fail"] as const).map(judgment=>
                            <Button type="button" key={judgment} variant={draft.judgment===judgment?"default":"outline"}
                              onClick={()=>setCaseDrafts(p=>({...p,[item.caseKey]:{
                                judgment,observedEvidence:p[item.caseKey]?.observedEvidence||"",videoTraceMatched:p[item.caseKey]?.videoTraceMatched||false,
                              }}))}>
                              {judgment==="clear"?"Clear":judgment==="partial"?"Partial":"Fail"}
                            </Button>)}</div>
                          <label className="block space-y-1 text-sm">
                            <span className="font-medium">What does the video actually show? (30+ characters, required in every case)</span>
                            <textarea rows={3} maxLength={2000}
                              className="w-full rounded-md border bg-background p-2"
                              placeholder="Describe the visible or audible conduct, tools and decisions for this exact case."
                              value={draft.observedEvidence}
                              onChange={event=>setCaseDrafts(p=>({...p,[item.caseKey]:{
                                judgment:p[item.caseKey]?.judgment||"",observedEvidence:event.target.value,videoTraceMatched:p[item.caseKey]?.videoTraceMatched||false,
                              }}))}/>
                          </label>
                          <label className="flex items-start gap-2 text-sm">
                            <input type="checkbox" checked={draft.videoTraceMatched}
                              onChange={e=>setCaseDrafts(prev=>({...prev,[item.caseKey]:{
                                judgment:prev[item.caseKey]?.judgment||"",
                                observedEvidence:prev[item.caseKey]?.observedEvidence||"",
                                videoTraceMatched:e.target.checked,
                              }}))}/>
                            I independently matched this case's persisted workflow actions,
                            intervention/evidence entries and timestamps to the original,
                            uninterrupted video interval.
                          </label>
                        </div>;
                      })
                    }
                  </div>
                  <div className="space-y-3 border-t pt-5">
                    <h2 className="font-semibold">Original recording integrity and delivery setup</h2>
                    <p className="text-sm">TD must inspect the complete original-length video, including preparation before the first case reveal. Judge functional working conditions and needed tools, not the Specialist's home, décor or wealth.</p>
                    <p className="text-xs text-muted-foreground">Specialist declared {selected.recordingDurationSeconds}s. Match the entire video to issued case actions and timestamps. Duration is for calibration, not a fixed pass/fail threshold.</p>
                    <div className="flex flex-wrap gap-3">
                      <label className="block text-sm">Observed minutes<input type="number" min="0" value={durationMinutes} onChange={e=>setDurationMinutes(e.target.value)} className="mt-1 block w-32 rounded-md border bg-background p-2"/></label>
                      <label className="block text-sm">Observed seconds<input type="number" min="0" max="59" value={durationSeconds} onChange={e=>setDurationSeconds(e.target.value)} className="mt-1 block w-32 rounded-md border bg-background p-2"/></label>
                    </div>
                    {([
                      ["recordingContinuous","No edits, cuts, pauses, splices or missing intervals were observed."],
                      ["recordingBeginsBeforeReveal","Recording visibly began before the first case appeared."],
                      ["allThreeCasesVisible","All three issued case references and responses are visible."],
                      ["environmentAndToolsVisible","Actual functional delivery environment, tools, work surface, camera and microphone are observable."],
                      ["specialistScreenFaceVoiceObservable","Screen, Specialist conduct/face and voice are sufficiently observable to assess."],
                      ["recordingConsentVerified","The original recording had explicit Specialist consent before the first case was revealed."],
                      ["recordingAccessRestricted","I confirmed private access to this original recording, restricted to the assigned TD and authorised evidence review; it is not publicly shared."],
                      ["noRealStudentDataOrBystanders","I verified no real student records, family members or unrelated private spaces appear in the recording."],
                      ["flaggedCutOrManipulation","Red flag: suspected edit, missing footage, cut or manipulated recording."],
                      ["flaggedTechnicalInterruption","Red flag: technical interruption obscured required evidence."],
                    ] as [keyof typeof videoChecks,string][]).map(([key,label])=>
                      <label key={key} className="flex items-start gap-2 text-sm">
                        <input type="checkbox" checked={videoChecks[key]} onChange={e=>setVideoChecks(p=>({...p,[key]:e.target.checked}))}/>
                        {label}
                      </label>)}
                    {!videoTimeValid||!videoCanApprove?
                      <p className="text-sm text-destructive">
                        This recording is not yet verified for approval. An interruption requires documented repeat/evidence recovery; suspected manipulation requires integrity review.
                      </p>:<p className="text-sm">Recording duration, continuity and setup checks are verified.</p>}
                  </div>
                  <div className="space-y-4 border-t pt-5">
                    <div>
                      <h2 className="font-semibold">Observable rubric</h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Every criterion must be judged explicitly. Partial and Fail require an observation note. No criterion defaults to Clear.
                      </p>
                    </div>

                    {selected.reviewRubric.criteria.map((criterion, index) => {
                      const draft = criterionDrafts[criterion.key] || { judgment: "", evidenceNote: "" };
                      const requiresNote = draft.judgment === "partial" || draft.judgment === "fail";
                      return (
                        <div key={criterion.key} className="rounded-xl border p-4 space-y-4">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Criterion {index + 1}</p>
                              <h3 className="mt-1 font-semibold">{criterion.label}</h3>
                            </div>
                            {criterion.criticalOnFail ? (
                              <Badge variant="destructive">Integrity-critical if Fail</Badge>
                            ) : (
                              <Badge variant="outline">Capability criterion</Badge>
                            )}
                          </div>

                          <p className="text-sm leading-relaxed">{criterion.observableStandard}</p>

                          <div className="grid gap-2 text-xs md:grid-cols-3">
                            <div className="rounded-lg border p-3"><span className="font-semibold">Clear:</span> {criterion.clearAnchor}</div>
                            <div className="rounded-lg border p-3"><span className="font-semibold">Partial:</span> {criterion.partialAnchor}</div>
                            <div className="rounded-lg border p-3"><span className="font-semibold">Fail:</span> {criterion.failAnchor}</div>
                          </div>

                          <div className="grid gap-2 sm:grid-cols-3">
                            {(["clear", "partial", "fail"] as CapabilityPracticalCriterionJudgment[]).map((judgment) => (
                              <Button
                                key={judgment}
                                type="button"
                                variant={draft.judgment === judgment ? (judgment === "fail" && criterion.criticalOnFail ? "destructive" : "default") : "outline"}
                                onClick={() => setCriterionDrafts((current) => ({
                                  ...current,
                                  [criterion.key]: {
                                    judgment,
                                    evidenceNote: current[criterion.key]?.evidenceNote || "",
                                  },
                                }))}
                              >
                                {judgment === "clear" ? "Clear" : judgment === "partial" ? "Partial" : "Fail"}
                              </Button>
                            ))}
                          </div>

                          {requiresNote ? (
                            <label className="block space-y-2">
                              <span className="text-sm font-medium">Observed evidence for {draft.judgment}</span>
                              <textarea
                                value={draft.evidenceNote}
                                onChange={(event) => setCriterionDrafts((current) => ({
                                  ...current,
                                  [criterion.key]: {
                                    judgment: current[criterion.key]?.judgment || "",
                                    evidenceNote: event.target.value,
                                  },
                                }))}
                                rows={3}
                                maxLength={2000}
                                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                                placeholder="Name the exact behavior in the recording that supports this judgment."
                              />
                              <p className="text-xs text-muted-foreground">Minimum 20 characters for Partial or Fail.</p>
                            </label>
                          ) : null}
                        </div>
                      );
                    })}

                    {derivedPreview ? (() => {
                      const presentation = outcomePresentation(derivedPreview.outcome);
                      const OutcomeIcon = presentation.Icon;
                      return (
                        <Alert variant={derivedPreview.outcome === "integrity_review" ? "destructive" : "default"}>
                          <OutcomeIcon className="h-4 w-4" />
                          <AlertDescription>
                            <span className="font-semibold">Derived outcome: {presentation.title}.</span> {presentation.detail} Clear {derivedPreview.clearCount}, Partial {derivedPreview.partialCount}, Fail {derivedPreview.failCount}.
                          </AlertDescription>
                        </Alert>
                      );
                    })() : (
                      <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          Complete every criterion and document every Partial/Fail before an outcome can be derived.
                        </AlertDescription>
                      </Alert>
                    )}

                    {selected.proofKey==="execute"?<label className="flex items-start gap-2 rounded-md border p-3 text-sm">
                      <input type="checkbox" checked={traceMatched} onChange={event=>setTraceMatched(event.target.checked)}/>
                      <span>I inspected all three saved turns and confirmed that this exact challenge reference and the Specialist's actual actions match the demonstration recording.</span>
                    </label>:null}
                    <label className="block space-y-2">
                      <span className="text-sm font-medium">
                        Reviewer summary {remediationSummaryRequired ? "(required for this outcome)" : "(optional for Approved)"}
                      </span>
                      <textarea
                        value={feedback}
                        onChange={(event) => setFeedback(event.target.value)}
                        rows={4}
                        maxLength={4000}
                        className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                        placeholder={remediationSummaryRequired
                          ? "Tell the Specialist what must change before the next attempt or what integrity issue must be resolved."
                          : "Optional synthesis. Criterion-level evidence remains the authoritative basis for the derived outcome."}
                      />
                      {remediationSummaryRequired ? (
                        <span className="text-xs text-muted-foreground">Minimum 20 characters so the next action is explicit.</span>
                      ) : null}
                    </label>

                    {reviewMutation.error && (
                      <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{reviewMutation.error instanceof Error ? reviewMutation.error.message : "Review failed."}</AlertDescription></Alert>
                    )}

                    <Button
                      disabled={reviewMutation.isPending || !derivedPreview || !feedbackValid ||
                        !caseReviewsValid || !videoTimeValid ||
                        (derivedPreview.outcome==="approved"&&!videoCanApprove) ||
                        (selected.proofKey==="execute" && !traceMatched)}
                      onClick={() => reviewMutation.mutate()}
                    >
                      {reviewMutation.isPending ? "Recording rubric..." : "Record immutable rubric review"}
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}