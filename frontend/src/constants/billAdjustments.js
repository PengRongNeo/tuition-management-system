// Preset bill adjustments (invoice-level; do not alter lesson/attendance math).
// Amounts: negative = credit/discount, positive = extra fee.
export const BILL_ADJUSTMENT_PRESETS = [
  {
    key: 'freeTrial',
    label: 'Free Trial',
    type: 'dynamic'
  },
  {
    key: 'referralReward',
    label: 'Referral Reward',
    amount: -30
  },
  {
    key: 'multipleSubjectsDiscount',
    label: 'Multiple Subjects Discount',
    amount: 0
  },
  {
    key: 'materialFee',
    label: 'Material Fee',
    amount: 0
  },
  {
    key: 'enrolmentFee',
    label: 'Enrolment Fee',
    amount: 0
  }
]

const presetByKey = Object.fromEntries(
  BILL_ADJUSTMENT_PRESETS.map((p) => [p.key, p])
)

/**
 * Earliest charged lesson in the month (for Free Trial). Uses rateCharged or
 * feeCharged; only rows with a positive charge count.
 * @param {Array<{ lessonDate?: Date, rateCharged?: number, feeCharged?: number }>} breakdown
 * @returns {number}
 */
export function getFirstChargedLessonFeeFromBreakdown (breakdown) {
  const charged = (breakdown || [])
    .filter((item) => Number(item.rateCharged ?? item.feeCharged ?? 0) > 0)
    .sort((a, b) => {
      const getT = (row) => {
        const d = row.lessonDate
        if (d instanceof Date && !Number.isNaN(d.getTime())) return d.getTime()
        return 0
      }
      return getT(a) - getT(b)
    })
  if (charged.length === 0) return 0
  return Number(
    charged[0].rateCharged ?? charged[0].feeCharged ?? 0
  ) || 0
}

/**
 * @param {typeof BILL_ADJUSTMENT_PRESETS[0]} adjustment
 * @param {number} [firstChargedLessonAmount] only used for Free Trial
 * @returns {number}
 */
export function getBillAdjustmentAmount (adjustment, firstChargedLessonAmount = 0) {
  if (adjustment && adjustment.type === 'dynamic' && adjustment.key === 'freeTrial') {
    const a = Math.abs(Number(firstChargedLessonAmount) || 0)
    return -a
  }
  return Number(adjustment?.amount) || 0
}

/**
 * @param {string[] | Set<string> | null} keys
 * @param {{ firstChargedLessonAmount?: number }} [options] required for freeTrial resolution
 * @returns {{ key: string, label: string, amount: number }[]}
 */
export function buildBillItemsFromKeys (keys, options = {}) {
  const { firstChargedLessonAmount = 0 } = options
  if (!keys) return []
  const list = Array.isArray(keys) ? keys : [...keys]
  return list
    .filter((k) => k && presetByKey[k])
    .map((k) => {
      const p = presetByKey[k]
      const amount = getBillAdjustmentAmount(p, firstChargedLessonAmount)
      return { key: p.key, label: p.label, amount }
    })
}

/**
 * @param {{ amount?: number }[]} items
 */
export function sumBillItemAmounts (items) {
  return (items || []).reduce((s, it) => s + Number(it?.amount || 0), 0)
}

/**
 * e.g. +$12.00 / -$30.00 / $0.00
 */
export function formatSignedCurrency (amount) {
  const v = Number(amount) || 0
  if (v === 0) return '$0.00'
  if (v > 0) return `+$${v.toFixed(2)}`
  return `-$${Math.abs(v).toFixed(2)}`
}

/**
 * e.g. (-$70.00) or (-$0.00) for Modify Bill line next to "Free Trial"
 * @param {number} firstChargedLessonAmount — positive fee of earliest charged row
 * @returns {string}
 */
export function formatFreeTrialParens (firstChargedLessonAmount) {
  const a = Math.abs(Number(firstChargedLessonAmount) || 0)
  if (a <= 0) return '(-$0.00)'
  return '(' + formatSignedCurrency(-a) + ')'
}

/**
 * @param {Date} date
 * @returns {string} "YYYY-MM"
 */
export function getBillAdjustmentMonthKeyFromDate (date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return ''
  const d = new Date(date.getFullYear(), date.getMonth(), 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default BILL_ADJUSTMENT_PRESETS
