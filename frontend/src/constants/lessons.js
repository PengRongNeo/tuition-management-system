/**
 * Missed / cancelled lessons: recorded for scheduling & parent comms, $0 revenue.
 * Field names mirror Firestore (snake_case + camelCase).
 */
export function isMissedLesson (lesson) {
  if (!lesson) return false
  const t = (lesson.lesson_type || lesson.lessonType || '').toString().toLowerCase()
  if (t === 'missed') return true
  const s = (lesson.status || '').toString().toLowerCase()
  return s === 'missed'
}
