// Shared billing helpers for hourly-rate billing with per-student lesson
// duration. Keeps backwards compatibility with legacy per-lesson / monthly
// fee fields.

import {
  isChargeableAttendance,
  normalizeAttendanceStatus
} from './attendance'

export const DURATION_OPTIONS = [1, 1.5, 2, 2.5, 3]
export const DEFAULT_DURATION_HOURS = 2

export function getClassRatePerHour(classObj) {
  if (!classObj) return 0
  return (
    Number(
      classObj.ratePerHour ??
        classObj.rate_per_hour ??
        classObj.ratePerLesson ??
        classObj.rate_per_lesson ??
        classObj.monthlyFee ??
        classObj.monthly_fee ??
        0
    ) || 0
  )
}

export function getClassDefaultDuration(classObj) {
  if (!classObj) return DEFAULT_DURATION_HOURS
  const raw =
    classObj.defaultDurationHours ??
    classObj.default_duration_hours
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_DURATION_HOURS
}

export function getAttendanceDuration(attendanceItem, lessonRecord, classObj) {
  const raw =
    attendanceItem?.durationHours ??
    attendanceItem?.duration_hours ??
    lessonRecord?.durationHours ??
    lessonRecord?.duration_hours
  const n = Number(raw)
  if (Number.isFinite(n) && n > 0) return n
  return getClassDefaultDuration(classObj)
}

export function isMakeupAttendance(attendanceItem) {
  return Boolean(attendanceItem?.isMakeup ?? attendanceItem?.is_makeup)
}

export function calculateAttendanceFee(attendanceItem, lessonRecord, classObj) {
  const status = normalizeAttendanceStatus(
    attendanceItem?.status || attendanceItem?.attendanceStatus
  )
  if (!isChargeableAttendance(status)) return 0
  const ratePerHour = getClassRatePerHour(classObj)
  const duration = getAttendanceDuration(attendanceItem, lessonRecord, classObj)
  return ratePerHour * duration
}

export function formatDurationLabel(durationHours) {
  const n = Number(durationHours)
  if (!Number.isFinite(n) || n <= 0) return ''
  return Number.isInteger(n) ? `${n}h` : `${n}h`
}
