import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { PageSeo, SITE_NAME, SITE_ORIGIN } from "@/components/PageSeo";
import { ResponseIntegrityLogo } from "@/components/ResponseIntegrityLogo";

export default function HowWeOperate() {
  return (
    <div className="min-h-screen bg-[#FCF6F2] text-[#1A1A1A]">
      <PageSeo
        title="How We Operate | Response Integrity"
        description="See how Response Integrity operates through two annual intakes, fixed conditioning cadence, execution-season discipline, and phase-aware academic performance conditioning."
        path="/about/how-we-operate"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "AboutPage",
          name: "How We Operate",
          url: `${SITE_ORIGIN}/about/how-we-operate`,
          description:
            "Operational model for Response Integrity, including intake windows, conditioning cadence, execution-season standards, and anti-cramming discipline.",
          about: {
            "@type": "Organization",
            name: SITE_NAME,
            url: SITE_ORIGIN,
          },
        }}
      />
      <section className="max-w-4xl mx-auto px-6 py-20 text-center">
        <ResponseIntegrityLogo size="lg" variant="integrity" />
        <p className="mt-8 text-sm uppercase tracking-[0.35em] text-[#E63946]">How We Operate</p>
      </section>

      <section className="max-w-5xl mx-auto px-6 pb-24">
        <Card className="rounded-2xl border border-slate-200 bg-[#F7F0EA] shadow-sm">
          <CardContent className="prose prose-slate max-w-none p-10 sm:p-12">
            <h2>Preparation Before Pressure</h2>
            <p>Response Integrity does not wait for pressure before preparing students.</p>
            <p>We believe stable academic performance is built before:</p>
            <ul>
              <li>exams,</li>
              <li>deadlines,</li>
              <li>classroom pressure,</li>
              <li>and emotional urgency appear.</li>
            </ul>
            <p>
              For this reason, Response Integrity operates as an academic
              performance-conditioning system rather than a reactive tutoring
              service.
            </p>
            <p>
              Families do not join Response Integrity for random extra lessons.
              They enter a conditioning rhythm designed to prepare response
              before the year tests it.
            </p>

            <h2>Two Annual Intakes</h2>
            <p>Response Integrity accepts students through two annual intakes only.</p>
            <ul>
              <li>Full-Year Conditioning Intake</li>
              <li>Mid-Year Conditioning Intake</li>
            </ul>
            <p>
              This is deliberate. Response conditioning depends on runway,
              cadence, preparation, and stable scheduling. It cannot be built
              through panic enrollment or ad hoc rescue culture.
            </p>

            <h2>One Standard</h2>
            <p>Both intake cycles follow the same Response Integrity standard.</p>
            <ul>
              <li>2 sessions per week</li>
              <li>8 sessions per month</li>
              <li>OS-driven topic conditioning</li>
              <li>No panic culture</li>
            </ul>
            <p>
              The cadence is not admin around the product. The cadence is part
              of the conditioning itself.
            </p>

            <h2>Full-Year Conditioning Intake</h2>
            <p>
              <strong>Enrollment window:</strong> 1 November - 31 January
            </p>
            <p>
              This is Response Integrity&apos;s primary intake. It is built for
              families who want the full academic year treated as a
              response-conditioning journey, not a last-minute rescue.
            </p>
            <p>
              The full-year cycle gives the student maximum runway, deeper topic
              coverage, calmer progress, and stronger exam-state stability.
            </p>

            <h3>Response Planning Season</h3>
            <p>
              <strong>1 November - 31 January</strong>
            </p>
            <p>
              This is where parent education, onboarding, scope collection,
              tutor and TD preparation, intro diagnostics, topic mapping, and
              family schedule alignment happen.
            </p>
            <p>The academic year begins before the pressure does.</p>

            <h3>Conditioning Season</h3>
            <p>
              <strong>1 February - 31 August</strong>
            </p>
            <p>
              This is where the monthly cadence is protected, topics are
              conditioned ahead of pressure, and students move through
              phase-aware topic development according to Response
              Integrity-OS.
            </p>
            <p>School introduces. Response Integrity conditions.</p>

            <h3>Execution Season</h3>
            <p>
              <strong>1 September - 30 November</strong>
            </p>
            <p>
              This is where cadence is protected under live academic pressure.
              Assessments are treated as performance data, not as the first
              serious exposure to difficulty.
            </p>
            <p>Exams reveal conditioning.</p>

            <h2>Mid-Year Conditioning Intake</h2>
            <p>
              <strong>Enrollment window:</strong> 1 May - 31 May
            </p>
            <p>
              This is Response Integrity&apos;s second and final intake of the
              year. It exists for families who realize after Term 1 or early
              Term 2 that structured response conditioning is still needed
              before final pressure peaks.
            </p>
            <p>
              It is not emergency entry. It is the last disciplined entry point
              with enough serious runway to matter.
            </p>

            <h3>Mid-Year Response Planning Season</h3>
            <p>
              <strong>1 May - 31 May</strong>
            </p>
            <p>
              This month covers parent education, onboarding, scope collection,
              tutor and TD allocation, intro diagnostics, priority topic
              activation, and schedule commitment.
            </p>
            <p>Late realization is acceptable. Late panic is not the model.</p>

            <h3>Accelerated Conditioning Season</h3>
            <p>
              <strong>1 June - 31 August</strong>
            </p>
            <p>
              This is the minimum serious runway cycle. The focus is priority
              topics, strong repetition, and enough OS-led exposure before
              execution season begins.
            </p>
            <p>
              Students in this cycle typically still receive approximately 40
              sessions from June to October.
            </p>
            <p>Minimum runway matters.</p>

            <h3>Execution Season</h3>
            <p>
              <strong>1 September - 30 November</strong>
            </p>
            <p>
              The same execution standard applies here: maintain structure,
              continue cadence, and protect response stability under final-year
              pressure.
            </p>
            <p>Pressure should not be the first serious exposure.</p>

            <h2>Execution Season Closure</h2>
            <p>
              Response Integrity does not open normal enrollment during
              Execution Season.
            </p>
            <p>
              <strong>1 September - 30 November</strong> is reserved for
              protecting active students, tutors, TDs, service quality, and the
              anti-cramming standard of the company.
            </p>
            <p>
              New families may join the waitlist for the next Full-Year
              Conditioning Intake.
            </p>

            <h2>Ahead-Of-Class Conditioning</h2>
            <p>
              Whenever possible, Response Integrity works from the student&apos;s
              yearly, termly, or upcoming school topic scope.
            </p>
            <p>
              This allows students to begin conditioning before topics become
              high-pressure classroom or exam environments.
            </p>
            <p>By the time a topic becomes heavily emphasized at school:</p>
            <ul>
              <li>the student has already seen the structures,</li>
              <li>practiced the execution patterns,</li>
              <li>built familiarity,</li>
              <li>and begun stabilizing their response inside the topic.</li>
            </ul>
            <p>School then becomes:</p>
            <ul>
              <li>reinforcement,</li>
              <li>repetition,</li>
              <li>and deeper exposure,</li>
              <li>rather than first contact under pressure.</li>
            </ul>

            <h2>Topic Conditioning Cadence</h2>
            <p>Response Integrity uses Topic Conditioning.</p>
            <p>This means we condition students topic-by-topic using:</p>
            <ul>
              <li>structured repetition,</li>
              <li>execution practice,</li>
              <li>controlled difficulty,</li>
              <li>and progressive pressure exposure.</li>
            </ul>
            <p>
              Students move through topics using Response Integrity cadence
              rather than emergency-based academic urgency.
            </p>
            <p>Conditioning is paced intentionally according to:</p>
            <ul>
              <li>the student&apos;s stability,</li>
              <li>response quality,</li>
              <li>execution consistency,</li>
              <li>and conditioning phase inside each topic.</li>
            </ul>
            <p>
              That also means we do not view the student as one global state
              across every topic.
            </p>
            <p className="text-muted-foreground">
              A student can be strong in one topic and unstable in another, so
              we track topic-specific response state instead of one-size-fits-all
              labels like &quot;weak&quot; or &quot;behind.&quot;
            </p>

            <h2>Anti-Adhoc Philosophy</h2>
            <p>Stable response cannot be built through inconsistent exposure.</p>
            <p>
              For this reason, Response Integrity does not operate around
              chaotic, panic-driven academic intervention.
            </p>
            <p>We believe:</p>
            <ul>
              <li>consistency builds stability,</li>
              <li>repetition builds familiarity,</li>
              <li>and familiarity reduces emotional collapse under pressure.</li>
            </ul>
            <p>Conditioning requires cadence.</p>
            <p>
              We do not organize the system around panic. We organize the
              family around preparation.
            </p>

            <h2>Who This Is Built For</h2>
            <p>
              Response Integrity is built for families who are ready to prepare
              before pressure arrives.
            </p>
            <p>
              The enrollment architecture itself helps protect that fit. It
              favors families who respect cadence, value development over panic,
              and can commit to the rhythm required for stable response
              conditioning.
            </p>

            <h2>The Response Integrity Environment</h2>
            <p>Response Integrity aims to create a calm-performance culture.</p>
            <p>Inside this environment:</p>
            <ul>
              <li>pressure is normalized,</li>
              <li>difficulty is expected,</li>
              <li>structure is reinforced,</li>
              <li>and preparation happens early.</li>
            </ul>
            <p>Students are not trained to fear exams.</p>
            <p>They are conditioned to experience exams as another execution environment.</p>

            <h2>What Response Integrity Truly Optimizes For</h2>
            <p>Response Integrity is not optimizing for temporary academic spikes alone.</p>
            <p>We are optimizing for:</p>
            <ul>
              <li>stable response patterns,</li>
              <li>calm execution,</li>
              <li>long-term academic resilience,</li>
              <li>and reliable performance under pressure.</li>
            </ul>
            <p>Mathematics is the training area.</p>
            <p>But the deeper objective is helping students develop stronger cognitive and emotional stability when difficulty appears.</p>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
