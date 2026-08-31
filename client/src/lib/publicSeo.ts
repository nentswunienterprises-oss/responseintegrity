export type JsonLdValue = Record<string, unknown> | Array<Record<string, unknown>>;

export type RouteSeoDefinition = {
  path: string;
  title: string;
  description: string;
  robots?: string;
  type?: string;
  image?: string;
  imageAlt?: string;
  twitterCard?: "summary" | "summary_large_image";
  jsonLd?: JsonLdValue;
  prerender?: boolean;
  injectInSpa?: boolean;
  includeInSitemap?: boolean;
  matchMode?: "exact" | "prefix";
};

export const SITE_ORIGIN = "https://responseintegrity.co.za";
export const SITE_NAME = "Response Integrity";
export const DEFAULT_SOCIAL_IMAGE_PATH = "/images/Benefits-of-Online-Tutoring-1-1080x589.png";
export const DEFAULT_SOCIAL_IMAGE_ALT = "Response Integrity response-training";
export const STATIC_SITEMAP_PATHS = ["/privacy-policy", "/terms-of-use"] as const;

export function toAbsoluteSiteUrl(path: string) {
  return new URL(path, SITE_ORIGIN).toString();
}

function buildAboutPageJsonLd(path: string, name: string, description: string, aboutDescription?: string) {
  return {
    "@context": "https://schema.org",
    "@type": "AboutPage",
    name,
    url: toAbsoluteSiteUrl(path),
    description,
    about: {
      "@type": "Organization",
      name: SITE_NAME,
      url: SITE_ORIGIN,
      ...(aboutDescription ? { description: aboutDescription } : {}),
    },
  };
}

function normalizeSeoPath(pathname: string) {
  if (!pathname) {
    return "/";
  }

  if (pathname === "/") {
    return pathname;
  }

  return pathname.replace(/\/+$/, "") || "/";
}

export const routeSeoDefinitions: RouteSeoDefinition[] = [
  {
    path: "/",
    title: "Calm Execution Under Pressure | Response Integrity",
    description:
      "Response Integrity is a conditioning-based academic performance system that helps students build calmer, more structured response patterns before pressure peaks.",
    prerender: false,
    injectInSpa: true,
    includeInSitemap: true,
  },
  {
    path: "/faq",
    title: "Frequently Asked Questions | Response Integrity",
    description:
      "Frequently asked questions about Response Integrity's response-conditioning system for Grades 6-9 students.",
    injectInSpa: true,
    includeInSitemap: true,
  },
  {
    path: "/about",
    title: "About Response Integrity | Academic Performance Conditioning",
    description:
      "Learn who Response Integrity is, how we operate, and how we teach through a structured academic performance-conditioning system built to prepare students before pressure peaks.",
    jsonLd: buildAboutPageJsonLd(
      "/about",
      "About Response Integrity",
      "Overview of who Response Integrity is, how it operates, and how it teaches through academic performance conditioning.",
    ),
    prerender: true,
    injectInSpa: false,
    includeInSitemap: true,
  },
  {
    path: "/about/who-we-are",
    title: "Who We Are | Response Integrity",
    description:
      "Response Integrity is an academic performance-conditioning system that trains students to stay calm, structured, and functional when mathematics becomes difficult.",
    jsonLd: buildAboutPageJsonLd(
      "/about/who-we-are",
      "Who We Are",
      "Response Integrity explains its philosophy, response-conditioning focus, and why it is not positioned as a traditional tutoring company.",
      "An academic performance-conditioning system focused on response stability under mathematical difficulty and pressure.",
    ),
    prerender: true,
    injectInSpa: false,
    includeInSitemap: true,
  },
  {
    path: "/about/how-we-operate",
    title: "How We Operate | Response Integrity",
    description:
      "See how Response Integrity operates through two annual intakes, fixed conditioning cadence, execution-season discipline, and phase-aware academic performance conditioning.",
    jsonLd: buildAboutPageJsonLd(
      "/about/how-we-operate",
      "How We Operate",
      "Operational model for Response Integrity, including intake windows, conditioning cadence, execution-season standards, and anti-cramming discipline.",
    ),
    prerender: true,
    injectInSpa: false,
    includeInSitemap: true,
  },
  {
    path: "/about/how-we-teach",
    title: "How We Teach | Response Integrity",
    description:
      "Learn how Response Integrity teaches through clarity, structured execution, controlled discomfort, and pressure stability to build calm mathematical performance under difficulty.",
    jsonLd: buildAboutPageJsonLd(
      "/about/how-we-teach",
      "How We Teach",
      "Teaching and conditioning structure used by Response Integrity to build understanding, stable execution, and pressure-resistant performance.",
    ),
    prerender: true,
    injectInSpa: false,
    includeInSitemap: true,
  },
  {
    path: "/about/team",
    title: "Meet the Team | Response Integrity",
    description:
      "Meet the Response Integrity leadership team across marketing, human resources, operations, and technology.",
    jsonLd: buildAboutPageJsonLd(
      "/about/team",
      "Meet the Team",
      "Meet the Response Integrity leadership team across marketing, human resources, operations, and technology.",
    ),
    prerender: true,
    injectInSpa: false,
    includeInSitemap: true,
  },
  {
    path: "/operational/specialist/landing",
    title: "Become a Response Integrity Specialist | Operator Certification",
    description:
      "Apply to become a Response Integrity specialist through the defined operator certification cycle built around structure, standards, and real student responsibility.",
    prerender: true,
    injectInSpa: true,
    includeInSitemap: true,
  },
  {
    path: "/operational/td/landing",
    title: "Territory Director Access | Response Integrity",
    description:
      "Explore the Response Integrity Territory Director role for operators who can protect standards, correct drift early, and lead with clear judgment.",
    prerender: true,
    injectInSpa: true,
    includeInSitemap: true,
  },
  {
    path: "/affiliate/landing",
    title: "Education Growth Partner Access | Response Integrity",
    description:
      "Learn about the Response Integrity Education Growth Partner role for disciplined operators who qualify families accurately and protect placement quality.",
    prerender: true,
    injectInSpa: true,
    includeInSitemap: true,
  },
  {
    path: "/earlyinterventionreferralprogram",
    title: "Early Intervention Referral Program | Response Integrity",
    description:
      "See how Response Integrity helps schools identify and support capable learners whose response patterns collapse under pressure before those habits harden.",
    prerender: true,
    injectInSpa: true,
    includeInSitemap: true,
  },
  {
    path: "/leadershipdevelopmentpilot",
    title: "Leadership Development Pilot | Response Integrity",
    description:
      "Discover Response Integrity's leadership development pilot that trains high-potential students into real academic response-conditioning leaders.",
    prerender: true,
    injectInSpa: true,
    includeInSitemap: true,
  },
  {
    path: "/landing",
    title: "Legacy Landing | Response Integrity",
    description: "Legacy marketing landing for Response Integrity.",
    robots: "noindex, nofollow",
    injectInSpa: true,
    includeInSitemap: false,
  },
  {
    path: "/onlinetutors-wanted",
    title: "Legacy Specialist Recruitment | Response Integrity",
    description: "Legacy specialist recruitment landing retained for compatibility.",
    robots: "noindex, nofollow",
    injectInSpa: true,
    includeInSitemap: false,
  },
  {
    path: "/onlinetutorswanted",
    title: "Legacy Specialist Recruitment | Response Integrity",
    description: "Legacy specialist recruitment landing retained for compatibility.",
    robots: "noindex, nofollow",
    injectInSpa: true,
    includeInSitemap: false,
  },
  {
    path: "/operational/landing",
    title: "Operational Roles | Response Integrity",
    description: "Operational role landing for Response Integrity.",
    robots: "noindex, nofollow",
    injectInSpa: true,
    includeInSitemap: false,
  },
  {
    path: "/executive",
    title: "Executive Portal | Response Integrity",
    description: "Executive access portal for Response Integrity.",
    robots: "noindex, nofollow",
    injectInSpa: true,
    includeInSitemap: false,
  },
  {
    path: "/executive/landing",
    title: "Executive Portal | Response Integrity",
    description: "Executive access portal for Response Integrity.",
    robots: "noindex, nofollow",
    injectInSpa: true,
    includeInSitemap: false,
  },
  {
    path: "/responseconditioningsystem",
    title: "Response Integrity OS | Internal Operating Material",
    description:
      "Internal operating material for Response Integrity tutors and system operators.",
    robots: "noindex, nofollow",
    injectInSpa: true,
    includeInSitemap: false,
    matchMode: "prefix",
  },
  {
    path: "/client",
    title: "Client Access | Response Integrity",
    description: "Client intake, gateway, and account access for Response Integrity.",
    robots: "noindex, nofollow",
    injectInSpa: true,
    includeInSitemap: false,
    matchMode: "prefix",
  },
  {
    path: "/student",
    title: "Student Access | Response Integrity",
    description: "Student access route for Response Integrity.",
    robots: "noindex, nofollow",
    injectInSpa: true,
    includeInSitemap: false,
    matchMode: "prefix",
  },
  {
    path: "/auth",
    title: "Account Access | Response Integrity",
    description: "Secure account access for Response Integrity.",
    robots: "noindex, nofollow",
    injectInSpa: true,
    includeInSitemap: false,
    matchMode: "prefix",
  },
  {
    path: "/login",
    title: "Account Access | Response Integrity",
    description: "Secure account access for Response Integrity.",
    robots: "noindex, nofollow",
    injectInSpa: true,
    includeInSitemap: false,
  },
  {
    path: "/signup",
    title: "Account Signup | Response Integrity",
    description: "Account signup flow for Response Integrity.",
    robots: "noindex, nofollow",
    injectInSpa: true,
    includeInSitemap: false,
  },
  {
    path: "/forgot-password",
    title: "Password Reset | Response Integrity",
    description: "Password reset flow for Response Integrity.",
    robots: "noindex, nofollow",
    injectInSpa: true,
    includeInSitemap: false,
  },
  {
    path: "/reset-password",
    title: "Reset Password | Response Integrity",
    description: "Password recovery flow for Response Integrity.",
    robots: "noindex, nofollow",
    injectInSpa: true,
    includeInSitemap: false,
  },
  {
    path: "/operational/signup",
    title: "Operational Signup | Response Integrity",
    description: "Operational account signup flow for Response Integrity.",
    robots: "noindex, nofollow",
    injectInSpa: true,
    includeInSitemap: false,
    matchMode: "prefix",
  },
  {
    path: "/operational/tutor/intake",
    title: "Legacy Specialist Intake | Response Integrity",
    description: "Legacy specialist intake access for Response Integrity.",
    robots: "noindex, nofollow",
    injectInSpa: true,
    includeInSitemap: false,
  },
  {
    path: "/operational/specialist/intake",
    title: "Specialist Intake | Response Integrity",
    description: "Specialist intake access for Response Integrity.",
    robots: "noindex, nofollow",
    injectInSpa: true,
    includeInSitemap: false,
  },
  {
    path: "/operational/tutor/gateway",
    title: "Legacy Specialist Gateway | Response Integrity",
    description: "Legacy specialist gateway access for Response Integrity.",
    robots: "noindex, nofollow",
    injectInSpa: true,
    includeInSitemap: false,
  },
  {
    path: "/operational/specialist/gateway",
    title: "Specialist Gateway | Response Integrity",
    description: "Specialist gateway access for Response Integrity.",
    robots: "noindex, nofollow",
    injectInSpa: true,
    includeInSitemap: false,
  },
  {
    path: "/operational/td/gateway",
    title: "TD Gateway | Response Integrity",
    description: "Territory Director gateway access for Response Integrity.",
    robots: "noindex, nofollow",
    injectInSpa: true,
    includeInSitemap: false,
  },
  {
    path: "/operational/td/signup",
    title: "TD Signup | Response Integrity",
    description: "Territory Director signup flow for Response Integrity.",
    robots: "noindex, nofollow",
    injectInSpa: true,
    includeInSitemap: false,
  },
  {
    path: "/affiliate/gateway",
    title: "Affiliate Gateway | Response Integrity",
    description: "Affiliate gateway access for Response Integrity.",
    robots: "noindex, nofollow",
    injectInSpa: true,
    includeInSitemap: false,
  },
  {
    path: "/affiliate/signup",
    title: "Affiliate Signup | Response Integrity",
    description: "Affiliate signup flow for Response Integrity.",
    robots: "noindex, nofollow",
    injectInSpa: true,
    includeInSitemap: false,
  },
  {
    path: "/executive/signup",
    title: "Executive Signup | Response Integrity",
    description: "Executive signup flow for Response Integrity.",
    robots: "noindex, nofollow",
    injectInSpa: true,
    includeInSitemap: false,
  },
  {
    path: "/media",
    title: "Media Portal | Response Integrity",
    description: "Internal media tooling for Response Integrity.",
    robots: "noindex, nofollow",
    injectInSpa: true,
    includeInSitemap: false,
    matchMode: "prefix",
  },
  {
    path: "/aboutTT",
    title: "Legacy About Route | Response Integrity",
    description: "Legacy about route retained for compatibility.",
    robots: "noindex, nofollow",
    injectInSpa: true,
    includeInSitemap: false,
  },
  {
    path: "/foundingtutorswanted",
    title: "Legacy Specialist Recruitment Route | Response Integrity",
    description: "Legacy specialist recruitment route retained for compatibility.",
    robots: "noindex, nofollow",
    injectInSpa: true,
    includeInSitemap: false,
  },
  {
    path: "/tutor/landing",
    title: "Legacy Specialist Landing | Response Integrity",
    description: "Legacy specialist landing retained for compatibility.",
    robots: "noindex, nofollow",
    injectInSpa: true,
    includeInSitemap: false,
  },
  {
    path: "/td/landing",
    title: "Legacy TD Landing | Response Integrity",
    description: "Legacy Territory Director landing retained for compatibility.",
    robots: "noindex, nofollow",
    injectInSpa: true,
    includeInSitemap: false,
  },
  {
    path: "/td/signup",
    title: "Legacy TD Signup | Response Integrity",
    description: "Legacy Territory Director signup retained for compatibility.",
    robots: "noindex, nofollow",
    injectInSpa: true,
    includeInSitemap: false,
  },
];

export function getRouteSeoDefinition(pathname: string) {
  const normalizedPathname = normalizeSeoPath(pathname);
  const exactMatch = routeSeoDefinitions.find(
    (definition) =>
      (definition.matchMode ?? "exact") === "exact" && definition.path === normalizedPathname,
  );

  if (exactMatch) {
    return exactMatch;
  }

  return routeSeoDefinitions.find(
    (definition) =>
      definition.matchMode === "prefix" && normalizedPathname.startsWith(definition.path),
  );
}

export const prerenderableRouteSeoDefinitions = routeSeoDefinitions.filter(
  (definition) => definition.prerender,
);

export const sitemapPaths = [
  ...new Set([
    ...routeSeoDefinitions
      .filter((definition) => definition.includeInSitemap)
      .map((definition) => definition.path),
    ...STATIC_SITEMAP_PATHS,
  ]),
];
