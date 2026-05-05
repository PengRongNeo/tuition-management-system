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

/** Default "HH:MM-HH:MM" timing string from a class master schedule (Submit Lesson, etc.). */
export function getDefaultLessonTimingFromClass (cls) {
  const st = cls?.start_time ?? cls?.startTime ?? ''
  const en = cls?.end_time ?? cls?.endTime ?? ''
  const a = String(st).trim()
  const b = String(en).trim()
  if (a && b) return `${a}-${b}`
  return ''
}

/**
 * Human-readable range for tables (spaced dash). Prefer per-lesson `lessonTiming`,
 * then lesson start/end fields, then class schedule.
 */
export function resolveLessonTimeRangeLabel (lesson, cls) {
  const raw = (lesson?.lesson_timing ?? lesson?.lessonTiming ?? '').toString().trim()
  if (raw) {
    const m = raw.match(/^(.+?)\s*-\s*(.+)$/)
    if (m) return `${m[1].trim()} - ${m[2].trim()}`
    return raw
  }
  const startL = lesson?.start_time || lesson?.startTime || ''
  const endL = lesson?.end_time || lesson?.endTime || ''
  if (startL && endL) {
    return `${String(startL).trim()} - ${String(endL).trim()}`
  }
  const startT = cls?.start_time || cls?.startTime || ''
  const endT = cls?.end_time || cls?.endTime || ''
  if (startT && endT) {
    return `${String(startT).trim()} - ${String(endT).trim()}`
  }
  return startT ? String(startT).trim() : '—'
}

/**
 * Separate clock strings for UI that formats start/end (e.g. dashboard).
 */
export function resolveLessonClockTimes (lesson, cls) {
  const raw = (lesson?.lesson_timing ?? lesson?.lessonTiming ?? '').toString().trim()
  if (raw) {
    const parts = raw.split(/\s*-\s*/)
    if (parts.length === 2) {
      const a = parts[0].trim()
      const b = parts[1].trim()
      if (a && b) return { startTime: a, endTime: b }
    }
  }
  const startTime =
    lesson?.start_time ||
    lesson?.startTime ||
    cls?.start_time ||
    cls?.startTime ||
    ''
  const endTime =
    lesson?.end_time ||
    lesson?.endTime ||
    cls?.end_time ||
    cls?.endTime ||
    ''
  return { startTime, endTime }
}
