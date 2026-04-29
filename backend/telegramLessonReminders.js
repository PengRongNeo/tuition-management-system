/**
 * Telegram lesson reminders + /start linking (server-side only; uses TELEGRAM_BOT_TOKEN).
 */

export const REMINDER_TYPE = 'lesson_submission'
export const TELEGRAM_LOG_COLLECTION = 'telegramReminderLogs'

export function normalizeTelegramHandle (h) {
  if (h == null || h === '') return ''
  return String(h).trim().replace(/^@+/, '').toLowerCase()
}

export function reminderLogDocId (classId, lessonDate) {
  const safe = String(classId || '').replace(/\//g, '_')
  return `${safe}_${lessonDate}_${REMINDER_TYPE}`
}

function parseTimeToMinutes (time) {
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

function getDateYmdInTZ (now, timeZone) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(now)
}

function getWeekdayLongInTZ (now, timeZone) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'long'
  }).format(now)
}

function getNowMinutesInTZ (now, timeZone) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: 'numeric',
    minute: 'numeric',
    hour12: false
  }).formatToParts(now)
  const hour = parseInt(parts.find((p) => p.type === 'hour')?.value ?? '0', 10)
  const minute = parseInt(parts.find((p) => p.type === 'minute')?.value ?? '0', 10)
  if (Number.isNaN(hour) || Number.isNaN(minute)) return 0
  return hour * 60 + minute
}

function formatLessonDateLabel (ymd, timeZone) {
  const [y, m, d] = ymd.split('-').map((x) => parseInt(x, 10))
  if (!y || !m || !d) return ymd
  const utcNoon = Date.UTC(y, m - 1, d, 12, 0, 0)
  return new Intl.DateTimeFormat('en-SG', {
    timeZone,
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }).format(new Date(utcNoon))
}

export async function telegramSendMessage (token, chatId, text) {
  const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      disable_web_page_preview: true
    })
  })
  const data = await r.json().catch(() => ({}))
  if (!data.ok) {
    console.error('[telegram] sendMessage failed', data)
    return false
  }
  return true
}

async function lessonExistsForClassDate (db, classId, ymd) {
  try {
    const snap = await db
      .collection('lessons')
      .where('class_id', '==', classId)
      .where('lesson_date', '==', ymd)
      .limit(1)
      .get()
    return !snap.empty
  } catch (e) {
    console.warn('[telegram reminders] lesson existence check failed (index may be missing):', e.message)
    return false
  }
}

/**
 * Telegram Bot API webhook body (Update object).
 */
export async function processTelegramWebhook (body, { db, admin, token }) {
  const msg = body?.message || body?.edited_message
  if (!msg) return { ok: true }
  const text = (msg.text || '').trim()
  if (!text.startsWith('/start')) return { ok: true }

  const chatId = msg.chat?.id
  const usernameRaw = msg.from?.username
  console.log('[telegram webhook] /start', {
    chat_id: chatId,
    username: usernameRaw ?? null,
    normalizedUsername: usernameRaw ? normalizeTelegramHandle(usernameRaw) : null
  })

  if (chatId == null) return { ok: true }

  if (!usernameRaw) {
    await telegramSendMessage(
      token,
      chatId,
      'Please set a Telegram username in Telegram Settings, then ask your admin to add the same @username to your teacher profile. After that, send /start again.'
    )
    return { ok: true }
  }

  const normalized = normalizeTelegramHandle(usernameRaw)
  const teachersSnap = await db.collection('teachers').get()
  let matchedId = null
  let matchedName = ''
  let matchedHandle = ''

  for (const d of teachersSnap.docs) {
    const data = d.data()
    const rawHandle = data.telegramHandle
    const rawHandleSnake = data.telegram_handle
    const nFromCamel = normalizeTelegramHandle(rawHandle || '')
    const nFromSnake = normalizeTelegramHandle(rawHandleSnake || '')
    console.log('[telegram webhook] teacher compare', {
      teacherId: d.id,
      teacherName: data.name || '',
      telegramHandle: rawHandle ?? '',
      telegram_handle: rawHandleSnake ?? '',
      normalizedTelegramHandle: nFromCamel || '(empty)',
      normalized_telegram_handle: nFromSnake || '(empty)'
    })

    const matchCamel = Boolean(nFromCamel && nFromCamel === normalized)
    const matchSnake = Boolean(nFromSnake && nFromSnake === normalized)
    if (matchCamel || matchSnake) {
      matchedId = d.id
      matchedName = data.name || ''
      matchedHandle = rawHandle || rawHandleSnake || `@${usernameRaw}`
      console.log('[telegram webhook] match', { teacherId: matchedId, viaCamel: matchCamel, viaSnake: matchSnake })
      break
    }
  }

  if (!matchedId) {
    console.log('[telegram webhook] no teacher match for normalized username:', normalized)
    await telegramSendMessage(
      token,
      chatId,
      'No matching teacher found. Please check your Telegram handle in the teacher profile.'
    )
    return { ok: true }
  }

  try {
    await db.collection('teachers').doc(matchedId).update({
      telegramChatId: String(chatId),
      telegram_chat_id: String(chatId),
      telegram_link_username: usernameRaw,
      telegramLinkedAt: admin.firestore.FieldValue.serverTimestamp(),
      telegram_linked_at: admin.firestore.FieldValue.serverTimestamp(),
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    })
    console.log('[telegram webhook] teacher updated', { teacherId: matchedId, chatId: String(chatId) })
  } catch (err) {
    console.error('[telegram webhook] Firestore update failed:', err)
    throw err
  }

  await telegramSendMessage(
    token,
    chatId,
    `Hi ${matchedName || 'Teacher'}, you're linked for lesson reminders (${matchedHandle}). You'll receive a Telegram message before each scheduled class ends.`
  )
  return { ok: true }
}

export async function runTelegramLessonReminders ({ db, admin, log = () => {} }) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const baseUrl = (process.env.APP_BASE_URL || '').replace(/\/$/, '')
  const tz = process.env.APP_TIMEZONE || 'Asia/Singapore'

  if (!token || !baseUrl) {
    log('[telegram reminders] skip: TELEGRAM_BOT_TOKEN or APP_BASE_URL missing')
    return { skipped: true, sent: 0 }
  }

  const now = new Date()
  const lessonDate = getDateYmdInTZ(now, tz)
  const weekdayToday = getWeekdayLongInTZ(now, tz)
  const nowMinutes = getNowMinutesInTZ(now, tz)

  const classesSnap = await db.collection('classes').get()
  const teacherCache = {}

  async function getTeacher (id) {
    if (!id) return null
    if (teacherCache[id]) return teacherCache[id]
    const t = await db.collection('teachers').doc(id).get()
    if (!t.exists) return null
    teacherCache[id] = { id: t.id, ...t.data() }
    return teacherCache[id]
  }

  let sent = 0
  for (const doc of classesSnap.docs) {
    const c = doc.data()
    if (c.active === false) continue

    const day = c.day_of_week || c.dayOfWeek
    if (day !== weekdayToday) continue

    const endM = parseTimeToMinutes(c.end_time || c.endTime)
    if (endM == null) continue

    const startMParsed = parseTimeToMinutes(c.start_time || c.startTime)
    const rawWindowStart = endM - 30
    const windowStart =
      startMParsed != null ? Math.max(rawWindowStart, startMParsed) : rawWindowStart
    if (nowMinutes < windowStart || nowMinutes >= endM) continue

    const classId = doc.id
    const teacherId = c.main_teacher_id || c.mainTeacherId || ''
    const teacher = await getTeacher(teacherId)
    if (!teacher) continue

    const chatId = teacher.telegramChatId || teacher.telegram_chat_id
    if (!chatId) continue

    if (await lessonExistsForClassDate(db, classId, lessonDate)) {
      log(`[telegram reminders] skip (lesson exists): ${classId} ${lessonDate}`)
      continue
    }

    const logId = reminderLogDocId(classId, lessonDate)
    const logRef = db.collection(TELEGRAM_LOG_COLLECTION).doc(logId)
    const existing = await logRef.get()
    if (existing.exists) continue

    const className = c.name || 'Class'
    const teacherName = teacher.name || 'Teacher'
    const dateLabel = formatLessonDateLabel(lessonDate, tz)
    const startStr = (c.start_time || c.startTime || '').toString().trim()
    const endStr = (c.end_time || c.endTime || '').toString().trim()
    const link = `${baseUrl}/lesson/${encodeURIComponent(classId)}?date=${encodeURIComponent(lessonDate)}`

    const message =
      `Hi Teacher ${teacherName}, please submit the lesson record for ${className}.\n\n` +
      `Lesson: ${dateLabel}, ${startStr} - ${endStr}\n\n` +
      `Submit here:\n${link}`

    const ok = await telegramSendMessage(token, chatId, message)
    if (ok) {
      await logRef.set({
        classId,
        teacherId,
        lessonDate,
        reminderType: REMINDER_TYPE,
        sentAt: admin.firestore.FieldValue.serverTimestamp(),
        status: 'sent'
      })
      sent++
      log(`[telegram reminders] sent: ${classId} ${lessonDate} → ${chatId}`)
    }
  }

  return { sent }
}
