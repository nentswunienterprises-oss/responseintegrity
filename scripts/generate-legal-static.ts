import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  publicLegalDocuments,
  type LegalDocumentDefinition,
  type LegalSection,
} from "../client/src/lib/legalDocuments";

const SITE_ORIGIN = "https://responseintegrity.co.za";
const SOCIAL_IMAGE_URL = `${SITE_ORIGIN}/images/Benefits-of-Online-Tutoring-1-1080x589.png`;
const SOCIAL_IMAGE_ALT = "Response Integrity response-training";

const HTML_ESCAPE_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => HTML_ESCAPE_MAP[character] ?? character);
}

function renderParagraphs(paragraphs: string[] | undefined) {
  if (!paragraphs?.length) {
    return "";
  }

  return paragraphs.map((paragraph) => `          <p>${escapeHtml(paragraph)}</p>`).join("\n");
}

function renderBullets(bullets: string[] | undefined) {
  if (!bullets?.length) {
    return "";
  }

  const items = bullets
    .map((bullet) => `              <li>${escapeHtml(bullet)}</li>`)
    .join("\n");

  return `          <ul>\n${items}\n          </ul>`;
}

function renderSection(section: LegalSection) {
  const paragraphs = renderParagraphs(section.paragraphs);
  const bullets = renderBullets(section.bullets);
  const body = [paragraphs, bullets].filter(Boolean).join("\n");

  return [
    "          <section>",
    `            <h2>${escapeHtml(section.title)}</h2>`,
    body,
    "          </section>",
  ]
    .filter(Boolean)
    .join("\n");
}

function renderDocument(document: LegalDocumentDefinition) {
  const canonicalUrl = `${SITE_ORIGIN}${document.path}`;
  const subtitle = document.metaItems.map(escapeHtml).join(" | ");
  const footer = document.footerItems.map(escapeHtml).join(" | ");
  const intro = renderParagraphs(document.introParagraphs);
  const sections = document.sections.map(renderSection).join("\n\n");

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1" />
    <title>${escapeHtml(document.title)}</title>
    <meta
      name="description"
      content="${escapeHtml(document.description)}"
    />
    <meta name="robots" content="index, follow" />
    <meta property="og:title" content="${escapeHtml(document.title)}" />
    <meta property="og:description" content="${escapeHtml(document.description)}" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${escapeHtml(canonicalUrl)}" />
    <meta property="og:site_name" content="Response Integrity" />
    <meta property="og:image" content="${escapeHtml(SOCIAL_IMAGE_URL)}" />
    <meta property="og:image:alt" content="${escapeHtml(SOCIAL_IMAGE_ALT)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(document.title)}" />
    <meta name="twitter:description" content="${escapeHtml(document.description)}" />
    <meta name="twitter:image" content="${escapeHtml(SOCIAL_IMAGE_URL)}" />
    <meta name="twitter:image:alt" content="${escapeHtml(SOCIAL_IMAGE_ALT)}" />
    <link rel="canonical" href="${escapeHtml(canonicalUrl)}" />
    <link rel="icon" type="image/svg+xml" href="/ri-symbol-logo.svg?v=20260926-1" />
    <link rel="alternate icon" type="image/png" href="/favicon.png?v=20260926-1" />
    <link rel="apple-touch-icon" href="/apple-touch-icon.png?v=20260926-1" />
    <link rel="preconnect" href="https://fonts.googleapis.com" crossorigin />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
    <style>
      :root {
        --bg-top: #f8fafc;
        --bg-bottom: #f1f5f9;
        --card: #ffffff;
        --fg: #0f172a;
        --muted: #475569;
        --soft: #e2e8f0;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        font-family: "Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        color: var(--fg);
        background: linear-gradient(to bottom, var(--bg-top), var(--bg-bottom));
      }
      a { color: inherit; text-decoration: none; }
      .wrap { width: min(1024px, calc(100% - 32px)); margin: 0 auto; padding: 48px 0; }
      .back-link { display: inline-flex; align-items: center; gap: 8px; margin-bottom: 24px; font-size: 14px; }
      .back-link:hover { text-decoration: underline; }
      .card { border-radius: 16px; background: var(--card); box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08); overflow: hidden; }
      .card-head { padding: 32px 24px 0; text-align: center; }
      .card-head h1 { margin: 0; font-size: 36px; font-weight: 700; }
      .card-head p { margin: 8px 0 0; color: var(--muted); }
      .content { padding: 24px; line-height: 1.7; }
      .content section { margin-bottom: 32px; }
      .content h2 { margin: 0 0 16px; font-size: 28px; }
      .content p { margin: 0 0 16px; }
      .content ul { margin: 0 0 16px; padding-left: 24px; }
      .content li + li { margin-top: 4px; }
      .last-updated { margin-top: 48px; padding: 24px; border-radius: 12px; background: var(--soft); color: var(--muted); text-align: center; font-size: 14px; }
    </style>
  </head>
  <body>
    <div class="wrap">
      <a id="back-link" class="back-link" href="/"><span aria-hidden="true">&#8592;</span><span>Back</span></a>
      <article class="card">
        <header class="card-head">
          <h1>${escapeHtml(document.title)}</h1>
          <p>${subtitle}</p>
        </header>
        <div class="content">
${intro}

${sections}

          <div class="last-updated">${footer}</div>
        </div>
      </article>
    </div>
    <script>
      (function () {
        var params = new URLSearchParams(window.location.search);
        var returnTo = params.get("returnTo");
        if (!returnTo) return;
        if (returnTo.charAt(0) !== "/" || returnTo.indexOf("//") === 0) return;
        var backLink = document.getElementById("back-link");
        if (backLink) backLink.setAttribute("href", returnTo);
      })();
    </script>
  </body>
</html>
`;
}

async function main() {
  const scriptPath = fileURLToPath(import.meta.url);
  const rootDir = path.resolve(path.dirname(scriptPath), "..");
  const publicDir = path.join(rootDir, "client", "public");

  await mkdir(publicDir, { recursive: true });

  await Promise.all(
    publicLegalDocuments.map(async (document) => {
      const outputPath = path.join(publicDir, document.filename);
      await writeFile(outputPath, `${renderDocument(document)}\n`, "utf8");
      console.log(`Generated ${path.relative(rootDir, outputPath)}`);
    }),
  );
}

main().catch((error) => {
  console.error("Failed to generate legal static pages.");
  console.error(error);
  process.exitCode = 1;
});
