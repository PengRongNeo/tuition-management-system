// Class create/edit: level default rates, schedule → duration, table revenue / lesson
// (Uses level strings from the class form, e.g. "Primary 1" and "Sec 3".)

import { getClassDefaultDuration, getClassRatePerHour } from './billing'

// Rates align to P1–P2, P3–P4, P5–P6, S1–S2, S3, S4–S5 bands; keys match `availableLevels` in ClassesView.
export const DEFAULT_RATE_BY_LEVEL = {
  'Primary 1': 22,
  'Primary 2': 22,
  'Primary 3': 25,
  'Primary 4': 25,
  'Primary 5': 28,
  'Primary 6': 28,
  'Sec 1': 30,
  'Sec 2': 30,
  'Sec 3': 35,
  'Sec 4': 40,
  'Sec 5': 40
}

export function getDefaultRateByLevel (level) {
  return DEFAULT_RATE_BY_LEVEL[level] ?? 0
}

/**
 * Parses a class schedule time. Supports 24h "HH:MM" (e.g. "16:30") and "H:MM AM/PM" if present.
 */
export function timeToMinutes (time) {
  if (!time || typeof time !== 'string') return null
  const trimmed = time.trim()
  const withPeriod = /^(\d{1,2}):(\d{2})\s+(AM|PM)$/i.exec(trimmed)
  if (withPeriod) {
    let hours = parseInt(withPeriod[1], 10)
    const minutes = parseInt(withPeriod[2], 10)
    const p = withPeriod[3].toUpperCase()
    if (p === 'PM' && hours !== 12) hours += 12
    if (p === 'AM' && hours === 12) hours = 0
    if (Number.isNaN(hours) || Number.isNaN(minutes)) return null
    return hours * 60 + minutes
  }
  const m24 = /^(\d{1,2}):(\d{2})$/.exec(trimmed)
  if (m24) {
    const hours = parseInt(m24[1], 10)
    const minutes = parseInt(m24[2], 10)
    if (Number.isNaN(hours) || Number.isNaN(minutes) || hours > 23 || minutes > 59) {
      return null
    }
    return hours * 60 + minutes
  }
  return null
}

export function calculateDurationHours (startTime, endTime) {
  const start = timeToMinutes(startTime)
  const end = timeToMinutes(endTime)
  if (start == null || end == null || end <= start) return null
  return (end - start) / 60
}

export function isValidDuration (duration) {
  return [1, 1.5, 2].includes(Number(duration))
}

/**
 * Expected revenue for one full lesson with all enrolled (active) students — no attendance or lessons.
 */
export function getClassRevenuePerLesson (classObj) {
  if (!classObj) return 0
  const ratePerHour = getClassRatePerHour(classObj)
  const durationHours = getClassDefaultDuration(classObj)
  const n = Number(classObj.studentCount ?? classObj.student_count ?? 0)
  const studentCount = Number.isFinite(n) && n >= 0 ? n : 0
  return ratePerHour * durationHours * studentCount
}
