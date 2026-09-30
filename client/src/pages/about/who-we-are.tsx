import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { PageSeo, SITE_NAME, SITE_ORIGIN } from "@/components/PageSeo";
import { ResponseIntegrityLogo } from "@/components/ResponseIntegrityLogo";

export default function WhoWeAre() {
  return (
    <div className="min-h-screen bg-[#FCF6F2] text-[#1A1A1A]">
      <PageSeo
        title="Who We Are | Response Integrity"
        description="Response Integrity is an academic performance-conditioning system that trains students to stay calm, structured, and functional when mathematics becomes difficult."
        path="/about/who-we-are"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "AboutPage",
          name: "Who We Are",
          url: `${SITE_ORIGIN}/about/who-we-are`,
          description:
            "Response Integrity explains its philosophy, response-conditioning focus, and why it is not positioned as a traditional tutoring company.",
          about: {
            "@type": "Organization",
            name: SITE_NAME,
            url: SITE_ORIGIN,
            description:
              "An academic performance-conditioning system focused on response stability under mathematical difficulty and pressure.",
          },
        }}
      />
      <section className="max-w-4xl mx-auto px-6 py-20 text-center">
        <ResponseIntegrityLogo size="lg" variant="integrity" />
        <p className="mt-8 text-sm uppercase tracking-[0.35em] text-[#E63946]">
          Who We Are
        </p>
      </section>

      <section className="max-w-5xl mx-auto px-6 pb-24">
        <Card className="rounded-2xl border border-slate-200 bg-[#F7F0EA] shadow-sm">
          <CardContent className="prose prose-slate max-w-none p-10 sm:p-12">
            <p>Response Integrity was not built as a traditional tutoring company.</p>
            <p>It was built around a different observation:</p>
            <p>Many students do not collapse because they are incapable. They collapse because their response becomes unstable when pressure, uncertainty, difficulty, or time constraints appear.</p>
            <p>Some students understand the work during lessons but freeze during exams. Some panic when questions look unfamiliar. Some emotionally shut down after one mistake. Some avoid attempting because difficulty immediately feels like failure.</p>
            <p>Response Integrity exists to train the response behind performance.</p>
            <p>We call this Response Conditioning.</p>

            <h2>What Is Response Conditioning?</h2>
            <p>Response Conditioning is the process of helping students develop a calmer, more structured, and more reliable response when mathematics becomes difficult.</p>
            <p>This is not motivational speaking. It is not pressure-free learning. And it is not last-minute cramming.</p>
            <p>It is a structured conditioning system based on:</p>
            <ul>
              <li>repetition,</li>
              <li>guided execution,</li>
              <li>controlled difficulty,</li>
              <li>pressure adaptation,</li>
              <li>and consistent exposure over time.</li>
            </ul>
            <p>Students are gradually trained to:</p>
            <ul>
              <li>begin instead of freeze,</li>
              <li>think clearly under pressure,</li>
              <li>follow structured methods,</li>
              <li>remain emotionally steadier during difficulty,</li>
              <li>and execute with greater consistency.</li>
            </ul>
            <p>The goal is not perfection. The goal is stable response.</p>

            <h2>Why We Do Not Call This Tutoring</h2>
            <p>Tutoring usually describes a service that helps a student understand work or catch up after difficulty appears.</p>
            <p>Response Integrity includes teaching, but it is built around a larger goal: conditioning the student's response before pressure destabilizes performance.</p>
            <p>That is why we define Response Integrity as academic performance conditioning rather than as a traditional tutoring company.</p>

            <h2>Why We Operate Differently</h2>
            <p>Response Conditioning cannot be built through irregular, emergency-based intervention.</p>
            <p>Stable academic performance requires:</p>
            <ul>
              <li>cadence,</li>
              <li>repetition,</li>
              <li>structure,</li>
              <li>timing,</li>
              <li>and intentional preparation before pressure arrives.</li>
            </ul>
            <p>For this reason, Response Integrity operates through conditioning windows, structured enrollment cycles, and consistent development rhythms rather than reactive, ad hoc tutoring.</p>
            <p>We do not believe meaningful academic conditioning is built through panic-driven preparation shortly before exams. We believe preparation should begin long before pressure peaks.</p>

            <h2>Operational Values</h2>
            <p>Response Integrity does not treat operations as separate from philosophy.</p>
            <p>If stable response is built through cadence, then enrollment cannot be completely ad hoc, scheduling cannot be random, and pressure preparation cannot begin only when exams are near.</p>
            <p>That is why our operating model uses conditioning windows, structured starts, and consistent repetition rather than reactive tutoring culture.</p>

            <h2>What Parents Should Understand</h2>
            <p>Response Integrity is designed for families who value:</p>
            <ul>
              <li>long-term development,</li>
              <li>disciplined preparation,</li>
              <li>emotional stability,</li>
              <li>structured growth,</li>
              <li>and consistent execution over temporary intensity.</li>
            </ul>
            <p>This means we do not only measure marks.</p>
            <p>We also monitor:</p>
            <ul>
              <li>response behavior,</li>
              <li>calmness under pressure,</li>
              <li>willingness to attempt,</li>
              <li>structured thinking,</li>
              <li>execution quality,</li>
              <li>and stability during difficulty.</li>
            </ul>
            <p>A student learning to remain composed during a difficult question is real progress. A student learning to start independently instead of emotionally shutting down is real progress. A student learning that uncertainty does not equal failure is real progress.</p>

            <h2>Who Response Integrity Is Built For</h2>
            <p>Response Integrity is built for parents who believe:</p>
            <ul>
              <li>preparation matters,</li>
              <li>consistency matters,</li>
              <li>emotional stability matters,</li>
              <li>and disciplined development matters.</li>
            </ul>
            <p>Families who align most with our philosophy usually understand that:</p>
            <ul>
              <li>confidence is built through repetition,</li>
              <li>resilience is built through exposure,</li>
              <li>and strong performance is built long before important exams arrive.</li>
            </ul>
            <p>This system is not designed around urgency culture. It is designed around conditioning culture.</p>

            <p>Mathematics is the training area. But the deeper goal is helping students become more stable, intentional, and reliable when difficulty appears.</p>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
