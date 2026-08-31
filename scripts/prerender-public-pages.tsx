import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import React from "react";
import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import AboutIndex from "../client/src/pages/about/index";
import WhoWeAre from "../client/src/pages/about/who-we-are";
import HowWeOperate from "../client/src/pages/about/how-we-operate";
import HowWeTeach from "../client/src/pages/about/how-we-teach";
import TeamPage from "../client/src/pages/about/team";
import TutorLanding from "../client/src/pages/operational/tutor/landing";
import TdLanding from "../client/src/pages/operational/td/landing";
import AffiliateLanding from "../client/src/pages/affiliate/landing";
import EarlyInterventionReferralProgram from "../client/src/pages/earlyinterventionreferralprogram";
import LeadershipDevelopmentPilot from "../client/src/pages/leadershipdevelopmentpilot";
import {
  DEFAULT_SOCIAL_IMAGE_ALT,
  DEFAULT_SOCIAL_IMAGE_PATH,
  SITE_NAME,
  prerenderableRouteSeoDefinitions,
  toAbsoluteSiteUrl,
  type RouteSeoDefinition,
} from "../client/src/lib/publicSeo";

const COMPONENT_BY_PATH = {
  "/about": AboutIndex,
  "/about/who-we-are": WhoWeAre,
  "/about/how-we-operate": HowWeOperate,
  "/about/how-we-teach": HowWeTeach,
  "/about/team": TeamPage,
  "/operational/specialist/landing": TutorLanding,
  "/operational/tutor/landing": TutorLanding,
  "/operational/td/landing": TdLanding,
  "/affiliate/landing": AffiliateLanding,
  "/earlyinterventionreferralprogram": EarlyInterventionReferralProgram,
  "/leadershipdevelopmentpilot": LeadershipDevelopmentPilot,
} satisfies Record<string, React.ComponentType>;

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function upsertTitle(html: string, title: string) {
  const escapedTitle = escapeHtml(title);
  if (/<title>[\s\S]*?<\/title>/i.test(html)) {
    return html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapedTitle}</title>`);
  }

  return html.replace("</head>", `    <title>${escapedTitle}</title>\n  </head>`);
}

function upsertMetaTag(
  html: string,
  selectorAttr: "name" | "property",
  selectorValue: string,
  content: string,
) {
  const escapedContent = escapeHtml(content);
  const pattern = new RegExp(
    `<meta[^>]+${selectorAttr}=["']${selectorValue.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["'][^>]*>`,
    "i",
  );
  const tag = `    <meta ${selectorAttr}="${selectorValue}" content="${escapedContent}" />`;

  if (pattern.test(html)) {
    return html.replace(pattern, tag.trim());
  }

  return html.replace("</head>", `${tag}\n  </head>`);
}

function upsertCanonicalLink(html: string, href: string) {
  const escapedHref = escapeHtml(href);
  const pattern = /<link[^>]+rel=["']canonical["'][^>]*>/i;
  const tag = `    <link rel="canonical" href="${escapedHref}" />`;

  if (pattern.test(html)) {
    return html.replace(pattern, tag.trim());
  }

  return html.replace("</head>", `${tag}\n  </head>`);
}

function upsertJsonLd(html: string, value: RouteSeoDefinition["jsonLd"]) {
  if (!value) {
    return html;
  }

  const payload = JSON.stringify(value).replace(/</g, "\\u003c");
  const pattern = /<script[^>]+data-ri-seo=["']json-ld["'][^>]*>[\s\S]*?<\/script>/i;
  const tag =
    `    <script type="application/ld+json" data-ri-seo="json-ld">${payload}</script>`;

  if (pattern.test(html)) {
    return html.replace(pattern, tag.trim());
  }

  return html.replace("</head>", `${tag}\n  </head>`);
}

function injectRootMarkup(html: string, markup: string) {
  const rootMarkup = `<div id="root" data-ri-prerendered="true">${markup}</div>`;
  const loaderAndRootPattern =
    /<div id="root-loader">[\s\S]*<div id="root"><\/div>/i;

  if (loaderAndRootPattern.test(html)) {
    return html.replace(loaderAndRootPattern, rootMarkup);
  }

  const withoutLoader = html.replace(/<div id="root-loader">[\s\S]*?<\/div>/i, "");
  return withoutLoader.replace(/<div id="root"><\/div>/i, rootMarkup);
}

function renderRouteHtml(template: string, definition: RouteSeoDefinition, markup: string) {
  const image = definition.image ?? DEFAULT_SOCIAL_IMAGE_PATH;
  const imageAlt = definition.imageAlt ?? DEFAULT_SOCIAL_IMAGE_ALT;
  const twitterCard = definition.twitterCard ?? "summary_large_image";
  const robots = definition.robots ?? "index, follow";
  const canonicalUrl = toAbsoluteSiteUrl(definition.path);
  const imageUrl = toAbsoluteSiteUrl(image);

  let html = template;
  html = upsertTitle(html, definition.title);
  html = upsertMetaTag(html, "name", "description", definition.description);
  html = upsertMetaTag(html, "name", "robots", robots);
  html = upsertMetaTag(html, "property", "og:title", definition.title);
  html = upsertMetaTag(html, "property", "og:description", definition.description);
  html = upsertMetaTag(html, "property", "og:type", definition.type ?? "website");
  html = upsertMetaTag(html, "property", "og:url", canonicalUrl);
  html = upsertMetaTag(html, "property", "og:site_name", SITE_NAME);
  html = upsertMetaTag(html, "property", "og:image", imageUrl);
  html = upsertMetaTag(html, "property", "og:image:alt", imageAlt);
  html = upsertMetaTag(html, "name", "twitter:card", twitterCard);
  html = upsertMetaTag(html, "name", "twitter:title", definition.title);
  html = upsertMetaTag(html, "name", "twitter:description", definition.description);
  html = upsertMetaTag(html, "name", "twitter:image", imageUrl);
  html = upsertMetaTag(html, "name", "twitter:image:alt", imageAlt);
  html = upsertCanonicalLink(html, canonicalUrl);
  html = upsertJsonLd(html, definition.jsonLd);
  html = injectRootMarkup(html, markup);

  return `${html.trim()}\n`;
}

function getOutputPath(distDir: string, routePath: string) {
  if (routePath === "/") {
    return path.join(distDir, "index.html");
  }

  return path.join(distDir, routePath.slice(1), "index.html");
}

async function main() {
  const scriptPath = fileURLToPath(import.meta.url);
  const rootDir = path.resolve(path.dirname(scriptPath), "..");
  const distDir = path.join(rootDir, "dist");
  const templatePath = path.join(distDir, "index.html");
  const template = await readFile(templatePath, "utf8");

  for (const definition of prerenderableRouteSeoDefinitions) {
    const Component = COMPONENT_BY_PATH[definition.path as keyof typeof COMPONENT_BY_PATH];

    if (!Component) {
      throw new Error(`No prerender component registered for ${definition.path}`);
    }

    const markup = renderToString(
      <MemoryRouter initialEntries={[definition.path]}>
        <Component />
      </MemoryRouter>,
    );
    const renderedHtml = renderRouteHtml(template, definition, markup);
    const outputPath = getOutputPath(distDir, definition.path);

    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, renderedHtml, "utf8");
    console.log(`Prerendered ${path.relative(rootDir, outputPath)}`);
  }
}

main().catch((error) => {
  console.error("Failed to prerender public pages.");
  console.error(error);
  process.exitCode = 1;
});
