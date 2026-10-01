import type { Express, Request, Response } from "express";
import { isAuthenticated } from "./supabaseAuth";
import { storage } from "./storage";
import {
  loadLatestTpsPassiveAttemptForSlot,
  loadLatestTpsTimedAttemptForSlot,
  loadLatestTpsTimerContract,
  loadTpsTimerContractById,
  persistTpsPassiveAttempt,
  persistTpsTimedAttempt,
} from "./tpsTimingAuthority";
import type {
  TpsPassiveAttemptSubmissionV1,
  TpsTimedAttemptSubmissionV1,
} from "../shared/tpsTimingContract";
import { TPS_TIMER_BASELINE_INCOMPLETE } from "../shared/tpsTrainingReadiness";

const clean = (value: unknown) => String(value ?? "").trim();

const requireSpecialist = (req: Request, res: Response) => {
  const dbUser = (req as any).dbUser;
  if (!dbUser?.id) {
    res.status(401).json({ message: "Authentication required." });
    return null;
  }
  if (clean(dbUser.role).toLowerCase() !== "tutor") {
    res.status(403).json({ message: "Specialist access required." });
    return null;
  }
  return dbUser;
};

const requireOwnedStudent = async (
  studentId: string,
  tutorId: string,
  res: Response,
) => {
  const student = await storage.getStudent(studentId);
  if (!student || String(student.tutorId || "") !== String(tutorId)) {
    res.status(403).json({
      message: "Unauthorized: Student does not belong to this Specialist.",
    });
    return null;
  }
  return student;
};

export function registerTpsTimingRoutes(app: Express) {
  app.get(
    "/api/tutor/students/:studentId/tps-timer-contract",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const specialist = requireSpecialist(req, res);
        if (!specialist) return;

        const studentId = clean(req.params.studentId);
        const topic = clean(req.query.topic);
        if (!studentId || !topic) {
          return res.status(400).json({ message: "studentId and topic are required." });
        }
        const student = await requireOwnedStudent(studentId, specialist.id, res);
        if (!student) return;

        const contract = await loadLatestTpsTimerContract({ studentId, topic });
        if (!contract) {
          return res.status(404).json({
            code: TPS_TIMER_BASELINE_INCOMPLETE,
            message:
              "This topic does not yet have individualized timing authority. Time Pressure Stability cannot begin.",
          });
        }

        return res.json({
          contract: {
            contractId: contract.contractId,
            version: contract.version,
            topic: contract.topic,
            baselineSource: contract.baselineSource,
            baselineSourceEpochKey: contract.baselineSourceEpochKey,
            baselineSeconds: contract.baselineSeconds,
            structureUnderTimerSeconds: contract.structureUnderTimerSeconds,
            repeatedTimedExecutionSeconds: contract.repeatedTimedExecutionSeconds,
            fullConstraintSeconds: contract.fullConstraintSeconds,
          },
        });
      } catch (error) {
        console.error("Failed to load TPS Timer Contract:", error);
        return res.status(500).json({ message: "Failed to load TPS timing authority." });
      }
    },
  );

  app.get(
    "/api/tutor/students/:studentId/tps-passive-attempt",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const specialist = requireSpecialist(req, res);
        if (!specialist) return;

        const studentId = clean(req.params.studentId);
        const topic = clean(req.query.topic);
        const source = clean(req.query.source);
        const sourceContextId = clean(req.query.sourceContextId);
        const sourceItemId = clean(req.query.sourceItemId);
        const slotNumber = Number(req.query.slotNumber || 0);
        const legacySlotNumber = Number(req.query.legacySlotNumber || 0);

        if (
          !studentId ||
          !topic ||
          (source !== "training" && source !== "diagnosis") ||
          !sourceContextId ||
          !sourceItemId ||
          !Number.isInteger(slotNumber) ||
          slotNumber <= 0
        ) {
          return res.status(400).json({
            message:
              "studentId, topic, source, sourceContextId, sourceItemId and slotNumber are required.",
          });
        }

        const student = await requireOwnedStudent(studentId, specialist.id, res);
        if (!student) return;

        let attempt = await loadLatestTpsPassiveAttemptForSlot({
          studentId,
          topic,
          source: source as TpsPassiveAttemptSubmissionV1["source"],
          sourceContextId,
          sourceItemId,
          slotNumber,
        });

        if (
          !attempt &&
          source === "diagnosis" &&
          Number.isInteger(legacySlotNumber) &&
          legacySlotNumber > 0 &&
          legacySlotNumber !== slotNumber
        ) {
          attempt = await loadLatestTpsPassiveAttemptForSlot({
            studentId,
            topic,
            source: "diagnosis",
            sourceContextId,
            sourceItemId,
            slotNumber: legacySlotNumber,
          });
        }

        return res.json({
          attempt: attempt
            ? {
                attemptId: attempt.attemptId,
                source: attempt.source,
                sourceContextId: attempt.sourceContextId,
                sourceItemId: attempt.sourceItemId,
                slotNumber: attempt.slotNumber,
                attemptNumber: attempt.attemptNumber,
                startedAt: attempt.startedAt,
                endedAt: attempt.endedAt,
                elapsedMs: attempt.elapsedMs,
                timingValidity: attempt.timingValidity,
                endReason: attempt.endReason,
                replacementForAttemptId: attempt.replacementForAttemptId,
              }
            : null,
        });
      } catch (error) {
        console.error("Failed to recover passive baseline timing slot:", error);
        return res.status(500).json({
          message: "Passive baseline timing recovery could not be loaded.",
        });
      }
    },
  );

  app.post(
    "/api/tutor/students/:studentId/tps-passive-attempt",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const specialist = requireSpecialist(req, res);
        if (!specialist) return;

        const studentId = clean(req.params.studentId);
        const topic = clean(req.body?.topic);
        if (!studentId || !topic) {
          return res.status(400).json({
            message: "studentId and topic are required.",
          });
        }
        const student = await requireOwnedStudent(studentId, specialist.id, res);
        if (!student) return;

        const attempt = req.body?.attempt as TpsPassiveAttemptSubmissionV1;
        const persisted = await persistTpsPassiveAttempt({
          studentId,
          topic,
          attempt,
          tutorId: specialist.id,
        });

        return res.json({
          success: true,
          attempt: {
            attemptId: persisted.attemptId,
            source: persisted.source,
            sourceContextId: persisted.sourceContextId,
            sourceItemId: persisted.sourceItemId,
            slotNumber: persisted.slotNumber,
            attemptNumber: persisted.attemptNumber,
            elapsedMs: persisted.elapsedMs,
            timingValidity: persisted.timingValidity,
            endReason: persisted.endReason,
            replacementForAttemptId: persisted.replacementForAttemptId,
          },
        });
      } catch (error) {
        console.error("Failed to persist passive baseline timing attempt:", error);
        const statusCode = Number((error as any)?.statusCode);
        return res
          .status(
            Number.isInteger(statusCode) && statusCode >= 400 && statusCode < 600
              ? statusCode
              : 500,
          )
          .json({
            code:
              clean((error as any)?.code) ||
              "TPS_PASSIVE_ATTEMPT_FAILED",
            message:
              error instanceof Error
                ? error.message
                : "Passive baseline timing attempt could not be persisted.",
          });
      }
    },
  );

  app.get(
    "/api/tutor/students/:studentId/tps-timed-attempt",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const specialist = requireSpecialist(req, res);
        if (!specialist) return;

        const studentId = clean(req.params.studentId);
        const topic = clean(req.query.topic);
        const contractId = clean(req.query.contractId);
        const setId = clean(req.query.setId);
        const repNumber = Number(req.query.repNumber || 0);

        if (
          !studentId ||
          !topic ||
          !contractId ||
          !setId ||
          !Number.isInteger(repNumber) ||
          repNumber <= 0
        ) {
          return res.status(400).json({
            message:
              "studentId, topic, contractId, setId and repNumber are required.",
          });
        }

        const student = await requireOwnedStudent(studentId, specialist.id, res);
        if (!student) return;

        const contract = await loadTpsTimerContractById(contractId);
        if (
          !contract ||
          String(contract.studentId) !== studentId ||
          contract.topic.trim().toLowerCase() !== topic.toLowerCase()
        ) {
          return res.status(409).json({
            code: "TPS_TIMER_CONTRACT_MISMATCH",
            message:
              "The supplied Timer Contract is not authoritative for this student/topic.",
          });
        }

        const attempt = await loadLatestTpsTimedAttemptForSlot({
          contractId,
          setId: setId as TpsTimedAttemptSubmissionV1["setId"],
          repNumber,
        });

        return res.json({
          attempt: attempt
            ? {
                attemptId: attempt.attemptId,
                contractId: attempt.contractId,
                setId: attempt.setId,
                setName: attempt.setName,
                repNumber: attempt.repNumber,
                attemptNumber: attempt.attemptNumber,
                pressureLevel: attempt.pressureLevel,
                prescribedSeconds: attempt.prescribedSeconds,
                elapsedMs: attempt.elapsedMs,
                completedBeforeExpiry: attempt.completedBeforeExpiry,
                timingValidity: attempt.timingValidity,
                endReason: attempt.endReason,
                replacementForAttemptId: attempt.replacementForAttemptId,
              }
            : null,
        });
      } catch (error) {
        console.error("Failed to recover TPS timed attempt slot:", error);
        return res.status(500).json({
          message: "TPS timed attempt recovery could not be loaded.",
        });
      }
    },
  );

  app.post(
    "/api/tutor/students/:studentId/tps-timed-attempt",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const specialist = requireSpecialist(req, res);
        if (!specialist) return;

        const studentId = clean(req.params.studentId);
        const topic = clean(req.body?.topic);
        const contractId = clean(req.body?.contractId);
        if (!studentId || !topic || !contractId) {
          return res.status(400).json({
            message: "studentId, topic and contractId are required.",
          });
        }
        const student = await requireOwnedStudent(studentId, specialist.id, res);
        if (!student) return;

        const contract = await loadTpsTimerContractById(contractId);
        if (
          !contract ||
          String(contract.studentId) !== studentId ||
          contract.topic.trim().toLowerCase() !== topic.toLowerCase()
        ) {
          return res.status(409).json({
            code: "TPS_TIMER_CONTRACT_MISMATCH",
            message: "The supplied Timer Contract is not authoritative for this student/topic.",
          });
        }

        const attempt = req.body?.attempt as TpsTimedAttemptSubmissionV1;
        const persisted = await persistTpsTimedAttempt({
          contract,
          attempt,
          tutorId: specialist.id,
        });

        return res.json({
          success: true,
          attempt: {
            attemptId: persisted.attemptId,
            contractId: persisted.contractId,
            setId: persisted.setId,
            repNumber: persisted.repNumber,
            attemptNumber: persisted.attemptNumber,
            prescribedSeconds: persisted.prescribedSeconds,
            elapsedMs: persisted.elapsedMs,
            completedBeforeExpiry: persisted.completedBeforeExpiry,
            timingValidity: persisted.timingValidity,
            endReason: persisted.endReason,
            replacementForAttemptId: persisted.replacementForAttemptId,
          },
        });
      } catch (error) {
        console.error("Failed to persist TPS timed attempt:", error);
        const statusCode = Number((error as any)?.statusCode);
        return res
          .status(Number.isInteger(statusCode) && statusCode >= 400 && statusCode < 600 ? statusCode : 500)
          .json({
            code: clean((error as any)?.code) || "TPS_TIMED_ATTEMPT_FAILED",
            message:
              error instanceof Error
                ? error.message
                : "TPS timed attempt could not be persisted.",
            attempt: (error as any)?.existingAttempt
              ? {
                  attemptId: (error as any).existingAttempt.attemptId,
                  contractId: (error as any).existingAttempt.contractId,
                  setId: (error as any).existingAttempt.setId,
                  setName: (error as any).existingAttempt.setName,
                  repNumber: (error as any).existingAttempt.repNumber,
                  attemptNumber: (error as any).existingAttempt.attemptNumber,
                  pressureLevel: (error as any).existingAttempt.pressureLevel,
                  prescribedSeconds: (error as any).existingAttempt.prescribedSeconds,
                  elapsedMs: (error as any).existingAttempt.elapsedMs,
                  completedBeforeExpiry:
                    (error as any).existingAttempt.completedBeforeExpiry,
                  timingValidity: (error as any).existingAttempt.timingValidity,
                  endReason: (error as any).existingAttempt.endReason,
                  replacementForAttemptId:
                    (error as any).existingAttempt.replacementForAttemptId,
                }
              : undefined,
          });
      }
    },
  );
}
