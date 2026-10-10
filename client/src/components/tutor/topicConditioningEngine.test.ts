import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  getNextActionData,
  getPriorityReason,
  getRecommendationConfidence,
  nextActionFor,
  nextMoveRecommendation,
  topicPriorityScore,
  trendFromHistory,
} from "./topicConditioningEngine";

describe("topicConditioningEngine", () => {
  it("computes trend from history", () => {
    assert.equal(trendFromHistory(["Low", "Medium"]), "Improving");
    assert.equal(trendFromHistory(["High", "Medium"]), "Regressing");
    assert.equal(trendFromHistory(["High", "High"]), "Stable");
    assert.equal(trendFromHistory(["Low"]), "Holding");
    assert.equal(
      trendFromHistory(["High Maintenance", "Low"], ["Clarity", "Structured Execution"]),
      "Holding",
    );
  });

  it("scores topic priority with stability and trend", () => {
    const regressingLow = topicPriorityScore({ stability: "Low", trend: "Regressing" });
    const stableHigh = topicPriorityScore({ stability: "High", trend: "Stable" });
    assert.equal(regressingLow > stableHigh, true);
  });

  it("returns next action from engine", () => {
    assert.equal(nextActionFor("Clarity", "Low"), "Run Clarity drill");
    assert.equal(nextActionFor("Clarity", "High"), "Run Clarity drill");
    assert.equal(nextActionFor("Structured Execution", "High"), "Run Structured Execution drill");
    assert.equal(nextActionFor("Controlled Discomfort", "High"), "Run Controlled Discomfort drill");
    assert.equal(nextActionFor("Time Pressure Stability", "High"), "Run Time Pressure Stability drill");
    assert.equal(
      nextActionFor("Controlled Discomfort", "High Maintenance"),
      "Run Controlled Discomfort drill",
    );
    assert.equal(getNextActionData("Structured Execution", "High Maintenance").advanceTo, "Controlled Discomfort");
  });

  it("recommends movement logic", () => {
    assert.equal(nextMoveRecommendation("Clarity", "High"), "Continue Clarity training until qualifying repeatability is established");
    assert.equal(
      nextMoveRecommendation("Clarity", "High Maintenance"),
      "Confirm the phase-exit evidence in Clarity before advancing to Structured Execution",
    );
    assert.equal(nextMoveRecommendation("Controlled Discomfort", "Low").includes("Reinforce Structured Execution"), true);
  });

  it("distinguishes a high confirmation checkpoint from completed phase exit", () => {
    const checkpoint = getNextActionData("Clarity", "High Maintenance");
    assert.equal(checkpoint.advanceTo, "Structured Execution");
    assert.match(checkpoint.rules.join(" "), /later qualifying drill before phase exit/);
    assert.doesNotMatch(checkpoint.rules.join(" "), /High Maintenance/);

    assert.equal(
      nextMoveRecommendation("Time Pressure Stability", "High Maintenance"),
      "Maintain and transfer to new topics",
    );
    const high = getNextActionData("Clarity", "High");
    assert.match(high.rules.join(" "), /independently establish the progression checkpoint/);
  });

  it("explains priority reason", () => {
    assert.equal(getPriorityReason("Low", "Regressing").includes("regressing"), true);
    assert.equal(getPriorityReason("High", "Stable"), "High stability with stable trend");
  });

  it("provides recommendation confidence by log depth", () => {
    assert.equal(getRecommendationConfidence(0), "Low");
    assert.equal(getRecommendationConfidence(3), "Medium");
    assert.equal(getRecommendationConfidence(8), "High");
  });
});
