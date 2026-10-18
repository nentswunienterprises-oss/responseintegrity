import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";

type Fixture = {
  studentId: string; topic: string; phase: string; stability: string;
  restoredCanonicalState: boolean; session: { id: string };
};

export default function NativeHandoverProofSetup() {
  const [studentId, setStudentId] = useState("b093523e-6227-4ebb-9894-b3be775dfcf3");
  const [fixture, setFixture] = useState<Fixture | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const environment = useQuery({
    queryKey: ["native-handover-proof-environment"],
    queryFn: async () => {
      const response = await fetch("/api/proof-environment", { cache: "no-store" });
      if (!response.ok) throw new Error("Controlled Preview is unavailable.");
      return response.json();
    },
    retry: false,
  });
  const allowed = environment.data?.vercelEnv === "preview" &&
    environment.data?.supabaseProjectRef === "jftlxeacphvbnhbsbpxc";
  async function prepare() {
    if (!allowed || saving || fixture) return;
    setSaving(true); setError("");
    try {
      const response = await apiRequest("POST", "/api/proof/handover-fixture/reset", {
        studentId,
        topic: "Fractions", restoreCanonicalState: false,
      });
      const result: Fixture = await response.json();
      if (result.restoredCanonicalState || !result.session?.id) {
        throw new Error("Unexpected fixture receipt. Preserve the result for review.");
      }
      setFixture(result);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Preparation failed.");
    } finally { setSaving(false); }
  }
  const runner = fixture ? `/specialist/intro-session/${fixture.studentId}?${new URLSearchParams({
    mode: "handover", topic: fixture.topic, phase: fixture.phase,
    stability: fixture.stability, scheduledSessionId: fixture.session.id,
  })}` : null;
  return <main className="mx-auto max-w-2xl space-y-5 p-8">
    <h1 className="text-2xl font-semibold">Controlled native Handover setup</h1>
    <p>Preview acceptance for Sandbox Student 1, Fractions. Select the fixture owned by the signed-in Specialist. Create a current Handover assignment and confirmed booking through the existing Proof workflow. Prior observations and topic state are preserved.</p>
    {environment.isLoading ? <p>Checking Preview...</p> : !allowed ? <p role="alert">Unavailable outside the controlled Capability Proof Preview.</p> : <>
      <label className="block space-y-2">Sandbox fixture
        <select aria-label="Sandbox fixture" className="block rounded-md border bg-background p-2" value={studentId} disabled={saving || !!fixture} onChange={event => setStudentId(event.target.value)}>
          <option value="b093523e-6227-4ebb-9894-b3be775dfcf3">Isolated acceptance Student 1</option>
          <option value="828a5609-462c-4772-841a-0590ceb6a84e">Historical acceptance Student 1</option>
        </select>
      </label>
      <Button disabled={saving || !!fixture} onClick={prepare}>{saving ? "Preparing..." : fixture ? "Handover prepared" : "Prepare synthetic Handover"}</Button>
      {fixture && runner ? <div className="space-y-3">
        <p>Current Handover prepared. Inherited state: {fixture.phase}, {fixture.stability}. No evaluation or qualification evidence has been created by setup.</p>
        <Button asChild><Link to={runner}>Open native Handover</Link></Button>
      </div> : null}
    </>}
    {error ? <p role="alert">{error}</p> : null}
  </main>;
}
