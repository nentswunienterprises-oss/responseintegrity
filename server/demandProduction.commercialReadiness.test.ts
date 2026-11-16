import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import {
  COMMERCIAL_PURCHASING_PRIORITIES,
  RI_COMMERCIAL_PRESENTATION,
  RI_MEETING_CLOSURE,
  RI_EXPLANATION_VERSION,
  RI_EXPLANATION_QUESTIONS,
  isRiExplanationEvidenceComplete,
} from "../shared/demandProduction";
import { updateDemandProduction } from "./demandProduction";
import { isParentQualificationAssessmentComplete } from "../shared/demandProduction";

test("Part 4 defines the approved commercial interview and all three actual RI prices", () => {
  assert.deepEqual(COMMERCIAL_PURCHASING_PRIORITIES, [
    "Improved marks",
    "Individual attention",
    "A dependable person",
    "Evidence of improvement",
    "Affordability",
    "Flexibility or convenience",
  ]);
  assert.match(RI_COMMERCIAL_PRESENTATION, /8 sessions[\s\S]*R1,600/);
  assert.match(RI_COMMERCIAL_PRESENTATION, /12 sessions[\s\S]*R2,400/);
  assert.match(RI_COMMERCIAL_PRESENTATION, /16 sessions[\s\S]*R3,200/);
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


test("terminal qualification decisions require complete, saved, question-level evidence from all four parts", async () => {
  const complete = {
    parentExperience: { responses: Object.fromEntries(Array.from({ length: 8 }, (_, index) => [`experience_${index + 1}`, "Recorded answer"])) },
    supportPreferences: { responses: Object.fromEntries(Array.from({ length: 11 }, (_, index) => [`support_${index + 1}`, "Recorded answer"])) },
    riExplanation: { scriptPresented: true, explanationVersion: RI_EXPLANATION_VERSION, responses: { ri_session_expectation: "They practise responses through reps.", ri_stuck_expectation: "The Specialist observes and trains the breakdown." } },
    commercialReadiness: {
      responses: {
        existing_expenditure: "no",
        no_expenditure_reason: "No suitable option found",
        commercial_priorities: JSON.stringify(["Individual attention"]),
        decision_authority: "Joint decision",
        budget_considered: "no",
        budget_information_needed: "Evidence of improvement",
        price_response: "The price is manageable",
        continuing_commitment: "Yes, three months",
      },
      pricePresentationDelivered: true,
      meetingClosureDelivered: true,
    },
  };
  assert.equal(isParentQualificationAssessmentComplete(complete), true);
  assert.equal(isParentQualificationAssessmentComplete({
    ...complete,
    commercialReadiness: { ...complete.commercialReadiness, pricePresentationDelivered: false },
  }), false);

  let decisionRpcCalled = false;
  const client = {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: { qualification_assessment: { ...complete, commercialReadiness: { ...complete.commercialReadiness, meetingClosureDelivered: false } }, demand_flow_version: 1, is_sandbox_account: false, qualification_completed_at: null }, error: null }),
        }),
      }),
    }),
    rpc: async () => { decisionRpcCalled = true; return { data: {}, error: null }; },
  };
  await assert.rejects(
    updateDemandProduction(client, "enrollment-1", "coo", {
      action: "qualification",
      status: "qualified",
      ownerId: "coo",
      note: "Reviewed",
    }),
    /Complete and save all four approved qualification sections/,
  );
  assert.equal(decisionRpcCalled, false);
});

test("Part 3 requires both separately recorded understanding answers and approved script delivery", () => {
  const responses = {
    ri_session_expectation: "My child practises specific responses through repeated mathematical attempts.",
    ri_stuck_expectation: "The Specialist first observes the difficulty rather than just supplying an answer.",
  };
  const base = { scriptPresented: true, explanationVersion: RI_EXPLANATION_VERSION, responses };
  assert.equal(RI_EXPLANATION_QUESTIONS.length, 2);
  assert.equal(isRiExplanationEvidenceComplete(base), true);
  assert.equal(isRiExplanationEvidenceComplete({ ...base, scriptPresented: false }), false);
  assert.equal(isRiExplanationEvidenceComplete({ ...base, responses: { ...responses, ri_stuck_expectation: "" } }), false);
  assert.equal(isRiExplanationEvidenceComplete({ scriptPresented: true, responses: { ri_parent_response: "Legacy answer" } }), false);
});

test("Part 3 UI has distinct response capture, explanation provenance and historical record visibility", async () => {
  const source = await readFile(new URL("../client/src/components/executive/DemandReview.tsx", import.meta.url), "utf8");
  assert.match(source, /RI_EXPLANATION_QUESTIONS\.map/);
  assert.match(source, /isRiExplanationEvidenceComplete\(item\)/);
  assert.match(source, /explanationVersion: presented \? RI_EXPLANATION_VERSION/);
  assert.match(source, /Legacy parent response/);
  assert.match(source, /clarify misunderstandings without examining the parent/);
});
