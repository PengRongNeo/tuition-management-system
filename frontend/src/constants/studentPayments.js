/** Firestore collection for monthly fee payment tracking (admin bookkeeping only). */
export const STUDENT_PAYMENTS_COLLECTION = 'studentPayments'

/**
 * @param {Date | string | number} date
 * @returns {string} YYYY-MM
 */
export function getMonthKeyFromDate (date) {
  const d = new Date(date)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/**
 * @param {string} studentId
 * @param {string} monthKey YYYY-MM
 * @returns {string} Firestore document id
 */
export function getPaymentDocKey (studentId, monthKey) {
  return `${studentId}_${monthKey}`
}
