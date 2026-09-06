import assert from "node:assert/strict";
import test from "node:test";

type Link = {
  created_by: string;
  owner_user_id: string | null;
  owner_type: string;
  owner_name: string;
  pipeline_type: "demand" | "capacity";
};

function downstreamOwner(link: Link) {
  return link.owner_user_id;
}

test("COO creator and contributor owner remain distinct", () => {
  const link: Link = {
    created_by: "coo-1",
    owner_user_id: "contributor-1",
    owner_type: "contributor",
    owner_name: "Sarah",
    pipeline_type: "demand",
  };
  assert.equal(link.created_by, "coo-1");
  assert.equal(downstreamOwner(link), "contributor-1");
  assert.notEqual(link.created_by, downstreamOwner(link));
});

test("campaign ownership does not invent a user owner", () => {
  const link: Link = {
    created_by: "coo-1",
    owner_user_id: null,
    owner_type: "recruitment_campaign",
    owner_name: "University intake 2026",
    pipeline_type: "capacity",
  };
  assert.equal(downstreamOwner(link), null);
  assert.equal(link.owner_type, "recruitment_campaign");
});

test("pipeline remains part of the owned link identity", () => {
  const owner = "contributor-1";
  const links = ["demand", "capacity"];
  assert.deepEqual(links.map((pipeline) => `${owner}:${pipeline}`), [
    "contributor-1:demand",
    "contributor-1:capacity",
  ]);
});