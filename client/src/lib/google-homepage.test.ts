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
  const links = Array.from({ length: 3 }, () => ({ href: "/client/signup" }));
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

function expectedSignupPath(query: string) {
  return `/client/signup?${new URLSearchParams(query).toString()}`;
}

test("landing demand Production Link reaches every signup CTA", () => {
  const hrefs = landingSignupHrefs("?production=AFIX123&pipeline=demand");
  assert.deepEqual(hrefs, Array(3).fill(expectedSignupPath("production=AFIX123&pipeline=demand")));
});

test("landing capacity Production Link reaches every signup CTA", () => {
  const hrefs = landingSignupHrefs("?production=CAP001&pipeline=capacity");
  assert.deepEqual(hrefs, Array(3).fill(expectedSignupPath("production=CAP001&pipeline=capacity")));
});

test("landing preserves legacy affiliate attribution", () => {
  const hrefs = landingSignupHrefs("?affiliate=AFIX123");
  assert.deepEqual(hrefs, Array(3).fill(expectedSignupPath("affiliate=AFIX123")));
});

test("landing preserves UTM attribution with a Production Link", () => {
  const hrefs = landingSignupHrefs(
    "?production=AFIX123&pipeline=demand&utm_source=instagram&utm_campaign=sept-pilot",
  );
  assert.deepEqual(
    hrefs,
    Array(3).fill(
      expectedSignupPath(
        "production=AFIX123&pipeline=demand&utm_source=instagram&utm_campaign=sept-pilot",
      ),
    ),
  );
});
