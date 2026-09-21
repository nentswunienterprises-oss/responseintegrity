import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { QUALIFICATION_STATUSES } from "@shared/demandProduction";

const words = (value: string) => value?.replaceAll("_", " ") || "Unset";
const when = (value: string) => value ? new Date(value).toLocaleString() : "Not recorded";
const control = "block w-full rounded border bg-background p-2 text-sm mt-1";

export function DemandReview({ lineage, staff }: { lineage: any; staff: { id: string; name: string; role: string }[] }) {
  const e = lineage.enrollment;
  const [status, setStatus] = useState(e.qualification_status || "pending");
  const [owner, setOwner] = useState(e.qualification_owner_id || "");
  const [recipient, setRecipient] = useState("");
  const [note, setNote] = useState("");
  const [entry, setEntry] = useState("");
  const [transferConfirmed, setTransferConfirmed] = useState(false);
  const cache = useQueryClient();
  const save = useMutation({
    mutationFn: async (command: object) => (await apiRequest("PATCH", `/api/hr/enrollments/${e.id}/demand`, command)).json(),
    onSuccess: async () => {
      setNote("");
      await Promise.all([
        cache.invalidateQueries({ queryKey: ["/api/coo/production-economy"] }),
        cache.invalidateQueries({ queryKey: ["/api/hr/enrollments"] }),
      ]);
    },
  });
  const person = (id: string) => id ? staff.find((user) => user.id === id)?.name || id : "Unset";
  const sla = lineage.handoverSla;
  const slaLabel = sla.status === "breached" ? "Breached" : sla.status === "within_standard" ? "Within standard"
    : sla.status === "pending" ? "Within 24 hours — transfer pending" : "Not yet measurable";
  const legacy = e.demand_flow_version === 0;

  return <div className="space-y-4 border rounded-lg p-4">
    <h3 className="font-semibold">{lineage.parentName || "Parent application"} · {e.student_full_name}</h3>
    <dl className="grid gap-3 sm:grid-cols-2 text-sm">
      {[
        ["Source", lineage.code ? `Production Link ${lineage.code} · ${lineage.source?.ownerName || "Owner unavailable"}` : "Organic"],
        ["Original source / campaign", `${lineage.originalSource || "Not recorded"} / ${lineage.originalCampaign || "Not recorded"}`],
        ["Qualification", legacy ? "Historical — unknown" : words(e.qualification_status)],
        ["Qualification owner", person(e.qualification_owner_id)],
        ["Contact recorded", when(e.qualification_contacted_at)],
        ["Decision", `${person(e.qualification_decided_by)} · ${when(e.qualification_completed_at)}`],
        ["Entry type", words(lineage.entryType)],
        ["Entry selected by", `${person(e.entry_selected_by)} · ${when(e.entry_selected_at)}`],
        ["Handover", e.handover_completed_at ? "Completed" : legacy ? "Historical — unknown" : "Pending"],
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
    {e.handover_note && <p className="text-sm whitespace-pre-wrap">Agreed next action: {e.handover_note}</p>}
    {legacy && <p className="text-sm text-muted-foreground">Existing service remains operational. Historical qualification and handover are not inferred.</p>}
    {save.error && <p role="alert" className="text-sm text-destructive">{save.error.message}</p>}
    {!legacy && !e.handover_completed_at && <div className="border-t pt-4 space-y-4">
      {!e.qualification_completed_at && <form className="space-y-3" onSubmit={(event) => {
        event.preventDefault(); save.mutate({ action: "qualification", status, ...(owner ? { ownerId: owner } : {}), note });
      }}>
        <label className="block text-sm">Qualification status<select className={control} value={status} onChange={(event) => setStatus(event.target.value)}>{QUALIFICATION_STATUSES.map((value) => <option key={value} value={value}>{words(value)}</option>)}</select></label>
        <label className="block text-sm">Responsible owner<select className={control} value={owner} onChange={(event) => setOwner(event.target.value)}><option value="">Choose owner</option>{staff.map((user) => <option key={user.id} value={user.id}>{user.name} ({user.role})</option>)}</select></label>
        <label className="block text-sm">Decision note / follow-up context<textarea className={control} maxLength={2000} value={note} onChange={(event) => setNote(event.target.value)} required={["qualified", "not_qualified"].includes(status)} /></label>
        <Button disabled={save.isPending}>Save qualification</Button>
      </form>}
      {e.qualification_status === "qualified" && !e.entry_selected_at && <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); save.mutate({ action: "entry", entryType: entry }); }}>
        <label className="block text-sm">Service entry arrangement<select required className={control} value={entry} onChange={(event) => setEntry(event.target.value)}><option value="">Choose entry type</option><option value="pilot">Pilot — approved free access</option><option value="commercial">Commercial — paid monthly package</option></select></label>
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
