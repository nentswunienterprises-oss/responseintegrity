import type { SandboxSimulationDefinition } from "./capabilitySandboxSimulation";

// Public design fixture only. Live Sandbox simulation banks must remain private
// because the definition includes scoring keys and explanations.
export const SANDBOX_SIMULATION_DESIGN_FIXTURE_V1: SandboxSimulationDefinition = {
  key: "cross_module_foundation_fixture_v1",
  version: 1,
  title: "Cross-Module Sandbox Simulation - Design Fixture",
  description:
    "A fictional rehearsal that crosses transformation and session-infrastructure decisions without using real student data.",
  fictionalScenarioConfirmed: true,
  passThresholdPercent: 80,
  decisions: [
    {
      key: "clarity_identification_boundary",
      deepDiveKey: "clarity",
      competencyKey: "clarity.recognition_boundary",
      prompt:
        "The active Clarity rep is Identification only. The fictional student starts calculating instead of naming the type and method. What should the Specialist do?",
      kind: "single_choice",
      options: [
        { key: "preserve", label: "Stop the calculation and return the rep to recognition only" },
        { key: "continue", label: "Let the calculation continue because it may produce a correct answer" },
        { key: "mark_clear", label: "Mark the rep clear because the student appears confident" },
      ],
      correctOptionKeys: ["preserve"],
      criticalFailOptionKeys: ["mark_clear"],
      criticalBoundaryKeys: ["clarity.identification_no_solving"],
      riskOptionKeys: {
        evidence_contamination: ["continue", "mark_clear"],
      },
      explanation:
        "Identification must remain recognition-only. Solving changes the condition being observed, and marking that contaminated rep clear is a critical integrity failure.",
    },
    {
      key: "structured_no_help_boundary",
      deepDiveKey: "structured_execution",
      competencyKey: "structured_execution.independent_execution",
      prompt:
        "During a no-help Independent Execution rep, the fictional student pauses after the first step. What should the Specialist do?",
      kind: "single_choice",
      options: [
        { key: "observe", label: "Preserve the no-help condition and observe whether the student can continue" },
        { key: "prompt", label: "Give the next step immediately to keep the student moving" },
        { key: "rewrite", label: "Prompt the next step, then record the rep as independent if the answer is correct" },
      ],
      correctOptionKeys: ["observe"],
      criticalFailOptionKeys: ["rewrite"],
      criticalBoundaryKeys: ["structured_execution.no_support_independent_execution"],
      riskOptionKeys: {
        evidence_contamination: ["prompt", "rewrite"],
      },
      explanation:
        "The pause is part of the evidence. Assistance changes the evidentiary meaning of the rep and cannot be hidden afterward.",
    },
    {
      key: "controlled_discomfort_no_rescue_boundary",
      deepDiveKey: "controlled_discomfort",
      competencyKey: "controlled_discomfort.no_rescue_boundary",
      prompt:
        "The fictional student reaches a controlled-difficulty problem, says they are stuck, and asks the Specialist to show the whole solution. The active condition permits first-step support only. What is the strongest response?",
      kind: "single_choice",
      options: [
        { key: "first_step", label: "Use only the permitted first-step support, then return responsibility to the student" },
        { key: "full_rescue", label: "Model the complete solution so the student does not become uncomfortable" },
        { key: "lower_difficulty", label: "Replace the assigned problem with an easier one immediately" },
      ],
      correctOptionKeys: ["first_step"],
      criticalFailOptionKeys: ["full_rescue"],
      criticalBoundaryKeys: ["controlled_discomfort.no_full_rescue"],
      riskOptionKeys: {
        evidence_contamination: ["full_rescue"],
      },
      explanation:
        "Controlled Discomfort preserves the assigned difficulty and support boundary. Full rescue destroys the response condition being tested.",
    },
    {
      key: "logging_observation_integrity",
      deepDiveKey: "logging_system",
      competencyKey: "evidence.observation_vs_inference",
      prompt:
        "The fictional student pauses for 11 seconds, rereads the expression twice, then names the wrong operation. Which log entry should be preserved?",
      kind: "single_choice",
      options: [
        { key: "observed", label: "Paused 11 seconds, reread twice, then named the wrong operation" },
        { key: "anxious", label: "Student was anxious and lost confidence" },
        { key: "improved", label: "Student understood eventually, so record the rep as clear" },
      ],
      correctOptionKeys: ["observed"],
      criticalFailOptionKeys: ["improved"],
      criticalBoundaryKeys: ["logging.record_actual_behavior"],
      riskOptionKeys: {
        evidence_contamination: ["anxious", "improved"],
      },
      explanation:
        "RI logs observable behaviour. Psychological inference and retroactive smoothing cannot replace the actual rep evidence.",
    },
    {
      key: "session_flow_system_authority",
      deepDiveKey: "session_flow_control",
      competencyKey: "session_flow.system_selected_drill",
      prompt:
        "The fictional session opens with a system-selected Verification drill, but the Specialist personally prefers a Training drill for this student. What should happen?",
      kind: "single_choice",
      options: [
        { key: "follow_system", label: "Run the system-selected Verification drill and preserve its defined constraints" },
        { key: "override", label: "Replace it with Training because the Specialist knows the student better" },
        { key: "silent_override", label: "Run Training but submit the session as though Verification was followed" },
      ],
      correctOptionKeys: ["follow_system"],
      criticalFailOptionKeys: ["silent_override"],
      criticalBoundaryKeys: ["session_flow.no_manual_drill_override"],
      riskOptionKeys: {
        authority_violation: ["override", "silent_override"],
        evidence_contamination: ["silent_override"],
      },
      explanation:
        "The Specialist executes the system-selected drill. Personal preference cannot silently replace system authority or alter the evidence record.",
    },
  ],
};
