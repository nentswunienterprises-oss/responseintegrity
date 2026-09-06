import assert from "node:assert/strict";
import test from "node:test";
import { buildTrackedPath, resolveTrackedBackTarget } from "./publicTracking";

test("FAQ navigation preserves Production Link attribution", () => {
  assert.equal(
    buildTrackedPath("/faq", "?production=AFIX7RU1D0&pipeline=demand&utm_source=instagram", {
      returnTo: "/?production=AFIX7RU1D0&pipeline=demand&utm_source=instagram",
    }),
    "/faq?production=AFIX7RU1D0&pipeline=demand&utm_source=instagram&returnTo=%2F%3Fproduction%3DAFIX7RU1D0%26pipeline%3Ddemand%26utm_source%3Dinstagram",
  );
});

test("Team navigation preserves Capacity Production Link attribution", () => {
  assert.equal(
    buildTrackedPath("/about/team", "?production=CAP001&pipeline=capacity", {
      returnTo: "/?production=CAP001&pipeline=capacity",
    }),
    "/about/team?production=CAP001&pipeline=capacity&returnTo=%2F%3Fproduction%3DCAP001%26pipeline%3Dcapacity",
  );
});

test("tracked back targets preserve Production Link attribution", () => {
  assert.equal(
    resolveTrackedBackTarget("?production=AFIX123&pipeline=demand", "/about"),
    "/about?production=AFIX123&pipeline=demand",
  );
});
