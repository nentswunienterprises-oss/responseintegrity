import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import {
  QUALIFICATION_STATUSES,
  PARENT_QUALIFICATION_SECTIONS,
  PARENT_EXPERIENCE_QUESTIONS,
  SUPPORT_PREFERENCE_QUESTIONS,
  RI_EXPLANATION_SCRIPT,
  type ParentQualificationAssessment,
  type ParentQualificationSection,
} from "@shared/demandProduction";

const words = (value: string) => value?.replaceAll("_", " ") || "Unset";
const when = (value: string) => value ? new Date(value).toLocaleString() : "Not recorded";
const control = "block w-full rounded border bg-background p-2 text-sm mt-1";
const sectionLabels: Record<ParentQualificationSection, string> = {
  parentExperience: "1. Parent Experience",
  supportPreferences: "2. Understanding Support Preferences",
  riExplanation: "3. Response Integrity Explanation",
  commercialReadiness: "4. Commercial Readiness",
};

export function DemandReview({ lineage, staff }: { lineage: any; staff: { id: string; name: string; role: string }[] }) {
  const e = lineage.enrollment;
  const [status, setStatus] = useState(e.qualification_status || "pending");
  const [owner, setOwner] = useState(e.qualification_owner_id || "");
  const [recipient, setRecipient] = useState("");
  const [note, setNote] = useState("");
  const [entry, setEntry] = useState("");
  const [transferConfirmed, setTransferConfirmed] = useState(false);
  const [assessment, setAssessment] = useState<ParentQualificationAssessment>(e.qualification_assessment || {});
  const [assessmentSaved, setAssessmentSaved] = useState(Boolean(e.qualification_assessment_updated_at));
  const cache = useQueryClient();
  const save = useMutation({
    mutationFn: async (command: object) => (await apiRequest("PATCH", `/api/hr/enrollments/${e.id}/demand`, command)).json(),
    onSuccess: async (_data, command: any) => {
      if (command.action !== "assessment") setNote("");
      if (command.action === "assessment") setAssessmentSaved(true);
      await Promise.all([
        cache.invalidateQueries({ queryKey: ["/api/coo/production-economy"] }),
        cache.invalidateQueries({ queryKey: ["/api/hr/enrollments"] }),
      ]);
    },
  });
  const setResponse = (section: ParentQualificationSection, questionId: string, value: string) => {
    setAssessmentSaved(false);
    setAssessment((current) => {
      const responses = { ...(current[section]?.responses || {}), [questionId]: value };
      const count = Object.values(responses).filter((answer) => answer.trim()).length;
      return { ...current, [section]: { ...current[section], responses, parentAccount: count ? `${count} individual question response(s) recorded.` : "" } };
    });
  };
  const setSectionField = (section: ParentQualificationSection, field: "interviewerObservation" | "followUp", value: string) => {
    setAssessmentSaved(false);
    setAssessment((current) => ({ ...current, [section]: { ...current[section], [field]: value } }));
  };
  const markScriptPresented = (presented: boolean) => {
    setAssessmentSaved(false);
    setAssessment((current) => ({ ...current, riExplanation: { ...current.riExplanation, scriptPresented: presented } }));
  };
  const sectionComplete = (section: ParentQualificationSection) => {
    const item = assessment[section];
    if (section === "parentExperience") return PARENT_EXPERIENCE_QUESTIONS.every((_, index) => Boolean(item?.responses?.[`experience_${index + 1}`]?.trim()));
    if (section === "supportPreferences") return SUPPORT_PREFERENCE_QUESTIONS.every((_, index) => Boolean(item?.responses?.[`support_${index + 1}`]?.trim()));
    if (section === "riExplanation") return Boolean(item?.scriptPresented && item?.responses?.ri_parent_response?.trim());
    return false; // Part 4 is intentionally unavailable until its approved interview guide is supplied.
  };
  const assessmentComplete = PARENT_QUALIFICATION_SECTIONS.every(sectionComplete);
  const terminalDecision = ["qualified", "not_qualified"].includes(status);
  const person = (id: string) => id ? staff.find((user) => user.id === id)?.name || id : "Unset";
  const sla = lineage.handoverSla;
  const slaLabel = sla.status === "breached" ? "Breached" : sla.status === "within_standard" ? "Within standard"
    : sla.status === "pending" ? "Within 24 hours - transfer pending" : "Not yet measurable";
  const legacy = e.demand_flow_version === 0;
  const responseValue = (section: ParentQualificationSection, id: string) => assessment[section]?.responses?.[id] || "";

  const renderQuestionSet = (section: ParentQualificationSection, questions: readonly string[], prefix: string) => (
    <div className="space-y-4">
      {questions.map((question, index) => {
        const id = `${prefix}_${index + 1}`;
        return <label key={id} className="block text-sm">
          <span className="font-medium">{index + 1}. {question}</span>
          <textarea className={control} rows={3} maxLength={3000} value={responseValue(section, id)}
            onChange={(event) => setResponse(section, id, event.target.value)}
            placeholder="Record the parent's answer. Preserve their meaning and wording." />
        </label>;
      })}
    </div>
  );

  return <div className="space-y-4 border rounded-lg p-4">
    <h3 className="font-semibold">{lineage.parentName || "Parent application"} · {e.student_full_name}</h3>
    <dl className="grid gap-3 sm:grid-cols-2 text-sm">
      {[
        ["Source", lineage.code ? `Production Link ${lineage.code} · ${lineage.source?.ownerName || "Owner unavailable"}` : "Organic"],
        ["Original source / campaign", `${lineage.originalSource || "Not recorded"} / ${lineage.originalCampaign || "Not recorded"}`],
        ["Qualification", legacy ? "Historical - unknown" : words(e.qualification_status)],
        ["Qualification owner", person(e.qualification_owner_id)],
        ["Contact recorded", when(e.qualification_contacted_at)],
        ["Decision", `${person(e.qualification_decided_by)} · ${when(e.qualification_completed_at)}`],
        ["Entry type", words(lineage.entryType)],
        ["Entry selected by", `${person(e.entry_selected_by)} · ${when(e.entry_selected_at)}`],
        ["Handover", e.handover_completed_at ? "Completed" : legacy ? "Historical - unknown" : "Pending"],
        ["Handover sender → recipient", `${person(e.handover_from_user_id)} → ${person(e.handover_to_user_id)}`],
        ["Responsibility transferred", when(e.handover_completed_at)],
        ["24-hour SLA", `${slaLabel}${sla.hours == null ? "" : ` (${sla.hours.toFixed(1)} hours)`}`],
        ["Downstream position", `${words(e.status)} · ${e.current_step || "No step recorded"}`],
        ["Specialist / assignment lane", `${e.assigned_tutor_id || "Unassigned"} / ${e.assigned_tutor_id ? words(e.assignment_lane) : "Not assigned"}`],
      ].map(([label, value]) => <div key={label}><dt className="text-muted-foreground">{label}</dt><dd className="break-words">{value}</dd></div>)}
    </dl>
    <details className="text-sm"><summary className="cursor-pointer">View submitted application</summary>
      <div className="mt-2 space-y-2"><p>{e.parent_phone} · {e.parent_email} · {e.parent_city}</p>
        <p>{e.student_full_name} · Grade {e.student_grade} · {e.school_name}</p>
        <p>Previous tutoring: {e.previous_tutoring}. Internet: {e.internet_access}.</p>
        <p className="whitespace-pre-wrap">{e.parent_motivation || "No additional context"}</p>
        <p>Topics: {Object.keys(e.topic_response_symptoms || {}).join(", ") || "Not recorded"}</p>
      </div>
    </details>
    {e.qualification_note && <p className="text-sm whitespace-pre-wrap">Decision context: {e.qualification_note}</p>}
    {e.qualification_assessment && <details className="rounded-md border p-3 text-sm"><summary className="cursor-pointer font-medium">View saved qualification evidence</summary>
      <div className="mt-3 space-y-4">{PARENT_QUALIFICATION_SECTIONS.map((section) => {
        const item = e.qualification_assessment[section] || {};
        return <section key={section}><h4 className="font-semibold">{sectionLabels[section]}</h4>
          {section === "parentExperience" && PARENT_EXPERIENCE_QUESTIONS.map((question, index) => <p key={index} className="mt-2 whitespace-pre-wrap"><strong>{index + 1}. {question}</strong><br />{item.responses?.[`experience_${index + 1}`] || "Not recorded"}</p>)}
          {section === "supportPreferences" && SUPPORT_PREFERENCE_QUESTIONS.map((question, index) => <p key={index} className="mt-2 whitespace-pre-wrap"><strong>{index + 1}. {question}</strong><br />{item.responses?.[`support_${index + 1}`] || "Not recorded"}</p>)}
          {section === "riExplanation" && <><p className="mt-2">Approved RI explanation presented: {item.scriptPresented ? "Yes" : "Not recorded"}</p><p className="whitespace-pre-wrap">Parent response: {item.responses?.ri_parent_response || "Not recorded"}</p></>}
          {item.interviewerObservation && <p className="mt-2 whitespace-pre-wrap"><strong>Interviewer observation:</strong> {item.interviewerObservation}</p>}
          {item.followUp && <p className="mt-2 whitespace-pre-wrap"><strong>Follow-up:</strong> {item.followUp}</p>}
          {section === "commercialReadiness" && <p className="mt-2 text-muted-foreground">Part 4 evidence: {item.parentAccount || item.evidence || item.interviewerObservation || "Not yet recorded."}</p>}
        </section>;
      })}</div>
    </details>}
    {e.handover_note && <p className="text-sm whitespace-pre-wrap">Agreed next action: {e.handover_note}</p>}
    {legacy && <p className="text-sm text-muted-foreground">Existing service remains operational. Historical qualification and handover are not inferred.</p>}
    {!legacy && !e.qualification_completed_at && <section className="border-t pt-4 space-y-4">
      <div><h4 className="font-semibold">Parent Qualification — approved interview guide</h4><p className="text-sm text-muted-foreground">Ask the approved questions and record each answer individually. Keep the parent's account separate from interviewer observations. Save partial progress during the conversation. Part 4 remains pending until its approved questions are supplied.</p></div>
      <fieldset className="rounded-md border p-3 space-y-4">
        <legend className="px-1 text-sm font-semibold">1. Parent Experience · {sectionComplete("parentExperience") ? "Complete" : "In progress"}</legend>
        {renderQuestionSet("parentExperience", PARENT_EXPERIENCE_QUESTIONS, "experience")}
        <label className="block text-sm">Interviewer observation<textarea className={control} rows={2} maxLength={3000} value={assessment.parentExperience?.interviewerObservation || ""} onChange={(event) => setSectionField("parentExperience", "interviewerObservation", event.target.value)} /></label>
        <label className="block text-sm">Follow-up required<textarea className={control} rows={2} maxLength={1000} value={assessment.parentExperience?.followUp || ""} onChange={(event) => setSectionField("parentExperience", "followUp", event.target.value)} /></label>
      </fieldset>
      <fieldset className="rounded-md border p-3 space-y-4">
        <legend className="px-1 text-sm font-semibold">2. Understanding Support Preferences · {sectionComplete("supportPreferences") ? "Complete" : "In progress"}</legend>
        {renderQuestionSet("supportPreferences", SUPPORT_PREFERENCE_QUESTIONS, "support")}
        <label className="block text-sm">Interviewer observation<textarea className={control} rows={2} maxLength={3000} value={assessment.supportPreferences?.interviewerObservation || ""} onChange={(event) => setSectionField("supportPreferences", "interviewerObservation", event.target.value)} /></label>
        <label className="block text-sm">Follow-up required<textarea className={control} rows={2} maxLength={1000} value={assessment.supportPreferences?.followUp || ""} onChange={(event) => setSectionField("supportPreferences", "followUp", event.target.value)} /></label>
      </fieldset>
      <fieldset className="rounded-md border p-3 space-y-4">
        <legend className="px-1 text-sm font-semibold">3. Response Integrity Explanation · {sectionComplete("riExplanation") ? "Complete" : "In progress"}</legend>
        <p className="text-sm text-muted-foreground">Present this explanation as written. Do not paraphrase or replace it with a generic description.</p>
        <div className="rounded-md bg-muted/40 p-4 text-sm leading-relaxed whitespace-pre-wrap">{RI_EXPLANATION_SCRIPT}</div>
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={Boolean(assessment.riExplanation?.scriptPresented)} onChange={(event) => markScriptPresented(event.target.checked)} />I presented the approved explanation to the parent.</label>
        <label className="block text-sm">Parent's response / questions after the explanation<textarea className={control} rows={4} maxLength={3000} value={responseValue("riExplanation", "ri_parent_response")} onChange={(event) => setResponse("riExplanation", "ri_parent_response", event.target.value)} placeholder="Record the parent's reaction, understanding, questions, or concerns." /></label>
        <label className="block text-sm">Interviewer observation<textarea className={control} rows={2} maxLength={3000} value={assessment.riExplanation?.interviewerObservation || ""} onChange={(event) => setSectionField("riExplanation", "interviewerObservation", event.target.value)} /></label>
        <label className="block text-sm">Follow-up required<textarea className={control} rows={2} maxLength={1000} value={assessment.riExplanation?.followUp || ""} onChange={(event) => setSectionField("riExplanation", "followUp", event.target.value)} /></label>
      </fieldset>
      <fieldset className="rounded-md border border-dashed p-3 space-y-2">
        <legend className="px-1 text-sm font-semibold">4. Commercial Readiness · Pending approval</legend>
        <p className="text-sm text-muted-foreground">The approved Part 4 questions have not yet been provided. This section is intentionally not editable. Qualification cannot be finalized until the approved Part 4 is implemented.</p>
      </fieldset>
      <div className="flex flex-wrap items-center gap-3"><Button type="button" disabled={save.isPending} onClick={() => save.mutate({ action: "assessment", assessment })}>Save assessment</Button><span className="text-xs text-muted-foreground">{[sectionComplete("parentExperience"), sectionComplete("supportPreferences"), sectionComplete("riExplanation")].filter(Boolean).length} of 3 supplied parts complete · Part 4 pending · {!assessmentSaved ? "Unsaved changes" : e.qualification_assessment_updated_at ? `Last saved ${when(e.qualification_assessment_updated_at)}` : "Not yet saved"}</span></div>
    </section>}
    {save.error && <p role="alert" className="text-sm text-destructive">{save.error.message}</p>}
    {!legacy && !e.handover_completed_at && <div className="border-t pt-4 space-y-4">
      {!e.qualification_completed_at && <form className="space-y-3" onSubmit={(event) => {
        event.preventDefault(); save.mutate({ action: "qualification", status, ...(owner ? { ownerId: owner } : {}), note });
      }}>
        <label className="block text-sm">Qualification status<select className={control} value={status} onChange={(event) => setStatus(event.target.value)}>{QUALIFICATION_STATUSES.map((value) => <option key={value} value={value}>{words(value)}</option>)}</select></label>
        <label className="block text-sm">Responsible owner<select className={control} value={owner} onChange={(event) => setOwner(event.target.value)}><option value="">Choose owner</option>{staff.map((user) => <option key={user.id} value={user.id}>{user.name} ({user.role})</option>)}</select></label>
        <label className="block text-sm">Decision note / follow-up context<textarea className={control} maxLength={2000} value={note} onChange={(event) => setNote(event.target.value)} required={terminalDecision} /></label>
        <Button disabled={save.isPending || (terminalDecision && (!assessmentComplete || !assessmentSaved))}>Save qualification</Button>
        {terminalDecision && (!assessmentComplete || !assessmentSaved) && <p className="text-xs text-muted-foreground">Complete and save all four approved sections before recording a terminal decision. Part 4 is currently pending.</p>}
      </form>}
      {e.qualification_status === "qualified" && !e.entry_selected_at && <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); save.mutate({ action: "entry", entryType: entry }); }}>
        <label className="block text-sm">Service entry arrangement<select required className={control} value={entry} onChange={(event) => setEntry(event.target.value)}><option value="">Choose entry type</option><option value="pilot">Pilot - approved free access</option><option value="commercial">Commercial - paid monthly package</option></select></label>
        <Button disabled={save.isPending || !entry}>Confirm entry type</Button>
      </form>}
      {e.entry_selected_at && <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); save.mutate({ action: "handover", ownerId: recipient, note }); }}>
        <p className="text-sm text-muted-foreground">The 24-hour standard runs from completed qualification to transfer of responsibility.</p>
        <label className="block text-sm">Receiving owner<select required className={control} value={recipient} onChange={(event) => setRecipient(event.target.value)}><option value="">Choose recipient</option>{staff.map((user) => <option key={user.id} value={user.id}>{user.name} ({user.role})</option>)}</select></label>
        <label className="block text-sm">Agreed next action<textarea required className={control} maxLength={2000} value={note} onChange={(event) => setNote(event.target.value)} /></label>
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={transferConfirmed} onChange={(event) => setTransferConfirmed(event.target.checked)} />I confirm the receiving owner has accepted responsibility and the next action.</label>
        <Button disabled={save.isPending || !transferConfirmed || !recipient || !note.trim()}>Complete handover</Button>
      </form>}
    </div>}
  </div>;
}
