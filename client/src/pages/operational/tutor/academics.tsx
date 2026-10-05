import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardLayout } from "@/components/layout/dashboard-layout";

// Grade Submission Form
const GradeSubmissionForm: React.FC = () => {
  const [grades, setGrades] = useState<{ subject: string; grade: string }[]>([]);
  const [quarter, setQuarter] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const handleGradeChange = (idx: number, field: "subject" | "grade", value: string) => {
    const updated = [...grades];
    updated[idx][field] = value;
    setGrades(updated);
  };
  const addGrade = () => setGrades([...grades, { subject: "", grade: "" }]);
  const removeGrade = (idx: number) => setGrades(grades.filter((_, i) => i !== idx));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccess("");
    setLoading(true);
    // Validation
    const validGrades = grades.filter(g => g.subject.trim() && g.grade.trim());
    if (!quarter) {
      setError("Quarter required");
      setLoading(false);
      return;
    }
    if (validGrades.length === 0) {
      setError("At least one grade required");
      setLoading(false);
      return;
    }
    // Submit
    try {
      const res = await fetch("/api/tutor/grades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quarter, grades: validGrades }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "Error submitting grades");
      } else {
        setSuccess("Grades submitted successfully");
        setGrades([]);
        setQuarter("");
      }
    } catch (err) {
      setError("Network error");
    }
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="font-medium">Quarter</label>
        <input
          type="text"
          value={quarter}
          onChange={e => setQuarter(e.target.value)}
          className="border rounded px-2 py-1 w-full"
          placeholder="e.g. Q1 2026"
        />
      </div>
      <div>
        <label className="font-medium">Grades</label>
        {grades.map((g, idx) => (
          <div key={idx} className="flex gap-2 mb-2">
            <input
              type="text"
              value={g.subject}
              onChange={e => handleGradeChange(idx, "subject", e.target.value)}
              className="border rounded px-2 py-1 flex-1"
              placeholder="Subject name"
            />
            <input
              type="text"
              value={g.grade}
              onChange={e => handleGradeChange(idx, "grade", e.target.value)}
              className="border rounded px-2 py-1 w-24"
              placeholder="Grade"
            />
            {grades.length > 1 && (
              <button type="button" onClick={() => removeGrade(idx)} className="text-red-600">Remove</button>
            )}
          </div>
        ))}
        <button type="button" onClick={addGrade} className="mt-2 text-blue-600">Add Grade</button>
      </div>
      {error && <div className="text-red-600">{error}</div>}
      {success && <div className="text-green-600">{success}</div>}
      <button type="submit" disabled={loading} className="bg-primary text-white px-4 py-2 rounded">
        {loading ? "Submitting..." : "Submit Grades"}
      </button>
    </form>
  );
};

export default function TutorGradeMonitoring() {
  return (
    <DashboardLayout>
      <div className="space-y-8">
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
            <CardTitle>Grade Submission (Specialist)</CardTitle>
          </CardHeader>
          <CardContent>
            <GradeSubmissionForm />
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

const SubjectDeclarationForm: React.FC = () => {
  const [subjects, setSubjects] = useState<string[]>([""]);
  const [academicYear, setAcademicYear] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [declaredSubjects, setDeclaredSubjects] = useState<string[]>([]);
  const [fetching, setFetching] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccess("");
    setLoading(true);
    // Validation
    const trimmed = subjects.map(s => s.trim()).filter(Boolean);
    if (!academicYear) {
      setError("Academic year required");
      setLoading(false);
      return;
    }
    if (trimmed.length === 0) {
      setError("At least one subject required");
      setLoading(false);
      return;
    }
    if (new Set(trimmed).size !== trimmed.length) {
      setError("Duplicate subject names");
      setLoading(false);
      return;
    }
    // Submit
    try {
      const res = await fetch("/api/tutor/subjects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subjects: trimmed, academicYear }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "Error submitting subjects");
      } else {
        setSuccess("Subjects declared and locked for academic year");
        setSubjects([""]);
        setAcademicYear("");
        fetchDeclaredSubjects();
      }
    } catch (err) {
      setError("Network error");
    }
    setLoading(false);
    // Fetch declared subjects
    const fetchDeclaredSubjects = async () => {
      setFetching(true);
      try {
        const res = await fetch("/api/tutor/subjects", {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        });
        const data = await res.json();
        if (res.ok && Array.isArray(data.subjects)) {
          setDeclaredSubjects(data.subjects);
        } else {
          setDeclaredSubjects([]);
        }
      } catch {
        setDeclaredSubjects([]);
      }
      setFetching(false);
    };

    React.useEffect(() => {
      fetchDeclaredSubjects();
    }, []);
  };

  const handleSubjectChange = (idx: number, value: string) => {
    const updated = [...subjects];
    updated[idx] = value;
    setSubjects(updated);
  };
  const addSubject = () => setSubjects([...subjects, ""]);
  const removeSubject = (idx: number) => setSubjects(subjects.filter((_, i) => i !== idx));

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="font-medium">Academic Year</label>
          <input
            type="text"
            value={academicYear}
            onChange={e => setAcademicYear(e.target.value)}
            className="border rounded px-2 py-1 w-full"
            placeholder="e.g. 2026"
          />
        </div>
        <div>
          <label className="font-medium">Subjects</label>
          {subjects.map((subject, idx) => (
            <div key={idx} className="flex gap-2 mb-2">
              <input
                type="text"
                value={subject}
                onChange={e => handleSubjectChange(idx, e.target.value)}
                className="border rounded px-2 py-1 flex-1"
                placeholder="Subject name"
              />
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
      <div className="mt-6">
        <h4 className="font-semibold mb-2">Declared Subjects</h4>
        {fetching ? (
          <div>Loading...</div>
        ) : declaredSubjects.length === 0 ? (
          <div className="text-gray-500">No subjects declared yet.</div>
        ) : (
          <ul className="list-disc pl-6">
            {declaredSubjects.map((subj, idx) => (
              <li key={idx}>{subj}</li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
