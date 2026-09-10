export function buildEmergencyEnrollmentStatusFilter(parameterIndex: number) {
  return `status = ANY($${parameterIndex}::enrollment_status[])`;
}