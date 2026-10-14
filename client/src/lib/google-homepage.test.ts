import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const homepagePath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../public/google-homepage.html");
const homepage = fs.readFileSync(homepagePath, "utf8");
const trackingScript = homepage
  .slice(homepage.lastIndexOf("<script>") + "<script>".length, homepage.lastIndexOf("</script>"))
  .trim();

function landingSignupHrefs(search: string) {
  const links = Array.from({ length: 3 }, () => ({
    href: "/client/signup",
    setAttribute(name: string, value: string) {
      if (name === "href") this.href = value;
    },
  }));
  const document = {
    getElementById: () => ({ textContent: "" }),
    querySelectorAll: () => links,
  };
  const context = {
    URLSearchParams,
    window: { location: { search } },
    document,
  };

  vm.runInNewContext(trackingScript, context);
  return links.map((link) => link.href);
}

function expectedEntryPath(query: string) {
  const params = new URLSearchParams(query);
  const path = params.get("pipeline") === "capacity" ? "/operational/specialist/landing" : "/client/signup";
  return `${path}?${params.toString()}`;
}

test("landing demand Production Link reaches every signup CTA", () => {
  const hrefs = landingSignupHrefs("?production=AFIX123&pipeline=demand");
  assert.deepEqual(hrefs, Array(3).fill(expectedEntryPath("production=AFIX123&pipeline=demand")));
});

test("landing capacity Production Link reaches every signup CTA", () => {
  const hrefs = landingSignupHrefs("?production=CAP001&pipeline=capacity");
  assert.deepEqual(hrefs, Array(3).fill(expectedEntryPath("production=CAP001&pipeline=capacity")));
});

test("landing preserves legacy affiliate attribution", () => {
  const hrefs = landingSignupHrefs("?affiliate=AFIX123");
  assert.deepEqual(hrefs, Array(3).fill(expectedEntryPath("affiliate=AFIX123")));
});

test("landing preserves UTM attribution with a Production Link", () => {
  const hrefs = landingSignupHrefs(
    "?production=AFIX123&pipeline=demand&utm_source=instagram&utm_campaign=sept-pilot",
  );
  assert.deepEqual(
    hrefs,
    Array(3).fill(
      expectedEntryPath(
        "production=AFIX123&pipeline=demand&utm_source=instagram&utm_campaign=sept-pilot",
      ),
    ),
  );
});

test("landing preserves UTM attribution through the capacity specialist entry", () => {
  const hrefs = landingSignupHrefs(
    "?production=CAP001&pipeline=capacity&utm_source=instagram&utm_campaign=sept-pilot",
  );
  assert.deepEqual(
    hrefs,
    Array(3).fill(
      expectedEntryPath(
        "production=CAP001&pipeline=capacity&utm_source=instagram&utm_campaign=sept-pilot",
      ),
    ),
  );
});

test("public homepage exposes company-first Google search title and clear identity", () => {
  const spa = fs.readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../index.html"), "utf8");
  const expectedTitle = "Response Integrity | Calm Execution Under Pressure";
  for (const page of [homepage, spa]) {
    assert.match(page, /<title>Response Integrity \| Calm Execution Under Pressure<\/title>/);
    assert.match(page, /<meta\s+name="description"\s+content="Response Integrity is a conditioning-based academic performance system/);
    assert.match(page, /<link rel="canonical" href="https:\/\/responseintegrity\.co\.za\/"\s*\/>/);
    assert.match(page, /<meta property="og:title" content="Response Integrity \| Calm Execution Under Pressure"/);
    assert.match(page, /<meta property="og:site_name" content="Response Integrity"/);
    assert.match(page, /"name": "Response Integrity"/);
    assert.doesNotMatch(page, /alt="Response Integrity symbol"/);
  }
  assert.match(homepage, /<h1>Response Integrity: Calm Execution/);
  assert.match(spa, /<h1 class="logo">/);
  assert.equal(expectedTitle, "Response Integrity | Calm Execution Under Pressure");
});
