import { LegalDocumentMeta, LegalDocumentPage } from "@/components/legal/LegalDocumentPage";

export default function TutorTermsOfUse() {
  return (
    <LegalDocumentPage
      title="Specialist Terms of Use"
      subtitle={
        <LegalDocumentMeta
          items={[
            "Response Integrity (Pty) Ltd",
            "Version 1.0",
            "Effective May 8, 2026",
          ]}
        />
      }
      intro={
        <>
          <p>
            These terms apply to specialist applicants, specialists in onboarding, and specialists operating inside the Response Integrity platform.
          </p>
          <p>
            Specialist access is not general consumer access. It is controlled operational access to a recorded,
            compliance-driven response-conditioning platform.
          </p>
        </>
      }
      sections={[
        {
          title: "1. Role and Access Scope",
          paragraphs: [
            "Specialists use the platform to execute Response Integrity-OS sessions, complete reports, manage approved session workflows, and use assigned operational tools.",
            "Specialist access may be limited, expanded, suspended, or revoked based on onboarding status, compliance status, training mode, certification state, and active assignment status.",
          ],
        },
        {
          title: "2. Independent Contractor Status",
          bullets: [
            "Specialist participation is as an independent contractor, not an employee.",
            "No salary, employment benefit, minimum income, or guaranteed placement is created by specialist signup or onboarding.",
            "Response Integrity may stop onboarding, assignment, or platform access where fit, compliance, or operational need is not present.",
          ],
        },
        {
          title: "3. Response Integrity-OS Compliance",
          bullets: [
            "All sessions must follow Response Integrity-OS, including approved drill structure, progression logic, and reporting requirements.",
            "Specialists may not soften, rewrite, improvise around, or privately replace Response Integrity methodology.",
            "Specialist judgment operates inside the system, not outside it.",
          ],
        },
        {
          title: "4. Platform Discipline and Communications",
          bullets: [
            "Specialists may not move learners, parents, or session arrangements outside approved systems without written authorization.",
            "Specialists may not accept direct payment, private side arrangements, or off-platform services sourced through relationships formed on the platform.",
            "Response Integrity may monitor platform use, submission patterns, session integrity signals, and compliance events.",
          ],
        },
        {
          title: "5. Recording, Reporting, and Data Integrity",
          bullets: [
            "Sessions may be recorded in full, including audio, video, logs, metadata, and related compliance artifacts.",
            "Specialists must submit accurate observations, progression data, and operational records.",
            "Misreporting, omission, falsification, or concealment of session reality is a serious platform violation.",
          ],
        },
        {
          title: "6. Payment",
          paragraphs: [
            "Specialist payment is governed by Response Integrity's current contractor structure, active session completion rules, compliance requirements, and assignment status.",
            "There is no entitlement to payment for incomplete, non-compliant, fraudulent, or integrity-compromised activity. Response Integrity may withhold, adjust, or suspend payment where platform rules or session integrity standards are breached.",
          ],
        },
        {
          title: "7. Confidentiality and Intellectual Property",
          bullets: [
            "Platform systems, drill logic, reporting structures, operating documents, recordings, and learner data are confidential and protected.",
            "Specialists may not copy, reproduce, teach externally, disclose, or commercially reuse Response Integrity methodology or platform materials without written permission.",
            "Learner data and operational data may be used only for lawful Response Integrity purposes.",
          ],
        },
        {
          title: "8. Suspension and Termination",
          paragraphs: [
            "Response Integrity may suspend, restrict, or terminate specialist access immediately for non-compliance, safeguarding concerns, misconduct, system misuse, dishonesty, role circumvention, or operational risk.",
          ],
        },
        {
          title: "9. Data Rights and Retention",
          paragraphs: [
            "Specialists may request access to or correction of their personal information. Deletion requests will be assessed subject to Response Integrity's lawful retention duties, including audit, safeguarding, payment, tax, dispute, fraud-prevention, and operational compliance requirements.",
          ],
        },
        {
          title: "10. Governing Law",
          paragraphs: [
            "These terms are governed by the laws of the Republic of South Africa. Use of specialist access confirms acceptance of these terms and of Response Integrity's applicable onboarding and contractor documents.",
          ],
        },
      ]}
      footer={
        <LegalDocumentMeta
          className="text-xs sm:text-sm"
          items={[
            "Response Integrity (Pty) Ltd",
            "Specialist Terms of Use",
            "www.responseintegrity.co.za",
          ]}
        />
      }
    />
  );
}
