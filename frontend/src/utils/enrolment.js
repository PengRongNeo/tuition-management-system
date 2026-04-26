/**
 * Helpers for class ↔ student links via the `enrolments` collection.
 * (Not `classIds` on the student doc — the app uses enrolment docs.)
 */

export function getStudentClassIdsFromEnrolments(student) {
  if (!student) return []
  if (Array.isArray(student.classIds)) return student.classIds
  if (Array.isArray(student.class_ids)) return student.class_ids
  if (Array.isArray(student.enrolledClasses)) {
    return student.enrolledClasses
      .map((e) => e.classId || e.class_id)
      .filter(Boolean)
  }
  return []
}

export function isStudentInClassFromEnrolments(student, classId) {
  return getStudentClassIdsFromEnrolments(student).includes(classId)
}

/**
 * @param {Array<{ student_id?: string, id?: string }>} classStudentRows
 *   rows from GET /api/classes/:id .students
 */
export function isStudentInClassFromClassPayload(studentId, classStudentRows) {
  if (!studentId || !Array.isArray(classStudentRows)) return false
  return classStudentRows.some(
    (row) => row.status === 'active' && (row.student_id === studentId)
  )
}

export function getStudentsForClassFromList(allStudents, classId, enrolmentRows) {
  if (!Array.isArray(allStudents) || !classId) return []
  const inClass = new Set(
    (enrolmentRows || [])
      .filter((r) => r.status === 'active' && r.student_id)
      .map((r) => r.student_id)
  )
  return allStudents.filter((s) => s.id && inClass.has(s.id))
}
