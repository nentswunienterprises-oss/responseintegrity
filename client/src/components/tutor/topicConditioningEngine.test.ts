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

  it("keeps High Maintenance in the current phase for the next drill", () => {
    assert.equal(nextActionFor("Clarity", "Low"), "Run Clarity drill");
    assert.equal(
      nextActionFor("Controlled Discomfort", "High Maintenance"),
      "Run Controlled Discomfort High Maintenance drill",
    );
    assert.equal(getNextActionData("Structured Execution", "High Maintenance").advanceTo, "Controlled Discomfort");
  });

  it("recommends movement logic without skipping High Maintenance evidence", () => {
    assert.equal(nextMoveRecommendation("Clarity", "High"), "Run High Maintenance check before advancing");
    assert.equal(
      nextMoveRecommendation("Clarity", "High Maintenance"),
      "Run Clarity High Maintenance check; strong evidence can advance to Structured Execution",
    );
    assert.equal(
      nextMoveRecommendation("Controlled Discomfort", "High Maintenance"),
      "Run Controlled Discomfort High Maintenance check; strong evidence can advance to Time Pressure Stability",
    );
    assert.equal(nextMoveRecommendation("Controlled Discomfort", "Low").includes("Reinforce Structured Execution"), true);
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
