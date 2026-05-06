/**
 * Shared "View Past Data" helpers.
 *
 * These functions are pure (no Firestore / network) — they take the same data
 * the rest of the app already loads via useAdminData() and turn it into
 * per-lesson summary rows and per-(student × month) fee rows.
 *
 * They intentionally reuse the existing fee primitives:
 *   - getClassRatePerHour, getAttendanceDuration       (constants/billing.js)
 *   - isChargeableAttendance, isPresentLike,
 *     normalizeAttendanceStatus                        (constants/attendance.js)
 *   - sumBillItemAmounts                               (constants/billAdjustments.js)
 *   - resolveLessonTimeRangeLabel, isMissedLesson      (constants/lessons.js)
 *
 * Centralising the logic here keeps "Past Data" totals consistent with the
 * "Fees This Month" column on the Students page — the two views share the
 * exact same chargeable-attendance × duration × rate-per-hour formula.
 */

import {
  getClassRatePerHour,
  getAttendanceDuration
} from '../constants/billing'
import {
  ATTENDANCE_STATUSES,
  normalizeAttendanceStatus,
  isChargeableAttendance,
  isPresentLike
} from '../constants/attendance'
import { isMissedLesson, resolveLessonTimeRangeLabel } from '../constants/lessons'
import { sumBillItemAmounts } from '../constants/billAdjustments'
import { resolveAttendanceStudentName } from './attendanceDisplay'

/**
 * Best-effort parser for the lesson_date / lessonDate field, which is stored as
 * "YYYY-MM-DD" most of the time but may be a Firestore Timestamp on legacy
 * records.
 * @returns {Date | null}
 */
export function parseLessonDate (value) {
  if (!value) return null
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value
  }
  if (typeof value === 'string') {
    const m = value.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (m) {
      return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
    }
    const d = new Date(value)
    return Number.isNaN(d.getTime()) ? null : d
  }
  if (value?.toDate) return value.toDate()
  if (typeof value === 'number') {
    const d = new Date(value)
    return Number.isNaN(d.getTime()) ? null : d
  }
  return null
}

/** "YYYY-MM" key for the given Date (uses local time, matching the rest of the app). */
export function getMonthKeyFromDate (date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return ''
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

/** "January 2026" label for the given "YYYY-MM" key. */
export function getMonthLabelFromKey (monthKey) {
  if (!monthKey || typeof monthKey !== 'string') return ''
  const [yStr, mStr] = monthKey.split('-')
  const y = Number(yStr)
  const m = Number(mStr)
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) return monthKey
  // Use the first of the month at noon UTC to avoid timezone edge cases.
  const d = new Date(Date.UTC(y, m - 1, 1, 12, 0, 0))
  return d.toLocaleDateString('en-SG', { month: 'long', year: 'numeric' })
}

/**
 * Default scope for "View Past Data": from January of the current year up to
 * the end of today. The page can override this via `options.fromMonthKey`.
 */
export function defaultPastDataMonthFloor (now = new Date()) {
  return `${now.getFullYear()}-01`
}

/**
 * Build one summary row per past lesson record, eligible for the "Past
 * Classes" list.
 *
 * Each row:
 *   {
 *     lessonId, lessonDate (Date), monthKey, monthLabel,
 *     classId, className,
 *     teacherId, teacherName,
 *     timeLabel,
 *     attendedCount,   // Present + Late
 *     chargedCount,    // chargeable rows (Present + Late + Absent (Charged by Policy))
 *     totalRows,       // total attendance rows attached to this lesson
 *     revenue,         // sum of chargeable fees (matches Students page totals)
 *     isMissed         // true if the whole lesson is a "missed" record
 *   }
 *
 * @param {Array} lessons    Raw lesson docs (snake_case or camelCase fields).
 * @param {Array} attendance Raw attendance docs.
 * @param {Array} classes    Class docs (used for rate / default duration / fallback name).
 * @param {Array} teachers   Teacher docs (used for teacher name fallback).
 * @param {{ fromMonthKey?: string, throughDate?: Date }} [options]
 *   fromMonthKey defaults to current year's January ("YYYY-01").
 *   throughDate  defaults to end of today (no future-dated rows).
 */
export function buildLessonSummaryRows (
  lessons,
  attendance,
  classes,
  teachers,
  options = {}
) {
  const lessonList = Array.isArray(lessons) ? lessons : []
  const attList = Array.isArray(attendance) ? attendance : []
  const classList = Array.isArray(classes) ? classes : []
  const teacherList = Array.isArray(teachers) ? teachers : []

  const fromMonthKey = options.fromMonthKey || defaultPastDataMonthFloor()
  const throughDate =
    options.throughDate instanceof Date
      ? options.throughDate
      : (() => {
          const n = new Date()
          return new Date(n.getFullYear(), n.getMonth(), n.getDate(), 23, 59, 59, 999)
        })()

  const classById = {}
  for (const c of classList) classById[c.id] = c
  const teacherById = {}
  for (const t of teacherList) teacherById[t.id] = t

  // Pre-bucket attendance by lesson_id for O(1) lookup.
  const attByLesson = {}
  for (const a of attList) {
    const lid = a.lesson_id || a.lessonId
    if (!lid) continue
    if (!attByLesson[lid]) attByLesson[lid] = []
    attByLesson[lid].push(a)
  }

  const rows = []
  for (const lesson of lessonList) {
    const lessonDate = parseLessonDate(
      lesson.lesson_date || lesson.lessonDate || lesson.date
    )
    if (!lessonDate) continue
    if (lessonDate > throughDate) continue
    const monthKey = getMonthKeyFromDate(lessonDate)
    if (!monthKey || monthKey < fromMonthKey) continue

    const classId = lesson.class_id || lesson.classId || ''
    const cls = classId ? classById[classId] : null

    const teacherId = lesson.teacher_id || lesson.teacherId || ''
    const teacherFromList = teacherId ? teacherById[teacherId] : null
    const teacherName =
      teacherFromList?.name ||
      lesson.teacher_name ||
      lesson.teacherName ||
      cls?.teacherName ||
      '—'

    const className =
      cls?.name || lesson.class_name || lesson.className || '—'
    const timeLabel = resolveLessonTimeRangeLabel(lesson, cls)

    const lessonIsMissed = isMissedLesson(lesson)
    const lessonAtts = attByLesson[lesson.id] || []

    let attendedCount = 0
    let chargedCount = 0
    let revenue = 0

    if (!lessonIsMissed) {
      const ratePerHour = getClassRatePerHour(cls)
      for (const a of lessonAtts) {
        const status = normalizeAttendanceStatus(a.status)
        const attendanceMissed = status === ATTENDANCE_STATUSES.MISSED
        if (attendanceMissed) continue
        if (isPresentLike(a.status)) attendedCount += 1
        if (isChargeableAttendance(a.status)) {
          chargedCount += 1
          const dur = getAttendanceDuration(a, lesson, cls)
          revenue += ratePerHour * dur
        }
      }
    }

    rows.push({
      lessonId: lesson.id,
      lessonDate,
      monthKey,
      monthLabel: getMonthLabelFromKey(monthKey),
      classId,
      className,
      teacherId,
      teacherName,
      timeLabel,
      attendedCount,
      chargedCount,
      totalRows: lessonAtts.length,
      revenue,
      isMissed: lessonIsMissed
    })
  }

  return rows
}

/**
 * Group lesson summary rows by month and (within each month) sort by date.
 * Returns:
 *   [{ monthKey, monthLabel, totalRevenue, lessonCount, rows: [...] }, ...]
 * sorted newest month first.
 */
export function groupLessonSummariesByMonth (rows) {
  const buckets = new Map()
  for (const row of rows || []) {
    if (!buckets.has(row.monthKey)) {
      buckets.set(row.monthKey, {
        monthKey: row.monthKey,
        monthLabel: row.monthLabel,
        totalRevenue: 0,
        lessonCount: 0,
        rows: []
      })
    }
    const g = buckets.get(row.monthKey)
    g.rows.push(row)
    g.totalRevenue += Number(row.revenue) || 0
    g.lessonCount += 1
  }
  for (const g of buckets.values()) {
    g.rows.sort((a, b) => {
      const ta = a.lessonDate ? a.lessonDate.getTime() : 0
      const tb = b.lessonDate ? b.lessonDate.getTime() : 0
      return ta - tb
    })
  }
  return [...buckets.values()].sort((a, b) => b.monthKey.localeCompare(a.monthKey))
}

/**
 * One row per attendance document for a single lesson (Past Classes detail modal).
 * Charge / fee math mirrors the Students page fee breakdown and
 * `buildLessonSummaryRows`: missed lessons or per-row Missed status ⇒ $0;
 * otherwise chargeable statuses use rate × duration from `getClassRatePerHour`
 * and `getAttendanceDuration`.
 *
 * @param {object} lesson            Lesson doc (with id).
 * @param {object[]} lessonAttendances Attendance rows for this `lesson.id`.
 * @param {object[]} students        Student list (for names).
 * @param {object[]} classes         Class list (rate + duration defaults).
 * @returns {{ studentId: string, studentName: string, statusLabel: string, charged: boolean, feeCharged: number, remark: string|null }[]}
 */
export function buildPastLessonStudentRows (lesson, lessonAttendances, students, classes) {
  if (!lesson) return []

  const classList = Array.isArray(classes) ? classes : []
  const classId = lesson.class_id || lesson.classId || ''
  const cls = classId ? classList.find((c) => c.id === classId) : null

  const studentList = Array.isArray(students) ? students : []
  const studentById = {}
  for (const s of studentList) studentById[s.id] = s

  const lessonIsMissed = isMissedLesson(lesson)
  const ratePerHour = getClassRatePerHour(cls)

  const list = Array.isArray(lessonAttendances) ? lessonAttendances : []
  const rows = list.map((a) => {
    const studentId = a.student_id || a.studentId || ''
    const missed =
      lessonIsMissed ||
      normalizeAttendanceStatus(a.status) === ATTENDANCE_STATUSES.MISSED
    const statusLabel = missed
      ? ATTENDANCE_STATUSES.MISSED
      : normalizeAttendanceStatus(a.status)
    const chargeable = !missed && isChargeableAttendance(a.status)
    const durationHours = getAttendanceDuration(a, lesson, cls)
    const feeCharged = missed ? 0 : (chargeable ? ratePerHour * durationHours : 0)
    const studentName = resolveAttendanceStudentName(a, { studentById })

    const rawRemark = a.remark ?? a.remarks ?? a.feedback ?? ''
    const remark = String(rawRemark).trim() || null

    return {
      studentId,
      studentName,
      statusLabel,
      charged: chargeable,
      feeCharged,
      remark
    }
  })

  rows.sort((a, b) =>
    (a.studentName || '').localeCompare(b.studentName || '', undefined, {
      sensitivity: 'base'
    })
  )
  return rows
}

/**
 * Build per-(student × month) fee rows. Each row has the same shape as the
 * "Fees This Month" column on the Students page so paid/unpaid persistence
 * can reuse `studentPayments/{studentId}_{monthKey}` documents 1:1.
 *
 * Returns rows with:
 *   {
 *     studentId, studentName, monthKey, monthLabel,
 *     lessonTotal,            // sum of chargeable fees for this student that month
 *     billAdjustmentTotal,    // from billAdjustments/{studentId}_{monthKey} (if any)
 *     finalTotal,             // lessonTotal + billAdjustmentTotal
 *     attendedCount, chargedCount
 *   }
 *
 * @param {Array}  students                Student docs.
 * @param {Array}  lessons                 Lesson docs.
 * @param {Array}  attendance              Attendance docs.
 * @param {Array}  classes                 Class docs.
 * @param {Object} billAdjustmentsByKey    { [studentId_monthKey]: { items, totalAdjustmentAmount } }
 * @param {{ fromMonthKey?: string, throughDate?: Date }} [options]
 */
export function buildStudentMonthlyFees (
  students,
  lessons,
  attendance,
  classes,
  billAdjustmentsByKey,
  options = {}
) {
  const studentList = Array.isArray(students) ? students : []
  const lessonList = Array.isArray(lessons) ? lessons : []
  const attList = Array.isArray(attendance) ? attendance : []
  const classList = Array.isArray(classes) ? classes : []
  const adjMap = billAdjustmentsByKey || {}

  const fromMonthKey = options.fromMonthKey || defaultPastDataMonthFloor()
  const throughDate =
    options.throughDate instanceof Date
      ? options.throughDate
      : (() => {
          const n = new Date()
          return new Date(n.getFullYear(), n.getMonth(), n.getDate(), 23, 59, 59, 999)
        })()

  const studentById = {}
  for (const s of studentList) studentById[s.id] = s
  const classById = {}
  for (const c of classList) classById[c.id] = c
  const lessonById = {}
  for (const l of lessonList) lessonById[l.id] = l

  // Aggregate from attendance (one row per lesson × student).
  const buckets = new Map() // studentId|monthKey -> bucket
  const bucketKey = (sid, mk) => `${sid}|${mk}`

  for (const att of attList) {
    const sid = att.student_id || att.studentId
    if (!sid) continue
    const lesson = lessonById[att.lesson_id || att.lessonId]
    if (!lesson) continue
    const lessonDate = parseLessonDate(
      lesson.lesson_date || lesson.lessonDate || lesson.date
    )
    if (!lessonDate) continue
    if (lessonDate > throughDate) continue
    const monthKey = getMonthKeyFromDate(lessonDate)
    if (!monthKey || monthKey < fromMonthKey) continue

    const cls =
      (lesson.class_id || lesson.classId)
        ? classById[lesson.class_id || lesson.classId]
        : null

    const lessonIsMissed = isMissedLesson(lesson)
    const status = normalizeAttendanceStatus(att.status)
    const attendanceMissed = status === ATTENDANCE_STATUSES.MISSED

    const ratePerHour = getClassRatePerHour(cls)
    const dur = getAttendanceDuration(att, lesson, cls)
    const chargeable =
      !lessonIsMissed && !attendanceMissed && isChargeableAttendance(att.status)
    const fee = chargeable ? ratePerHour * dur : 0
    const isAttended = !lessonIsMissed && !attendanceMissed && isPresentLike(att.status)

    const key = bucketKey(sid, monthKey)
    if (!buckets.has(key)) {
      const studentFromList = studentById[sid]
      buckets.set(key, {
        studentId: sid,
        studentName: studentFromList?.name || '',
        monthKey,
        monthLabel: getMonthLabelFromKey(monthKey),
        lessonTotal: 0,
        billAdjustmentTotal: 0,
        finalTotal: 0,
        attendedCount: 0,
        chargedCount: 0
      })
    }
    const bucket = buckets.get(key)
    bucket.lessonTotal += fee
    if (chargeable) bucket.chargedCount += 1
    if (isAttended) bucket.attendedCount += 1
  }

  // Also surface student-month rows that have ONLY a bill adjustment (e.g.
  // material fee for a month with no attendance). These would otherwise be
  // invisible.
  for (const adjKey of Object.keys(adjMap)) {
    const adj = adjMap[adjKey]
    if (!adj) continue
    const sid = adj.studentId || adj.student_id
    const mk = adj.monthKey
    if (!sid || !mk) continue
    if (mk < fromMonthKey) continue
    const key = bucketKey(sid, mk)
    if (buckets.has(key)) continue
    const studentFromList = studentById[sid]
    buckets.set(key, {
      studentId: sid,
      studentName: studentFromList?.name || '',
      monthKey: mk,
      monthLabel: getMonthLabelFromKey(mk),
      lessonTotal: 0,
      billAdjustmentTotal: 0,
      finalTotal: 0,
      attendedCount: 0,
      chargedCount: 0
    })
  }

  // Apply bill-adjustment totals + final.
  const rows = []
  for (const bucket of buckets.values()) {
    const adj = adjMap[`${bucket.studentId}_${bucket.monthKey}`]
    let billAdjustmentTotal = 0
    if (adj) {
      if (adj.totalAdjustmentAmount != null) {
        billAdjustmentTotal = Number(adj.totalAdjustmentAmount) || 0
      } else {
        billAdjustmentTotal = sumBillItemAmounts(adj.items || [])
      }
    }
    bucket.billAdjustmentTotal = billAdjustmentTotal
    bucket.finalTotal = bucket.lessonTotal + billAdjustmentTotal

    // Backfill student name if it wasn't in the cache (e.g. deleted student).
    if (!bucket.studentName) {
      bucket.studentName = `Student ${String(bucket.studentId).slice(0, 6)}`
    }
    rows.push(bucket)
  }
  return rows
}

/**
 * Group student-month fee rows into month buckets, newest first. Inside each
 * month, students are sorted alphabetically by name.
 */
export function groupStudentFeesByMonth (rows) {
  const buckets = new Map()
  for (const row of rows || []) {
    if (!buckets.has(row.monthKey)) {
      buckets.set(row.monthKey, {
        monthKey: row.monthKey,
        monthLabel: row.monthLabel,
        rows: [],
        lessonTotal: 0,
        billAdjustmentTotal: 0,
        finalTotal: 0
      })
    }
    const g = buckets.get(row.monthKey)
    g.rows.push(row)
    g.lessonTotal += Number(row.lessonTotal) || 0
    g.billAdjustmentTotal += Number(row.billAdjustmentTotal) || 0
    g.finalTotal += Number(row.finalTotal) || 0
  }
  for (const g of buckets.values()) {
    g.rows.sort((a, b) =>
      (a.studentName || '').localeCompare(b.studentName || '', undefined, {
        sensitivity: 'base'
      })
    )
  }
  return [...buckets.values()].sort((a, b) => b.monthKey.localeCompare(a.monthKey))
}
