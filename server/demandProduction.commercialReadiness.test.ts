import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import {
  COMMERCIAL_PURCHASING_PRIORITIES,
  RI_COMMERCIAL_PRESENTATION,
  RI_MEETING_CLOSURE,
} from "../shared/demandProduction";
import { updateDemandProduction } from "./demandProduction";

test("Part 4 defines the approved commercial interview and all three actual RI prices", () => {
  assert.deepEqual(COMMERCIAL_PURCHASING_PRIORITIES, [
    "Improved marks",
    "Individual attention",
    "A dependable person",
    "Evidence of improvement",
    "Affordability",
    "Flexibility or convenience",
  ]);
  assert.match(RI_COMMERCIAL_PRESENTATION, /8 sessions[\s\S]*R1600/);
  assert.match(RI_COMMERCIAL_PRESENTATION, /12 sessions[\s\S]*R2400/);
  assert.match(RI_COMMERCIAL_PRESENTATION, /16 sessions[\s\S]*R3200/);
  assert.match(RI_COMMERCIAL_PRESENTATION, /R1,600 to R3,200/);
  assert.match(RI_MEETING_CLOSURE, /^Thank you for speaking with me/);
});

test("Part 4 assessment evidence is accepted and saved without collapsing individual responses", async () => {
  let received: any;
  const client = {
    rpc: async (name: string, args: any) => {
      received = { name, args };
      return { data: { id: "enrollment-1", qualification_assessment: args.p_assessment }, error: null };
    },
  };
  const assessment = {
    commercialReadiness: {
      responses: {
        existing_expenditure: "yes",
        expenditure_type: "Weekly mathematics lessons",
        expenditure_monthly_amount: "R1200",
        expenditure_worthwhile: "Individual attention",
        commercial_priorities: JSON.stringify(["Individual attention", "Evidence of improvement"]),
        decision_authority: "Both parents decide together",
        budget_considered: "yes",
        comfortable_monthly_range: "R1600-R2400",
        price_response: "The eight-session option is manageable",
        price_objection: "",
        continuing_commitment: "Yes, for three months",
      },
      pricePresentationDelivered: true,
      meetingClosureDelivered: true,
      interviewerObservation: "Parent considered the price options carefully.",
      followUp: "Confirm preferred start date.",
    },
  };
  const result = await updateDemandProduction(client, "enrollment-1", "coo", {
    action: "assessment",
    assessment,
  });
  assert.equal(received.name, "save_parent_qualification_assessment");
  assert.deepEqual(received.args.p_assessment, assessment);
  assert.equal(result.id, "enrollment-1");
});

test("Part 4 UI requires branch-specific evidence, actual price exposure and meeting closure", async () => {
  const source = await readFile(new URL("../client/src/components/executive/DemandReview.tsx", import.meta.url), "utf8");
  assert.match(source, /existing_expenditure === "yes"[\s\S]*expenditure_type[\s\S]*expenditure_monthly_amount[\s\S]*expenditure_worthwhile/);
  assert.match(source, /existing_expenditure === "no"[\s\S]*no_expenditure_reason/);
  assert.match(source, /selectedPriorities\.length > 0/);
  assert.match(source, /decision_authority/);
  assert.match(source, /budget_considered === "yes"[\s\S]*comfortable_monthly_range/);
  assert.match(source, /budget_considered === "no"[\s\S]*budget_information_needed/);
  assert.match(source, /pricePresentationDelivered && r\.price_response/);
  assert.match(source, /continuing_commitment/);
  assert.match(source, /meetingClosureDelivered/);
  assert.match(source, /PARENT_QUALIFICATION_SECTIONS\.filter\(sectionComplete\)/);
  assert.match(source, /Complete and save all four approved sections/);
});
