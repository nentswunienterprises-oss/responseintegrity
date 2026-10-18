import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";

const publishedStudents = [
  { id: "657994af-a9c4-a7ae-dd13-54cdd462f2ab", label: "QA 02" },
  { id: "f94d1bbe-76ae-11d5-34ee-2990fe4d0aa5", label: "QA 09" },
  { id: "a8ce613e-7f91-48d1-5097-2e34923dbacf", label: "QA 10" },
  { id: "b093523e-6227-4ebb-9894-b3be775dfcf3", label: "Isolated 1" },
  { id: "38118d0f-a812-4936-b069-91c3d2eec209", label: "Isolated 2" },
  { id: "0ed81956-c61c-42af-a9a5-09ebda094935", label: "Isolated 3" },
  { id: "263c1256-2131-4a76-a0ad-5404dd25ed99", label: "Isolated 4" },
  { id: "e86d6442-44dc-4fcf-8d38-e327d54ea8c0", label: "Isolated 5" },
  { id: "483bf620-251b-4db3-a2eb-88ee85d2c858", label: "Isolated 6" },
];
type Receipt = { studentId: string; session: { id: string }; reused: boolean; restoredCanonicalState: boolean };
type CoverageReceipt = {createdAccounts:number;studentCount:number;students:Array<{id:string;label:string}>};
export default function NativeTrainingProofSetup() {
  const [saving, setSaving] = useState(false);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [error, setError] = useState("");
  const [coverage, setCoverage] = useState<CoverageReceipt | null>(null);
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
  async function ensureCoverage() {
    if (!allowed || saving) return;
    setSaving(true);setError("");setReceipt(null);
    try {
      const response=await apiRequest("POST","/api/proof/sandbox-profile-coverage",{});
      setCoverage(await response.json());
    } catch(cause) {setError(cause instanceof Error?cause.message:"Coverage setup failed.");}
    finally {setSaving(false);}
  }
  const students=coverage?.students?.length?coverage.students:publishedStudents;
  return <main className="mx-auto max-w-2xl space-y-5 p-8">
    <h1 className="text-2xl font-semibold">Controlled native Training bookings</h1>
    <p>Create or reuse one confirmed synthetic booking. Continue through Sessions and the Map; current Diagnosis, Handover and preparation requirements still apply. Setup preserves topic state, history and qualification evidence.</p>
    {environment.isLoading ? <p>Checking Preview...</p> : !allowed ? <p role="alert">Unavailable outside the controlled Capability Proof Preview.</p> :
      <div className="space-y-3">
        <Button variant="outline" disabled={saving} onClick={ensureCoverage}>Ensure isolated profile coverage</Button>
        <div className="flex flex-wrap gap-3">{students.map(student =>
          <Button key={student.id} disabled={saving} onClick={() => book(student.id)}>Prepare {student.label} booking</Button>)}</div>
      </div>}
    {coverage ? <p role="status">Profile coverage fixtures ready: {coverage.studentCount} students ({coverage.createdAccounts} newly created).</p> : null}
    {receipt ? <div role="status" className="space-y-3">
      <p>{receipt.reused ? "Existing booking reused" : "Booking created"}: {receipt.session.id}.</p>
      <Button asChild><Link to="/specialist/sessions">Open native Sessions</Link></Button>
    </div> : null}
    {error ? <p role="alert">{error}</p> : null}
  </main>;
}
