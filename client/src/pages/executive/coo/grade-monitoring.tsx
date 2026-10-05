import { useState } from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

// Grade Monitoring & Academic Compliance System
// UI Structure Plan (Best Practices)
//
// Tutor Side:
// - Subject Declaration Page (one-time, locked after submission)
// - Quarterly Submission Page (locked subjects, grade for each, overall average, report image upload)
// - Status Banner (compliance status, next due date, restrictions)
// - Submission History (table of past submissions, statuses, COO feedback)
//
// COO Side:
// - Dashboard (list of tutors, sortable by average, compliance status, risk flags)
// - Grade Verification Page (previous/current averages, subject breakdown, % change, uploaded report, approve/reject)
// - Audit Log Viewer (filterable by entity, action, actor, date)
// - Academic Review Panel (suspended tutors, history, trends, action options)
//
// General UI:
// - All actions require confirmation and reason
// - No silent changes, all visible in audit log
// - Clear, unemotional, metric-based notifications
function SubjectDeclarationForm() {
  const [subjects, setSubjects] = useState<string[]>([""]);
  const [academicYear, setAcademicYear] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubjectChange = (idx: number, value: string) => {
    const updated = [...subjects];
    updated[idx] = value;
    setSubjects(updated);
  };
  const addSubject = () => setSubjects([...subjects, ""]);
  const removeSubject = (idx: number) => setSubjects(subjects.filter((_, i) => i !== idx));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);
    const trimmed = subjects.map(s => s.trim()).filter(Boolean);
    if (!academicYear) { setError("Academic year required"); setLoading(false); return; }
    if (trimmed.length === 0) { setError("At least one subject required"); setLoading(false); return; }
    if (new Set(trimmed).size !== trimmed.length) { setError("Duplicate subject names"); setLoading(false); return; }
    try {
      const res = await fetch("/api/tutor/subjects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subjects: trimmed, academicYear }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message || "Error submitting subjects"); }
      else { setSuccess("Subjects declared and locked for academic year"); setSubjects([""]); setAcademicYear(""); }
    } catch { setError("Network error"); }
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="font-medium">Academic Year</label>
        <input type="text" value={academicYear} onChange={e => setAcademicYear(e.target.value)}
          className="border rounded px-2 py-1 w-full" placeholder="e.g. 2026" />
      </div>
      <div>
        <label className="font-medium">Subjects</label>
        {subjects.map((subject, idx) => (
          <div key={idx} className="flex gap-2 mb-2">
            <input type="text" value={subject} onChange={e => handleSubjectChange(idx, e.target.value)}
              className="border rounded px-2 py-1 flex-1" placeholder="Subject name" />
            {subjects.length > 1 && (
              <button type="button" onClick={() => removeSubject(idx)} className="text-red-600">Remove</button>
            )}
          </div>
        ))}
        <button type="button" onClick={addSubject} className="mt-2 text-blue-600">Add Subject</button>
      </div>
      {error && <div className="text-red-600">{error}</div>}
      {success && <div className="text-green-600">{success}</div>}
      <button type="submit" disabled={loading} className="bg-primary text-white px-4 py-2 rounded">
        {loading ? "Submitting..." : "Declare Subjects"}
      </button>
    </form>
  );
}

export default function GradeMonitoring() {
  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Audit Log Viewer UI (stub) */}
        <Card className="border-2">
          <CardHeader>
            <CardTitle>Audit Log Viewer (COO)</CardTitle>
          </CardHeader>
          <CardContent>
            <p>COO can view all actions, changes, and compliance events. Filterable by entity, action, actor, and date.</p>
            {/* TODO: Implement audit log table and filters */}
          </CardContent>
        </Card>
        <Card className="border-2">
          <CardHeader>
            <CardTitle>Grade Verification (COO)</CardTitle>
          </CardHeader>
          <CardContent>
            <p>COO reviews submitted grades, checks report image, verifies subject alignment, and approves or rejects with reason. Compliance engine runs after approval.</p>
            {/* TODO: Implement verification table, approve/reject actions, compliance checks, and audit log display */}
          </CardContent>
        </Card>
        <Card className="border-2">
          <CardHeader>
            <CardTitle>Quarterly Grade Submission (Specialist)</CardTitle>
          </CardHeader>
          <CardContent>
            <p>At the start of each quarter, the Specialist must submit the overall average, each subject percentage and the official school report. All fields are required.</p>
            {/* TODO: Implement grade input, validation, report upload, and submission logic */}
          </CardContent>
        </Card>
        <Card className="border-2">
          <CardHeader>
            <CardTitle>Subject Declaration (Specialist)</CardTitle>
          </CardHeader>
          <CardContent>
            <SubjectDeclarationForm />
          </CardContent>
        </Card>
        <Card className="border-2">
          <CardHeader>
            <CardTitle>Grade Monitoring & Academic Compliance System</CardTitle>
          </CardHeader>
          <CardContent>
            <p>This page will implement the full compliance engine for Specialist grade submissions, subject locking, COO verification, automated checks, and academic review.</p>
            {/* TODO: Implement full system logic and UI */}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
