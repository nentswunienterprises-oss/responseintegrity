import React from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ResponseIntegrityLogo } from "@/components/ResponseIntegrityLogo";
import { useEffect, useState, useRef } from "react";
import { useToast } from "@/hooks/use-toast";

export default function EarlyInterventionReferralProgram() {
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' }); }, []);

  const [showForm, setShowForm] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({ school: '', contactName: '', contactRole: '', phone: '', email: '' });
  const [errors, setErrors] = useState<{[k:string]:string}>({});

  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const formRef = useRef<HTMLDivElement | null>(null);
  const firstInputRef = useRef<HTMLInputElement | null>(null);
  const submittedRef = useRef<HTMLDivElement | null>(null);

  function handleOpenForm() {
    setShowForm(true);
    // If the form is already rendered, scroll and focus immediately
    if (formRef.current) {
      formRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      firstInputRef.current?.focus();
    }
  }

  function handleHeaderClick() {
    if (submitted) {
      // Scroll to submitted confirmation
      if (submittedRef.current) {
        submittedRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    } else {
      handleOpenForm();
    }
  }

  useEffect(() => {
    if (showForm && !submitted && formRef.current) {
      formRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      firstInputRef.current?.focus();
    }
  }, [showForm, submitted]);

  // Responsive header logo width (larger on desktop, smaller on phones)
  const [logoWidth, setLogoWidth] = useState(() => {
    if (typeof window === 'undefined') return 190;
    const w = window.innerWidth;
    if (w < 640) return 140;
    if (w < 768) return 170;
    if (w < 1024) return 190;
    return 240;
  });

  useEffect(() => {
    function update() {
      const w = window.innerWidth;
      if (w < 640) setLogoWidth(140);
      else if (w < 768) setLogoWidth(170);
      else if (w < 1024) setLogoWidth(190);
      else setLogoWidth(240);
    }
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  function validate() {
    const e: {[k:string]:string} = {};
    if (!form.school.trim()) e.school = 'Required';
    if (!form.contactName.trim()) e.contactName = 'Required';
    if (!form.contactRole.trim()) e.contactRole = 'Required';
    if (!form.phone.trim()) e.phone = 'Required';
    else if (!/^\+?[0-9\s()-]{7,}$/.test(form.phone)) e.phone = 'Invalid phone number';
    if (!form.email.trim()) e.email = 'Required';
    else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email)) e.email = 'Invalid email';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!validate()) return;
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/pilots/earlyintervention/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          schoolName: form.school,
          contactPersonName: form.contactName,
          contactPersonRole: form.contactRole,
          phone: form.phone,
          email: form.email,
          submitterName: null,
          submitterRole: null,
        }),
      });

      if (!res.ok) throw new Error('Failed to submit');

      setSubmitted(true);
      setShowForm(false);
      setForm({ school: '', contactName: '', contactRole: '', phone: '', email: '' });
      toast({ title: 'Submission received', description: 'Your request has been recorded.' });
    } catch (err) {
      console.error('Error submitting early intervention request:', err);
      toast({ title: 'Submission failed', description: 'Please try again later', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#FFF5ED" }}>
      <header className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md" style={{ backgroundColor: "rgba(255, 245, 237, 0.95)" }}>
        <div className="max-w-7xl mx-auto px-3 sm:px-6 md:px-12 py-3 sm:py-4 flex items-center justify-between">
          <div className="flex-shrink-0 ml-3 md:ml-0">
            <ResponseIntegrityLogo size="lg" variant="integrity" />
          </div>

          <div className="hidden md:block">
            <span className="text-2xl lg:text-4xl font-bold tracking-tight" style={{ color: "#1A1A1A" }}>
              RESPONSE-CONDITIONING
            </span>
          </div>

          <div className="flex items-center gap-3">
            <Button
              className="hidden md:inline-flex text-sm sm:text-base font-semibold px-4 sm:px-6 py-2 sm:py-5 rounded-full border-0 shadow-lg hover:shadow-xl transition-all"
              style={{ backgroundColor: "#E63946", color: "white" }}
              onClick={handleHeaderClick}
            >
              Pilot Access
            </Button>

            <Button
              className="md:hidden text-sm font-semibold px-3 py-2 rounded-full border-0 shadow hover:shadow-sm transition-all"
              style={{ backgroundColor: "#E63946", color: "white" }}
              onClick={handleHeaderClick}
              aria-label="Pilot Access"
            >
              Pilot Access
            </Button>
          </div>
        </div>
      </header>

      <div className="h-20 sm:h-28" />

      <section className="max-w-5xl mx-auto px-4 sm:px-6 md:px-12 pt-8 sm:pt-12 md:pt-20 pb-20">
        <div className="text-center mb-6 sm:mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full" style={{ backgroundColor: "#FFF0F0" }}>
            <span className="text-sm font-medium" style={{ color: "#E63946" }}>
              Response Integrity (Pty) Ltd
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold leading-tight mt-6" style={{ color: "#1A1A1A" }}>
            The Real Problem Schools Are Seeing
            <div className="text-base sm:text-lg font-semibold mt-2" style={{ color: "#5A5A5A" }}>
              Capable learners can understand the work and still lose structure under pressure.
            </div>
          </h1>
        </div>

        <Card className="p-4 sm:p-6 mb-6" style={{ backgroundColor: "white" }}>
          <p>
            Primary schools do not need another content layer.
          </p>
          <p className="mt-3">
            They need support for learners who understand the work but stop executing when pressure appears.
          </p>
          <p className="mt-3">
            This is not a content problem.
            It is a response problem.
          </p>
        </Card>

        <Card className="p-4 sm:p-6 mb-6" style={{ backgroundColor: "white" }}>
          <h2 className="text-lg font-bold mb-3">What Schools Observe (But Cannot Systematically Fix)</h2>
          <p>
            By Grades 6-7, a familiar pattern emerges:
          </p>
          <ul className="list-disc pl-5 mt-2 space-y-2">
            <li>Students answer confidently in class</li>
            <li>Performance collapses in tests</li>
            <li>Learners rush, freeze, or blank</li>
            <li>Emotional responses spike after assessments</li>
            <li>Parents report: "They knew it at home."</li>
          </ul>

          <p className="mt-3">
            This is often labelled as:
          </p>
          <ul className="list-disc pl-5 mt-2 space-y-2">
            <li>Test anxiety</li>
            <li>Careless mistakes</li>
            <li>Need for more practice</li>
          </ul>

          <p className="mt-3">But these are symptoms, not causes.</p>
        </Card>

        <Card className="p-4 sm:p-6 mb-6" style={{ backgroundColor: "white" }}>
          <h2 className="text-lg font-bold mb-3">The Actual Failure Mode</h2>
          <p>
            The student's response system is untrained.
          </p>
          <p className="mt-3">
            When:
          </p>
          <ul className="list-disc pl-5 mt-2 space-y-2">
            <li>Time pressure appears</li>
            <li>Questions are worded differently</li>
            <li>A step doesn' look immediately familiar</li>
          </ul>

          <p className="mt-3">
            The nervous system overrides cognition.
          </p>

          <p className="mt-3">At that moment:</p>
          <ul className="list-disc pl-5 mt-2 space-y-2">
            <li>Recall fragments</li>
            <li>Reasoning slows or disappears</li>
            <li>Execution breaks down</li>
          </ul>

          <p className="mt-3">
            Not because the learner is weak -
            but because they were never trained to operate under uncertainty.
          </p>
        </Card>

        <Card className="p-4 sm:p-6 mb-6" style={{ backgroundColor: "white" }}>
          <h2 className="text-lg font-bold mb-3">Why Primary Schools Cannot Solve This Alone</h2>
          <ul className="list-disc pl-5 mt-2 space-y-2">
            <li><strong>Classroom scale</strong>
              <div className="text-sm text-gray-600">One teacher cannot condition 30 individual response patterns.</div>
            </li>
            <li><strong>Curriculum pressure</strong>
              <div className="text-sm text-gray-600">Schools must move forward, not sit inside discomfort.</div>
            </li>
            <li><strong>Assessment design</strong>
              <div className="text-sm text-gray-600">Tests reveal breakdown - they do not train response to breakdown.</div>
            </li>
            <li><strong>Emotional constraints</strong>
              <div className="text-sm text-gray-600">Schools are incentivised to soothe, not deliberately stress.</div>
            </li>
          </ul>

          <p className="mt-3">So the issue is deferred. Quietly.</p>
        </Card>

        <Card className="p-4 sm:p-6 mb-6" style={{ backgroundColor: "white" }}>
          <h2 className="text-lg font-bold mb-3">What Happens If This Isn' Addressed Early</h2>
          <p>
            Untrained response systems don't disappear.
            They compound.
          </p>
          <ul className="list-disc pl-5 mt-2 space-y-2">
            <li>Avoidance patterns harden</li>
            <li>Confidence erosion becomes identity</li>
            <li>"I'm not a math person" replaces curiosity</li>
          </ul>

          <p className="mt-3">At that point, intervention is reactive - and expensive.</p>

          <p className="mt-3">Primary schools feel this intuitively.</p>

          <p className="mt-3"><em>"If only we could catch this earlier."</em></p>
        </Card>

        <Card className="p-4 sm:p-6 mb-6" style={{ backgroundColor: "white" }}>
          <h2 className="text-lg font-bold mb-3">What Response Integrity Actually Provides</h2>
          <p>
            Response Integrity is not extra lessons.
            It is not curriculum replacement.
            It is not remedial tutoring.
          </p>

          <p className="mt-3">We provide a controlled response-conditioning program for learners who know the work but underperform under pressure.</p>

          <p className="mt-3"><strong>In simple terms:</strong></p>
          <p>We train how students respond when certainty disappears.</p>

          <p className="mt-3">
            <a href="/about" className="text-sm font-semibold text-[#E63946] hover:underline">Learn More</a>
          </p>
        </Card>

        <Card className="p-4 sm:p-6 mb-6" style={{ backgroundColor: "white" }}>
          <h2 className="text-lg font-bold mb-3">What Schools and Families Gain</h2>
          <ul className="list-disc pl-5 mt-2 space-y-2">
            <li>Direct attention on how the learner thinks, pauses, rushes, and loses structure</li>
            <li>A private, judgment-free space where mistakes become training data</li>
            <li>Good pressure through observation, not shame</li>
            <li>Execution under difficulty</li>
            <li>Preparation before pressure arrives</li>
            <li>A system-led method rather than personality-led support</li>
            <li>Confidence through evidence</li>
            <li>Small structured cohorts that protect focus and consistency</li>
          </ul>
        </Card>

        <Card className="p-4 sm:p-6 mb-6" style={{ backgroundColor: "white" }}>
          <h2 className="text-lg font-bold mb-3">What That Looks Like in Practice</h2>
          <ul className="list-disc pl-5 mt-2 space-y-2">
            <li>Structured exposure to uncertainty</li>
            <li>Timed problem environments</li>
            <li>Guided pressure practice</li>
            <li>Execution under pressure</li>
            <li>Calm decision-making habits</li>
          </ul>

          <p className="mt-3">Always age-appropriate. Always psychologically safe. Never punitive.</p>

          <p className="mt-3">This is training - not testing.</p>
        </Card>

        <Card className="p-4 sm:p-6 mb-6" style={{ backgroundColor: "white" }}>
          <h2 className="text-lg font-bold mb-3">Why This Is Appropriate to Outsource</h2>
          <p>
            Primary schools already outsource:
          </p>
          <ul className="list-disc pl-5 mt-2 space-y-2">
            <li>Sports coaching</li>
            <li>Speech and occupational therapy</li>
            <li>Emotional support services</li>
          </ul>

          <p className="mt-3">Response-conditioning is similar in nature:</p>
          <ul className="list-disc pl-5 mt-2 space-y-2">
            <li>It does not interfere with curriculum</li>
            <li>It does not alter teaching methods</li>
            <li>It does not challenge assessment authority</li>
            <li>It provides psychological infrastructure schools cannot build at scale.</li>
          </ul>
        </Card>

        <Card className="p-4 sm:p-6 mb-6" style={{ backgroundColor: "white" }}>
          <h2 className="text-lg font-bold mb-3">What Schools Gain</h2>
          <ol className="list-decimal pl-5 mt-2 space-y-2">
            <li><strong>Early Intervention Without Stigma</strong>
              <div className="text-sm text-gray-600">Students are not labelled as weak or behind. The focus is execution - not intelligence.</div>
            </li>
            <li><strong>Behavioural Change Teachers Notice</strong>
              <div className="text-sm text-gray-600">Less panic. Slower, more deliberate work. Clearer written reasoning. Improved exam posture. These changes are visible quickly.</div>
            </li>
            <li><strong>Parent Pressure Relief</strong>
              <div className="text-sm text-gray-600">Schools can confidently say: "We referred your child to a structured support program." This reframes the conversation without defensiveness.</div>
            </li>
            <li><strong>Long-Term Outcome Protection</strong>
              <div className="text-sm text-gray-600">Students transition to high school with fewer panic-based habits. That reflects positively on the primary school - years later.</div>
            </li>
          </ol>
        </Card>

        <Card className="p-4 sm:p-6 mb-6" style={{ backgroundColor: "white" }}>
          <h3 className="text-lg font-bold mb-3">The Core Problem Statement</h3>
          <p>
            "Many capable students fail not because they don't understand the work, but because they haven't been trained to respond calmly when certainty disappears."
          </p>
          <p className="mt-3">Everything we do ladders up to this.</p>
        </Card>

        <Card className="p-4 sm:p-6 mb-6" style={{ backgroundColor: "white" }}>
          <h3 className="text-lg font-bold mb-3">Pilot Structure (Low Risk, High Signal)</h3>
          <ul className="list-disc pl-5 mt-2 space-y-2">
            <li>Small cohort referral (10-20 students)</li>
            <li>No administrative burden</li>
            <li>No curriculum disruption</li>
            <li>Observational feedback returned to the school</li>
          </ul>

          <p className="mt-3">This is not a commitment. It is a diagnostic collaboration.</p>
        </Card>

        <Card className="p-4 sm:p-6 mb-6" style={{ backgroundColor: "white" }}>
          <h3 className="text-lg font-bold mb-3">Our Position</h3>
          <p>
            We are not competing with schools.
            We are not correcting schools.
            We are not replacing schools.
          </p>

          <p className="mt-3">We exist to catch a failure mode early - before it becomes academic identity damage.</p>

          <p className="mt-3">That makes this responsible. That makes it institutional. That makes it necessary.</p>
        </Card>

        {!submitted && (
          <div className="text-center mt-6">
            <Button size="lg" className="px-6 py-3 rounded-full font-semibold w-full sm:w-auto" style={{ backgroundColor: "#E63946", color: "white" }} onClick={handleOpenForm}>
              Pilot Access
            </Button>
          </div>
        )} 

        {/* Inline form (minimal fields) */}
        {showForm && !submitted && (
          <div ref={formRef} className="max-w-2xl mx-auto mt-8">
            <Card className="p-4 sm:p-6" style={{ backgroundColor: "white" }}>
              <h3 className="text-lg font-bold mb-4">Request Referral Pilot Access</h3>
              <form onSubmit={handleSubmit}>
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-1">School name</label>
                  <input ref={firstInputRef} value={form.school} onChange={e => setForm({...form, school: e.target.value})} className="w-full border rounded px-3 py-2" />
                  {errors.school && <div className="text-sm text-red-600 mt-1">{errors.school}</div>}
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium mb-1">Name & Surname of contact person</label>
                  <input value={form.contactName} onChange={e => setForm({...form, contactName: e.target.value})} className="w-full border rounded px-3 py-2" />
                  {errors.contactName && <div className="text-sm text-red-600 mt-1">{errors.contactName}</div>}
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium mb-1">Role of contact person</label>
                  <input value={form.contactRole} onChange={e => setForm({...form, contactRole: e.target.value})} className="w-full border rounded px-3 py-2" />
                  {errors.contactRole && <div className="text-sm text-red-600 mt-1">{errors.contactRole}</div>}
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium mb-1">Phone number</label>
                  <input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} className="w-full border rounded px-3 py-2" />
                  {errors.phone && <div className="text-sm text-red-600 mt-1">{errors.phone}</div>}
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium mb-1">Email</label>
                  <input value={form.email} onChange={e => setForm({...form, email: e.target.value})} className="w-full border rounded px-3 py-2" />
                  {errors.email && <div className="text-sm text-red-600 mt-1">{errors.email}</div>}
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto px-4 py-2 rounded-full" style={{ backgroundColor: "#E63946", color: "white" }}>{isSubmitting ? 'Sending...' : 'Submit'}</Button>
                  <Button type="button" className="w-full sm:w-auto px-4 py-2 rounded-full border" onClick={() => setShowForm(false)}>Cancel</Button>
                </div>
              </form>
            </Card>
          </div>
        )}

        {/* Submission confirmation */}
        {submitted && (
          <div ref={submittedRef} className="max-w-2xl mx-auto mt-8">
            <Card className="p-4 sm:p-6" style={{ backgroundColor: "white" }}>
              <h3 className="text-lg font-bold mb-3">Submission Received</h3>

              <p>Thank you for submitting your school's interest in the Response Integrity referral pilot.</p>

              <p className="mt-3">Your request has been logged for internal review.</p>

              <p className="mt-3">A member of the Response Integrity team will contact the designated staff representative to:</p>
              <ul className="list-disc pl-5 mt-2 space-y-2">
                <li>Confirm suitability for the pilot</li>
                <li>Clarify the referral framework</li>
                <li>Align on term-based timing and scope</li>
              </ul>

              <p className="mt-3">This submission does not commit your school to participation.</p>

              <p className="mt-3">It initiates a consideration process.</p>

              <p className="mt-3">If approved, next steps will be outlined clearly before any activation.</p>

              <div className="mt-6 border-t pt-4 text-sm">
                <br />
                Response Integrity<br />
                Early Response-Conditioning Infrastructure for Schools
              </div>
            </Card>
          </div>
        )}

      </section>

      <footer className="py-12" style={{ backgroundColor: "#FFF5ED" }}>
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-2">
              <ResponseIntegrityLogo size="md" variant="integrity" />
            </div>
            <p className="text-center md:text-right" style={{ color: "#5A5A5A" }}>
              &copy; {new Date().getFullYear()} Response Integrity (Pty) Ltd
              <br />
              <span className="text-sm">Early Response-Conditioning Infrastructure for Schools.</span>
            </p>
          </div>
        </div>
      </footer>

    </div>
  );
}

