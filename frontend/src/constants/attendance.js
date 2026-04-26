// Canonical attendance status values and helpers.
// New records should save statuses from ATTENDANCE_STATUSES.
// Legacy records (lowercase "present" / "late" / "absent") are normalized below.

export const ATTENDANCE_STATUSES = {
  PRESENT: 'Present',
  LATE: 'Late',
  ABSENT_VALID: 'Absent (Valid)',
  ABSENT_CHARGED: 'Absent (Charged by Policy)',
  /** Class did not run / was cancelled; $0 (set on missed lesson records) */
  MISSED: 'Missed'
}

export const ATTENDANCE_STATUS_OPTIONS = [
  ATTENDANCE_STATUSES.PRESENT,
  ATTENDANCE_STATUSES.LATE,
  ATTENDANCE_STATUSES.ABSENT_VALID,
  ATTENDANCE_STATUSES.ABSENT_CHARGED
]

export const CHARGEABLE_ATTENDANCE_STATUSES = [
  ATTENDANCE_STATUSES.PRESENT,
  ATTENDANCE_STATUSES.LATE,
  ATTENDANCE_STATUSES.ABSENT_CHARGED
]

export function normalizeAttendanceStatus(status) {
  if (status == null) return ''
  const raw = String(status).trim()
  const lower = raw.toLowerCase()
  if (lower === 'present') return ATTENDANCE_STATUSES.PRESENT
  if (lower === 'late') return ATTENDANCE_STATUSES.LATE
  // Legacy "Absent" (no qualifier) is treated as a valid absence (not chargeable).
  if (lower === 'absent' || lower === 'absent (valid)' || lower === 'absent_valid') {
    return ATTENDANCE_STATUSES.ABSENT_VALID
  }
  if (
    lower === 'absent (charged by policy)' ||
    lower === 'absent (charged)' ||
    lower === 'absent_charged'
  ) {
    return ATTENDANCE_STATUSES.ABSENT_CHARGED
  }
  if (lower === 'missed') return ATTENDANCE_STATUSES.MISSED
  return raw
}

export function isChargeableAttendance(status) {
  if (normalizeAttendanceStatus(status) === ATTENDANCE_STATUSES.MISSED) return false
  return CHARGEABLE_ATTENDANCE_STATUSES.includes(normalizeAttendanceStatus(status))
}

// For "Students Present" counters: Present + Late count as attended.
// Charged-by-policy absences are still absences even though they are chargeable.
export function isPresentLike(status) {
  const n = normalizeAttendanceStatus(status)
  return n === ATTENDANCE_STATUSES.PRESENT || n === ATTENDANCE_STATUSES.LATE
}
