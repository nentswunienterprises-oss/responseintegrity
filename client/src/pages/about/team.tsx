import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { PageSeo, SITE_NAME, SITE_ORIGIN } from "@/components/PageSeo";
import { ResponseIntegrityLogo } from "@/components/ResponseIntegrityLogo";
import { buildTrackedPath } from "@/lib/publicTracking";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

const portraitExtensions = ["jpg", "jpeg", "png", "webp"] as const;

const leadershipTeam = [
  {
    id: "rofhiwa-singo",
    name: "Rofhiwa Singo",
    role: "Chief Marketing Officer",
    focus: "Brand strategy, growth visibility, and market-facing momentum.",
    accent: "#E63946",
    imagePosition: "center 22%",
  },
  {
    id: "ntandoyenkosi-dlamini",
    name: "Ntandoyenkosi Dlamini",
    role: "Head of HR",
    focus: "People operations, talent stewardship, and internal culture rhythm.",
    accent: "#B56576",
    imagePosition: "center 24%",
  },
  {
    id: "kevin-lubanda",
    name: "Kevin Lubanda",
    role: "Chief Operating Officer",
    focus: "Operational execution, delivery standards, and organizational discipline.",
    accent: "#8A4B35",
    imagePosition: "center 18%",
  },
  {
    id: "lawrence-zwenyere",
    name: "Lawrence Zwenyere",
    role: "Chief Technology Officer",
    focus: "Technical architecture, systems reliability, and product infrastructure.",
    accent: "#264653",
    imagePosition: "center 12%",
  },
] as const;

function buildPortraitCandidates(memberId: string) {
  return portraitExtensions.map((extension) => `/images/team/${memberId}.${extension}`);
}

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default function TeamPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const currentParams = new URLSearchParams(location.search);
  const returnTo = currentParams.get("returnTo");
  const aboutBackTarget = buildTrackedPath("/about", location.search, returnTo ? { returnTo } : {});
  const howWeOperateTarget = buildTrackedPath("/about/how-we-operate", location.search, returnTo ? { returnTo } : {});
  const [portraitIndexes, setPortraitIndexes] = useState<Record<string, number>>(() =>
    Object.fromEntries(leadershipTeam.map((member) => [member.id, 0])),
  );

  const leadershipJsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "AboutPage",
        name: "Meet the Team",
        url: `${SITE_ORIGIN}/about/team`,
        description:
          "Meet the Response Integrity leadership team across marketing, human resources, operations, and technology.",
        about: {
          "@type": "Organization",
          name: SITE_NAME,
          url: SITE_ORIGIN,
        },
      },
      {
        "@type": "Organization",
        name: SITE_NAME,
        url: SITE_ORIGIN,
        member: leadershipTeam.map((member) => ({
          "@type": "Person",
          name: member.name,
          jobTitle: member.role,
        })),
      },
    ],
  };

  return (
    <div className="min-h-screen overflow-hidden bg-[#FCF6F2] text-[#1A1A1A]">
      <PageSeo
        title="Meet the Team | Response Integrity"
        description="Meet the Response Integrity leadership team across marketing, human resources, operations, and technology."
        path="/about/team"
        jsonLd={leadershipJsonLd}
      />

      <section className="relative">
        <div
          className="absolute inset-x-0 top-0 h-[32rem] opacity-80"
          style={{
            background:
              "radial-gradient(circle at top left, rgba(230,57,70,0.14), transparent 38%), radial-gradient(circle at top right, rgba(38,70,83,0.12), transparent 34%), linear-gradient(180deg, rgba(247,240,234,1) 0%, rgba(252,246,242,1) 72%)",
          }}
        />

        <div className="relative mx-auto max-w-7xl px-6 py-20">
          <div className="w-full flex justify-center mb-8">
            <div className="max-w-sm" style={{ transform: "scale(0.9)", transformOrigin: "center" }}>
              <ResponseIntegrityLogo size="lg" variant="integrity" />
            </div>
          </div>
          <Button
            variant="ghost"
            className="rounded-full px-0 text-sm font-medium text-[#5A5A5A] hover:bg-transparent hover:text-[#1A1A1A]"
            onClick={() => navigate(aboutBackTarget)}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to About
          </Button>

          <div className="mt-8">

            <div className="mt-8 grid gap-12 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
              <div>
                <p className="mt-8 text-sm uppercase tracking-[0.35em] text-[#E63946]">
                  Meet The Team
                </p>
                <h1 className="mt-5 max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
                  The leadership behind Response Integrity.
                </h1>
                <p className="mt-6 max-w-2xl text-base leading-8 text-[#5A5A5A] sm:text-lg">
                  Our executive team carries the company across growth, people, execution, and
                  technology, with each seat protecting a core part of how the system moves.
                </p>
              </div>
            </div>

            <div className="rounded-[2rem] border border-[#E8D7CB] bg-white/75 p-8 shadow-[0_30px_80px_rgba(26,26,26,0.08)] backdrop-blur">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#8A4B35]">
                Leadership
              </p>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                {leadershipTeam.map((member) => (
                  <div
                    key={member.id}
                    className="rounded-2xl border border-[#EFE2D7] bg-[#FCF8F5] p-4"
                  >
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8B776B]">
                      {member.role}
                    </p>
                    <p className="mt-2 text-base font-semibold text-[#1A1A1A]">{member.name}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-24">
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {leadershipTeam.map((member) => {
            const portraitCandidates = buildPortraitCandidates(member.id);
            const portraitIndex = portraitIndexes[member.id] ?? 0;
            const portraitSrc =
              portraitIndex >= 0 && portraitIndex < portraitCandidates.length
                ? portraitCandidates[portraitIndex]
                : null;

            return (
              <article
                key={member.id}
                className="group rounded-[2rem] border border-[#E9D9CE] bg-[#F9F3EE] p-4 shadow-[0_18px_48px_rgba(26,26,26,0.07)] transition-transform duration-300 hover:-translate-y-1"
              >
                <div className="relative overflow-hidden rounded-[1.6rem] bg-[#EFE2D7]">
                  <div
                    className="absolute inset-0 opacity-70"
                    style={{
                      background: `linear-gradient(180deg, rgba(255,255,255,0) 0%, ${member.accent}33 100%)`,
                    }}
                  />

                  {portraitSrc ? (
                    <img
                      src={portraitSrc}
                      alt={`${member.name}, ${member.role}`}
                      className="relative aspect-[4/5] w-full object-cover"
                      style={{ objectPosition: member.imagePosition }}
                      onError={() =>
                        setPortraitIndexes((current) => {
                          const currentIndex = current[member.id] ?? 0;
                          return {
                            ...current,
                            [member.id]:
                              currentIndex >= portraitCandidates.length - 1 ? -1 : currentIndex + 1,
                          };
                        })
                      }
                    />
                  ) : (
                    <div
                      className="flex aspect-[4/5] items-center justify-center"
                      style={{
                        background: `linear-gradient(160deg, ${member.accent} 0%, #F3E6DC 88%)`,
                      }}
                    >
                      <span className="text-5xl font-semibold tracking-[0.12em] text-white/92">
                        {getInitials(member.name)}
                      </span>
                    </div>
                  )}
                </div>

                <div className="px-2 pb-2 pt-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#8B776B]">
                        {member.role}
                      </p>
                      <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[#1A1A1A]">
                        {member.name}
                      </h2>
                    </div>
                    <div
                      className="mt-1 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white"
                      style={{ backgroundColor: member.accent }}
                    >
                      {getInitials(member.name)}
                    </div>
                  </div>

                  <p className="mt-4 text-sm leading-7 text-[#5A5A5A]">{member.focus}</p>
                </div>
              </article>
            );
          })}
        </div>

        <div className="mt-12 rounded-[2rem] border border-[#E8D7CB] bg-white/80 p-8 shadow-sm">
          <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#E63946]">
                Built To Move Together
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-[#1A1A1A]">
                Leadership that protects the system from every angle.
              </h2>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-[#5A5A5A] sm:text-base">
                From public growth to internal people systems, from operating rhythm to technical
                infrastructure, these seats help keep Response Integrity disciplined, clear, and
                buildable at scale.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row lg:justify-end">
              <Button
                variant="outline"
                className="rounded-full border-[#1A1A1A] bg-[#FCF6F2] text-[#1A1A1A]"
                onClick={() => navigate(aboutBackTarget)}
              >
                Back to About
              </Button>
              <Button
                className="rounded-full border-0 bg-[#E63946] text-white hover:bg-[#d2303d]"
                onClick={() => navigate(howWeOperateTarget)}
              >
                See How We Operate
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
