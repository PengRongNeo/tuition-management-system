/**
 * Display name for an attendance row (Firestore doc or in-memory edit row).
 *
 * Order:
 * 1. attendance.studentName / student_name
 * 2. attendance.name / displayName
 * 3. student directory: name, then studentName
 * 4. "Unknown"
 *
 * @param {object} att
 * @param {{ studentById?: Record<string, { name?: string, studentName?: string }>, allStudentsList?: Array<{ id?: string, name?: string, studentName?: string }> }} [opts]
 */
export function resolveAttendanceStudentName (att, opts = {}) {
  const pick = (v) => {
    if (v == null) return ''
    const s = String(v).trim()
    return s || ''
  }

  const id = att?.student_id ?? att?.studentId ?? ''

  const fromAtt = pick(
    att?.studentName ?? att?.student_name ?? att?.name ?? att?.displayName
  )
  if (fromAtt) return fromAtt

  const { studentById, allStudentsList } = opts

  const st =
    id &&
    (studentById?.[id] ||
      (Array.isArray(allStudentsList)
        ? allStudentsList.find((s) => s && s.id === id)
        : null))

  if (st) {
    const fromStudent = pick(st.name ?? st.studentName)
    if (fromStudent) return fromStudent
  }

  return 'Unknown'
}
