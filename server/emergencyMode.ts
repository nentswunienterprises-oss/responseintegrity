export function isEmergencyDbMode() {
  return process.env.EMERGENCY_DB_MODE === "true";
}