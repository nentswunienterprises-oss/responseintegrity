import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";

const students = [
  { id: "657994af-a9c4-a7ae-dd13-54cdd462f2ab", label: "QA 02" },
  { id: "f94d1bbe-76ae-11d5-34ee-2990fe4d0aa5", label: "QA 09" },
  { id: "a8ce613e-7f91-48d1-5097-2e34923dbacf", label: "QA 10" },
];
type Receipt = { studentId: string; session: { id: string }; reused: boolean; restoredCanonicalState: boolean };
export default function NativeTrainingProofSetup() {
  const [saving, setSaving] = useState(false);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [error, setError] = useState("");
  const environment = useQuery({
    queryKey: ["native-training-proof-environment"],
    queryFn: async () => {
      const response = await fetch("/api/proof-environment", { cache: "no-store" });
      if (!response.ok) throw new Error("Controlled Preview is unavailable.");
      return response.json();
    }, retry: false,
  });
  const allowed = environment.data?.vercelEnv === "preview" &&
    environment.data?.supabaseProjectRef === "jftlxeacphvbnhbsbpxc";
  async function book(studentId: string) {
    if (!allowed || saving) return;
    setSaving(true); setError(""); setReceipt(null);
    try {
      const response = await apiRequest("POST", "/api/proof/training-booking", { studentId });
      const result: Receipt = await response.json();
      if (result.restoredCanonicalState || !result.session?.id) throw new Error("Unexpected booking receipt.");
      setReceipt(result);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Booking failed."); }
    finally { setSaving(false); }
  }
  return <main className="mx-auto max-w-2xl space-y-5 p-8">
    <h1 className="text-2xl font-semibold">Controlled native Training bookings</h1>
    <p>Create or reuse one confirmed synthetic booking. Continue through Sessions and the Map; current Diagnosis, Handover and preparation requirements still apply. Setup preserves topic state, history and qualification evidence.</p>
    {environment.isLoading ? <p>Checking Preview...</p> : !allowed ? <p role="alert">Unavailable outside the controlled Capability Proof Preview.</p> :
      <div className="flex flex-wrap gap-3">{students.map(student =>
        <Button key={student.id} disabled={saving} onClick={() => book(student.id)}>Prepare {student.label} booking</Button>)}</div>}
    {receipt ? <div role="status" className="space-y-3">
      <p>{receipt.reused ? "Existing booking reused" : "Booking created"}: {receipt.session.id}.</p>
      <Button asChild><Link to="/specialist/sessions">Open native Sessions</Link></Button>
    </div> : null}
    {error ? <p role="alert">{error}</p> : null}
  </main>;
}
