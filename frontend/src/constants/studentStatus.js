// Shared helpers for student status handling.
//
// Supported canonical statuses:
//   - active
//   - dropped
//   - graduated
//   - stopped  (displayed as "Stopped Tuition")
//
// Backwards compatibility:
//   - Legacy `inactive` string is preserved and displayed as "Inactive".
//   - Legacy boolean `active` field is honoured when `status` is absent.

export const STUDENT_STATUS = {
  ACTIVE: 'active',
  DROPPED: 'dropped',
  GRADUATED: 'graduated',
  STOPPED: 'stopped',
  INACTIVE: 'inactive' // legacy
}

// Options used by the Add / Edit Student form.
export const STUDENT_STATUS_OPTIONS = [
  { value: STUDENT_STATUS.ACTIVE, label: 'Active' },
  { value: STUDENT_STATUS.DROPPED, label: 'Dropped' },
  { value: STUDENT_STATUS.GRADUATED, label: 'Graduated' },
  { value: STUDENT_STATUS.STOPPED, label: 'Stopped Tuition' }
]

// Legacy option kept for backwards compatibility when the record already
// carries status === 'inactive'. The form shows it dynamically so no data is
// silently rewritten on edit.
export const STUDENT_STATUS_LEGACY_INACTIVE = {
  value: STUDENT_STATUS.INACTIVE,
  label: 'Inactive'
}

export function isStudentActive(student) {
  if (!student) return false
  if (student.status) {
    return student.status === STUDENT_STATUS.ACTIVE
  }
  if (typeof student.active === 'boolean') {
    return student.active
  }
  return true
}

export function getStudentStatusRank(student) {
  return isStudentActive(student) ? 0 : 1
}

export function getStudentStatusLabel(student) {
  if (!student) return 'Active'
  const status = student.status
  if (!status) {
    if (student.active === false) return 'Inactive'
    return 'Active'
  }
  const labels = {
    active: 'Active',
    dropped: 'Dropped',
    graduated: 'Graduated',
    stopped: 'Stopped Tuition',
    inactive: 'Inactive'
  }
  return labels[status] || 'Active'
}

export function getStudentStatusClass(student) {
  if (!student) return 'student-status student-status-active'
  if (isStudentActive(student)) return 'student-status student-status-active'
  const status = student.status
  if (status === STUDENT_STATUS.DROPPED) return 'student-status student-status-dropped'
  if (status === STUDENT_STATUS.GRADUATED) return 'student-status student-status-graduated'
  if (status === STUDENT_STATUS.STOPPED) return 'student-status student-status-stopped'
  return 'student-status student-status-inactive'
}
