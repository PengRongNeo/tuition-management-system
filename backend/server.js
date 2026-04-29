import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import path from 'path'
import { readdirSync, readFileSync, existsSync } from 'fs'
import { fileURLToPath } from 'url'
import admin from 'firebase-admin'
import {
  runTelegramLessonReminders,
  processTelegramWebhook
} from './telegramLessonReminders.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Resolve service account path: env var, or fallback to node_modules (e.g. serviceAccountKey.json or *firebase*adminsdk*.json)
function getServiceAccountPath() {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return path.isAbsolute(process.env.GOOGLE_APPLICATION_CREDENTIALS)
      ? process.env.GOOGLE_APPLICATION_CREDENTIALS
      : path.resolve(__dirname, process.env.GOOGLE_APPLICATION_CREDENTIALS)
  }
  const nodeModules = path.join(__dirname, 'node_modules')
  const tryFile = (name) => path.join(nodeModules, name)
  if (existsSync(tryFile('serviceAccountKey.json'))) return tryFile('serviceAccountKey.json')
  try {
    const files = readdirSync(nodeModules)
    const keyFile = files.find((f) => f.endsWith('.json') && f.toLowerCase().includes('firebase') && f.toLowerCase().includes('adminsdk'))
    if (keyFile) return path.join(nodeModules, keyFile)
  } catch (_) {}
  return null
}

// Initialize Firebase Admin
if (admin.apps.length === 0) {
  let initialized = false
  const credPath = getServiceAccountPath()
  if (credPath && existsSync(credPath)) {
    try {
      const key = JSON.parse(readFileSync(credPath, 'utf8'))
      admin.initializeApp({ credential: admin.credential.cert(key) })
      initialized = true
    } catch (e) {
      console.warn('Could not load credentials file, trying env vars:', e.message)
    }
  }
  if (!initialized && process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
      })
    })
    initialized = true
  }
  if (!initialized) {
    console.error('Missing Firebase Admin config. Set GOOGLE_APPLICATION_CREDENTIALS (with file present), or set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY')
    process.exit(1)
  }
}

const db = admin.firestore()
const auth = admin.auth()
const app = express()
const PORT = process.env.PORT || 4000

/**
 * Vercel rewrites all routes to `api/index.js`, but the Node `req.url` can be
 * `/api` or `/` instead of `/api/public/...`, so Express would miss routes and
 * return 404. Restore the client path from Vercel / proxy headers when needed.
 */
function restoreVercelRequestPath (req) {
  if (!process.env.VERCEL) return
  const pathOnly = (req.url || '/').split('?')[0]
  if (pathOnly.startsWith('/api/') && pathOnly.length > '/api/'.length) return

  const candidates = [
    req.headers['x-vercel-original-path'],
    req.headers['x-vercel-http-queue-path'],
    req.headers['x-invoke-path'],
    req.headers['x-matched-path'],
    req.headers['x-forwarded-uri'],
    req.headers['x-original-url']
  ]
  for (let c of candidates) {
    if (Array.isArray(c)) c = c[0]
    if (typeof c !== 'string') continue
    if (/^https?:\/\//i.test(c)) {
      try {
        const u = new URL(c)
        c = u.pathname + u.search
      } catch {
        continue
      }
    }
    if (!c.startsWith('/api')) continue
    const q = (req.url || '').includes('?') ? '?' + req.url.split('?').slice(1).join('?') : ''
    req.url = c.split('?')[0] + q
    if (req.originalUrl !== undefined) req.originalUrl = req.url
    return
  }
}
app.use((req, res, next) => {
  restoreVercelRequestPath(req)
  next()
})

// FRONTEND_ORIGIN accepts a comma-separated list of allowed origins so the
// same backend can serve local dev + a Vercel preview + production from one
// deployment. Use "*" to allow any origin (not recommended in prod).
//
// Local dev origins are ALWAYS allowed so forgetting to set FRONTEND_ORIGIN
// doesn't break `vite dev` or the Vue 3000 port — this is also why the
// deployed backend can safely ship without its own env override during
// first-time bring-up.
const DEFAULT_LOCAL_ORIGINS = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5173',
  'http://127.0.0.1:5173'
]
const extraOrigins = (process.env.FRONTEND_ORIGIN || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)
const allowedOrigins = Array.from(new Set([...DEFAULT_LOCAL_ORIGINS, ...extraOrigins]))
const allowAnyOrigin = extraOrigins.includes('*')

console.log('[cors] allowed origins:', allowAnyOrigin ? '*' : allowedOrigins)

const corsOptions = {
  origin(origin, cb) {
    // Allow non-browser clients (curl, Vercel probes) which send no Origin.
    if (!origin) return cb(null, true)
    if (allowAnyOrigin) return cb(null, true)
    if (allowedOrigins.includes(origin)) return cb(null, true)
    console.warn(`[cors] rejected origin: ${origin}`)
    return cb(new Error(`Not allowed by CORS: ${origin}`), false)
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Form-Secret',
    'X-Telegram-Bot-Api-Secret-Token',
    'X-Cron-Secret'
  ]
}

app.use(cors(corsOptions))
// Explicit preflight handler — some runtimes (incl. Vercel's serverless
// functions) don't always run the short-circuit in `cors()` for OPTIONS.
app.options('*', cors(corsOptions))

app.use(express.json())

// Simple health endpoint handy for Vercel / uptime checks.
app.get('/', (_req, res) => res.json({ ok: true, service: 'tuition-management-backend' }))
app.get('/api/health', (_req, res) =>
  res.json({
    ok: true,
    // Bump when adding public / admin routes; helps verify a stale Vercel deploy
    // (e.g. 404 "Cannot POST /api/public/lesson-missed" means old build).
    build: { publicLessonMissed: true, telegramLessonReminders: true }
  })
)

// Telegram webhook (GET = health for browser; POST = Bot API updates)
app
  .route('/api/public/telegram/webhook')
  .get((_req, res) => {
    res.json({ ok: true, route: 'telegram webhook alive' })
  })
  .post(async (req, res) => {
    const secret = process.env.TELEGRAM_WEBHOOK_SECRET
    if (secret) {
      const hdr = req.headers['x-telegram-bot-api-secret-token']
      if (hdr !== secret) {
        return res.status(401).json({ error: 'Unauthorized' })
      }
    }
    const token = process.env.TELEGRAM_BOT_TOKEN
    if (!token) {
      return res.status(503).json({ error: 'Telegram bot not configured' })
    }
    try {
      await processTelegramWebhook(req.body, { db, admin, token })
      res.json({ ok: true })
    } catch (e) {
      console.error('[telegram webhook]', e)
      res.status(500).json({ error: e.message })
    }
  })

// Auth middleware: verify Firebase ID token
async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  const token = authHeader.slice(7)
  try {
    req.user = await auth.verifyIdToken(token)
    next()
  } catch (e) {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }
}

// --- Auth ---
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body || {}
  const apiKey = process.env.FIREBASE_WEB_API_KEY
  if (!apiKey || apiKey === 'your-web-api-key') {
    console.error('Login failed: FIREBASE_WEB_API_KEY is missing or still the placeholder. Set it in backend/.env')
    return res.status(500).json({ error: 'Server auth not configured. Set FIREBASE_WEB_API_KEY in backend/.env' })
  }
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' })
  try {
    const r = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, returnSecureToken: true })
      }
    )
    const data = await r.json().catch(() => ({}))
    if (data.error) {
      const msg = data.error.message || 'Invalid credentials'
      return res.status(400).json({ error: msg })
    }
    if (!data.idToken) {
      console.error('Login: Firebase did not return idToken', data)
      return res.status(500).json({ error: 'Login failed: no token received' })
    }
    res.json({ token: data.idToken })
  } catch (e) {
    console.error('Login error:', e.message || e)
    res.status(500).json({ error: e.message || 'Login failed' })
  }
})

// --- Public: create pending student from Google Form (no auth; requires X-Form-Secret header) ---
// New submissions go into `pending_students` so admins can review and select the
// official school before the record is promoted into the main `students` collection.
app.post('/api/public/student-from-form', async (req, res) => {
  const secret = process.env.FORM_SUBMIT_SECRET
  if (!secret) {
    return res.status(503).json({ error: 'Form submission not configured. Set FORM_SUBMIT_SECRET in backend/.env' })
  }
  const provided = req.headers['x-form-secret'] || req.query.secret
  if (provided !== secret) {
    return res.status(401).json({ error: 'Invalid or missing form secret' })
  }
  try {
    const body = req.body || {}
    const rawSchool = (body.submitted_school ?? body.school ?? '').toString().trim()
    const requestedClasses = (
      body.requested_classes ?? body.classes ?? body.subjects ?? ''
    ).toString().trim()
    const ref = await db.collection('pending_students').add({
      name: (body.name || '').toString().trim(),
      submitted_school: rawSchool,
      official_school: '',
      level: (body.level || '').toString().trim(),
      parent_name: (body.parent_name || '').toString().trim(),
      parent_contact: (body.parent_contact || '').toString().trim(),
      parent_email: (body.parent_email || '').toString().trim(),
      requested_classes: requestedClasses,
      status: 'pending',
      submitted_at: admin.firestore.FieldValue.serverTimestamp()
    })
    res.status(201).json({ id: ref.id, ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// --- Pending Students (admin review queue for Google Form submissions) ---
app.get('/api/pending-students', requireAuth, async (req, res) => {
  try {
    const snap = await db.collection('pending_students').get()
    const list = snap.docs
      .map(d => {
        const data = d.data()
        return {
          id: d.id,
          ...data,
          submitted_at: data.submitted_at?.toMillis?.() ?? data.submitted_at ?? null,
          approved_at: data.approved_at?.toMillis?.() ?? data.approved_at ?? null
        }
      })
      .filter(p => (p.status ?? 'pending') === 'pending')
      .sort((a, b) => (b.submitted_at || 0) - (a.submitted_at || 0))
    res.json(list)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.post('/api/pending-students/:id/approve', requireAuth, async (req, res) => {
  try {
    const id = req.params.id
    const ref = db.collection('pending_students').doc(id)
    const snap = await ref.get()
    if (!snap.exists) return res.status(404).json({ error: 'Pending student not found' })
    const pending = snap.data()
    const body = req.body || {}

    const officialSchool = (body.official_school ?? pending.official_school ?? '').toString().trim()
    if (!officialSchool) {
      return res.status(400).json({ error: 'Please select the official school before adding this student.' })
    }

    const name = (body.name ?? pending.name ?? '').toString().trim()
    const level = (body.level ?? pending.level ?? '').toString().trim()
    const parentName = (body.parent_name ?? pending.parent_name ?? '').toString().trim()
    const parentContact = (body.parent_contact ?? pending.parent_contact ?? '').toString().trim()
    const parentEmail = (body.parent_email ?? pending.parent_email ?? '').toString().trim()

    if (!name) return res.status(400).json({ error: 'Student name is required.' })
    if (!level) return res.status(400).json({ error: 'Level is required.' })
    if (!parentName) return res.status(400).json({ error: 'Parent name is required.' })
    if (!parentContact) return res.status(400).json({ error: 'Parent contact is required.' })

    const studentRef = await db.collection('students').add({
      name,
      school: officialSchool,
      level,
      parent_name: parentName,
      parent_contact: parentContact,
      parent_email: parentEmail,
      status: 'active',
      source: 'pending_form',
      pending_id: id,
      created_at: admin.firestore.FieldValue.serverTimestamp()
    })

    await ref.update({
      status: 'approved',
      official_school: officialSchool,
      approved_at: admin.firestore.FieldValue.serverTimestamp(),
      approved_student_id: studentRef.id
    })

    res.json({ ok: true, studentId: studentRef.id })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.delete('/api/pending-students/:id', requireAuth, async (req, res) => {
  try {
    await db.collection('pending_students').doc(req.params.id).delete()
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// --- Public: list teachers (for lesson submission dropdown, no auth) ---
app.get('/api/public/teachers', async (req, res) => {
  try {
    const snap = await db.collection('teachers').get()
    const list = snap.docs.map(d => ({ id: d.id, name: d.data().name })).filter(t => t.name)
    list.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    res.json(list)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// --- Public: get class + students for lesson submission (no auth) ---
app.get('/api/public/class/:id', async (req, res) => {
  try {
    const classDoc = await db.collection('classes').doc(req.params.id).get()
    if (!classDoc.exists) return res.status(404).json({ error: 'Class not found' })
    const classData = classDoc.data()
    let teacherName = null
    if (classData.main_teacher_id) {
      const t = await db.collection('teachers').doc(classData.main_teacher_id).get()
      if (t.exists) teacherName = t.data().name
    }
    const enrSnap = await db.collection('enrolments').where('class_id', '==', req.params.id).get()
    const students = []
    for (const e of enrSnap.docs) {
      const ed = e.data()
      const s = await db.collection('students').doc(ed.student_id).get()
      if (s.exists) students.push({ id: ed.student_id, name: s.data().name })
    }
    const defaultDurationHours = Number(classData.default_duration_hours) > 0
      ? Number(classData.default_duration_hours)
      : 2
    const ratePerHour = Number(
      classData.rate_per_hour ?? classData.rate_per_lesson ?? classData.monthly_fee
    ) || 0
    res.json({
      id: classDoc.id,
      ...classData,
      teacherName,
      students,
      defaultDurationHours,
      ratePerHour
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// --- Public: lesson submission (no auth) ---
app.post('/api/public/lesson-submit', async (req, res) => {
  try {
    const { classId, lessonDate, teacherId, description, homework, materialsLink, attendance } = req.body || {}
    if (!classId || !lessonDate || !teacherId || !attendance || typeof attendance !== 'object') {
      return res.status(400).json({ error: 'classId, lessonDate, teacherId, and attendance required' })
    }
    // Look up class so we can snapshot name + default duration on the lesson
    // and use its default duration as a fallback when a student row doesn't
    // specify one.
    let className = ''
    let classDefaultDuration = 2
    try {
      const classDoc = await db.collection('classes').doc(classId).get()
      if (classDoc.exists) {
        const cd = classDoc.data()
        className = cd.name || ''
        const dur = Number(cd.default_duration_hours)
        if (Number.isFinite(dur) && dur > 0) classDefaultDuration = dur
      }
    } catch (_) { /* non-fatal */ }

    const lessonRef = await db.collection('lessons').add({
      // Snake_case is the canonical shape; camelCase mirrors are written for
      // robustness so any reader using either convention can find the record.
      class_id: classId,
      classId,
      class_name: className,
      className,
      teacher_id: teacherId,
      teacherId,
      lesson_date: lessonDate,
      lessonDate,
      description: description || '',
      homework: homework || '',
      materials_link: materialsLink || '',
      materialsLink: materialsLink || '',
      duration_hours: classDefaultDuration,
      durationHours: classDefaultDuration,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    })
    const batch = db.batch()
    for (const [studentId, att] of Object.entries(attendance)) {
      if (!att?.status) continue
      const rawDur = Number(att.durationHours ?? att.duration_hours)
      const duration = Number.isFinite(rawDur) && rawDur > 0 ? rawDur : classDefaultDuration
      const isMakeup = Boolean(att.isMakeup ?? att.is_makeup)
      const ref = db.collection('attendance').doc()
      batch.set(ref, {
        lesson_id: lessonRef.id,
        lessonId: lessonRef.id,
        class_id: classId,
        classId,
        student_id: studentId,
        studentId,
        status: att.status,
        remark: att.remark || '',
        duration_hours: duration,
        durationHours: duration,
        is_makeup: isMakeup,
        isMakeup,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      })
    }
    await batch.commit()
    res.json({ id: lessonRef.id })
  } catch (e) {
    res.status(500).json({ error: e.message || 'Submit failed' })
  }
})

async function buildMissedLessonAndAttendance (body) {
  const classId = (body.classId || body.class_id || '').toString().trim()
  const lessonDate = (body.lessonDate || body.lesson_date || '')
    .toString()
    .slice(0, 10)
  const remark = (body.remark || body.remarks || '').toString().trim()
  if (!classId || !lessonDate || lessonDate.length < 10) {
    return { error: 'classId and lessonDate (YYYY-MM-DD) are required' }
  }
  if (!remark) {
    return { error: 'Please enter a reason for the missed lesson.' }
  }
  const classDoc = await db.collection('classes').doc(classId).get()
  if (!classDoc.exists) return { error: 'Class not found' }
  const cd = classDoc.data()
  const className = cd.name || ''
  const classDefaultDuration = Number(cd.default_duration_hours) > 0
    ? Number(cd.default_duration_hours)
    : 2
  const st = (body.startTime ?? body.start_time ?? cd.start_time ?? '').toString()
  const en = (body.endTime ?? body.end_time ?? cd.end_time ?? '').toString()
  const teacherId = (
    body.teacherId ??
    body.teacher_id ??
    cd.main_teacher_id ??
    ''
  ).toString()

  const enrSnap = await db
    .collection('enrolments')
    .where('class_id', '==', classId)
    .get()
  const studentIds = enrSnap.docs
    .map((d) => d.data().student_id)
    .filter(Boolean)

  const lessonRef = await db.collection('lessons').add({
    class_id: classId,
    classId,
    class_name: className,
    className,
    teacher_id: teacherId,
    teacherId,
    lesson_date: lessonDate,
    lessonDate,
    start_time: st,
    startTime: st,
    end_time: en,
    endTime: en,
    lesson_type: 'missed',
    lessonType: 'missed',
    status: 'missed',
    remark,
    remarks: remark,
    description: '',
    homework: '',
    materials_link: '',
    materialsLink: '',
    duration_hours: classDefaultDuration,
    durationHours: classDefaultDuration,
    created_at: admin.firestore.FieldValue.serverTimestamp(),
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  })

  if (studentIds.length === 0) {
    return { id: lessonRef.id }
  }
  const batch = db.batch()
  for (const studentId of studentIds) {
    const ref = db.collection('attendance').doc()
    batch.set(ref, {
      lesson_id: lessonRef.id,
      lessonId: lessonRef.id,
      class_id: classId,
      classId,
      student_id: studentId,
      studentId,
      status: 'Missed',
      remark: '',
      duration_hours: classDefaultDuration,
      durationHours: classDefaultDuration,
      fee_charged: 0,
      feeCharged: 0,
      is_makeup: false,
      isMakeup: false,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    })
  }
  await batch.commit()
  return { id: lessonRef.id }
}

// Public: mark lesson as missed (no auth) — same trust model as lesson-submit
app.post('/api/public/lesson-missed', async (req, res) => {
  try {
    const out = await buildMissedLessonAndAttendance(req.body || {})
    if (out.error) return res.status(400).json({ error: out.error })
    res.json({ id: out.id })
  } catch (e) {
    console.error('[POST /api/public/lesson-missed] failed:', e)
    res.status(500).json({ error: e?.message || String(e) || 'Failed to save missed lesson' })
  }
})

// Admin: mark lesson as missed (auth)
app.post('/api/lessons/missed', requireAuth, async (req, res) => {
  try {
    const out = await buildMissedLessonAndAttendance(req.body || {})
    if (out.error) return res.status(400).json({ error: out.error })
    res.json({ id: out.id })
  } catch (e) {
    console.error('[POST /api/lessons/missed] failed:', e)
    res.status(500).json({ error: e?.message || String(e) || 'Failed to save missed lesson' })
  }
})

// --- Public: minimal students list for makeup student search (no auth) ---
app.get('/api/public/students-minimal', async (req, res) => {
  try {
    const snap = await db.collection('students').get()
    // Include ALL students (active and inactive) so dropped / graduated /
    // stopped students remain selectable as makeup students for a lesson.
    // The `status` and legacy `active` fields are surfaced so the UI can
    // render a status badge and sort active students first.
    const list = snap.docs.map(d => {
      const data = d.data()
      return {
        id: d.id,
        name: data.name || '',
        school: data.school || '',
        level: data.level || '',
        parent_name: data.parent_name || '',
        parent_contact: data.parent_contact || '',
        status: data.status || '',
        active: typeof data.active === 'boolean' ? data.active : undefined
      }
    })
    list.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    res.json(list)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// --- Classes ---
app.get('/api/classes', requireAuth, async (req, res) => {
  try {
    const snap = await db.collection('classes').get()
    const teachersSnap = await db.collection('teachers').get()
    const teachers = Object.fromEntries(teachersSnap.docs.map(d => [d.id, d.data().name]))
    const list = []
    for (const d of snap.docs) {
      const data = d.data()
      const enrSnap = await db.collection('enrolments').where('class_id', '==', d.id).where('status', '==', 'active').get()
      list.push({
        id: d.id,
        ...data,
        teacherName: data.main_teacher_id ? teachers[data.main_teacher_id] : null,
        studentCount: enrSnap.size
      })
    }
    list.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    res.json(list)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.get('/api/classes/:id', requireAuth, async (req, res) => {
  try {
    const doc = await db.collection('classes').doc(req.params.id).get()
    if (!doc.exists) return res.status(404).json({ error: 'Not found' })
    const data = doc.data()
    let teacherName = null
    if (data.main_teacher_id) {
      const t = await db.collection('teachers').doc(data.main_teacher_id).get()
      if (t.exists) teacherName = t.data().name
    }
    const enrSnap = await db.collection('enrolments').where('class_id', '==', req.params.id).get()
    const students = []
    for (const e of enrSnap.docs) {
      const ed = e.data()
      const s = await db.collection('students').doc(ed.student_id).get()
      const sd = s.exists ? s.data() : {}
      students.push({
        id: e.id,
        student_id: ed.student_id,
        studentName: s.exists ? sd.name : 'Unknown',
        level: sd.level || '',
        school: sd.school || '',
        parent_contact: sd.parent_contact || '',
        student_status: sd.status,
        join_date: ed.join_date,
        status: ed.status
      })
    }
    res.json({ id: doc.id, ...data, teacherName, students })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

function resolveHourlyRate(body) {
  // Accept new (rate_per_hour) and legacy (rate_per_lesson / monthly_fee) inputs.
  const rate =
    body?.rate_per_hour ??
    body?.ratePerHour ??
    body?.rate_per_lesson ??
    body?.ratePerLesson ??
    body?.monthly_fee ??
    body?.monthlyFee ??
    0
  const n = Number(rate)
  return Number.isFinite(n) && n >= 0 ? n : 0
}

function resolveDefaultDurationHours(body) {
  const raw =
    body?.default_duration_hours ??
    body?.defaultDurationHours
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? n : 2
}

app.post('/api/classes', requireAuth, async (req, res) => {
  try {
    const { name, subject, level, stream, day_of_week, start_time, end_time, main_teacher_id, active } = req.body || {}
    const rateHour = resolveHourlyRate(req.body)
    const defaultDuration = resolveDefaultDurationHours(req.body)
    const ref = await db.collection('classes').add({
      name: name || '',
      subject: subject || '',
      level: level || '',
      stream: stream || '',
      day_of_week: day_of_week || '',
      start_time: start_time || '',
      end_time: end_time || '',
      main_teacher_id: main_teacher_id || '',
      rate_per_hour: rateHour,
      default_duration_hours: defaultDuration,
      active: active !== false,
      created_at: admin.firestore.FieldValue.serverTimestamp()
    })
    res.json({ id: ref.id })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.put('/api/classes/:id', requireAuth, async (req, res) => {
  try {
    const { name, subject, level, stream, day_of_week, start_time, end_time, main_teacher_id, active } = req.body || {}
    const rateHour = resolveHourlyRate(req.body)
    const defaultDuration = resolveDefaultDurationHours(req.body)
    await db.collection('classes').doc(req.params.id).update({
      name: name ?? '',
      subject: subject ?? '',
      level: level ?? '',
      stream: stream ?? '',
      day_of_week: day_of_week ?? '',
      start_time: start_time ?? '',
      end_time: end_time ?? '',
      main_teacher_id: main_teacher_id ?? '',
      rate_per_hour: rateHour,
      default_duration_hours: defaultDuration,
      active: active !== false
    })
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.delete('/api/classes/:id', requireAuth, async (req, res) => {
  try {
    const classId = req.params.id
    const lessonsSnap = await db.collection('lessons').where('class_id', '==', classId).get()
    for (const lesson of lessonsSnap.docs) {
      const attSnap = await db.collection('attendance').where('lesson_id', '==', lesson.id).get()
      for (const att of attSnap.docs) await att.ref.delete()
      await lesson.ref.delete()
    }
    const enrSnap = await db.collection('enrolments').where('class_id', '==', classId).get()
    for (const e of enrSnap.docs) await e.ref.delete()
    await db.collection('classes').doc(classId).delete()
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// --- Teachers ---
app.get('/api/teachers', requireAuth, async (req, res) => {
  try {
    const snap = await db.collection('teachers').get()
    const list = snap.docs.map(d => ({ id: d.id, ...d.data(), qualifications: d.data().qualifications_desc }))
    list.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    res.json(list)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.post('/api/teachers', requireAuth, async (req, res) => {
  try {
    const {
      name,
      contact,
      bank_acct,
      qualifications_desc,
      subjects,
      join_date,
      active,
      telegramHandle,
      telegramChatId
    } = req.body || {}
    const th = (telegramHandle ?? '').toString().trim()
    const tc = (telegramChatId ?? '').toString().trim()
    const ref = await db.collection('teachers').add({
      name: name || '',
      contact: contact || '',
      bank_acct: bank_acct || '',
      qualifications_desc: qualifications_desc || '',
      subjects: Array.isArray(subjects) ? subjects : [],
      join_date: join_date ? admin.firestore.Timestamp.fromDate(new Date(join_date)) : admin.firestore.FieldValue.serverTimestamp(),
      active: active !== false,
      telegramHandle: th,
      telegramChatId: tc,
      telegram_handle: th,
      telegram_chat_id: tc
    })
    res.json({ id: ref.id })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.put('/api/teachers/:id', requireAuth, async (req, res) => {
  try {
    const id = req.params.id
    const docRef = db.collection('teachers').doc(id)
    const docSnap = await docRef.get()
    if (!docSnap.exists) {
      return res.status(404).json({ error: 'Teacher not found' })
    }
    const body = req.body || {}
    const {
      name,
      contact,
      bank_acct,
      qualifications_desc,
      subjects,
      join_date,
      active,
      telegramHandle,
      telegramChatId
    } = body
    const update = {}
    if (name !== undefined) update.name = name
    if (contact !== undefined) update.contact = contact
    if (bank_acct !== undefined) update.bank_acct = bank_acct
    if (qualifications_desc !== undefined) update.qualifications_desc = qualifications_desc
    if (subjects !== undefined) update.subjects = Array.isArray(subjects) ? subjects : []
    if (join_date !== undefined) {
      const d = new Date(join_date)
      if (!isNaN(d.getTime())) update.join_date = admin.firestore.Timestamp.fromDate(d)
    }
    if (active !== undefined) update.active = active
    if (telegramHandle !== undefined) {
      const th = (telegramHandle || '').toString().trim()
      update.telegramHandle = th
      update.telegram_handle = th
    }
    if (telegramChatId !== undefined) {
      const tc = (telegramChatId || '').toString().trim()
      update.telegramChatId = tc
      update.telegram_chat_id = tc
    }
    if (Object.keys(update).length === 0) {
      return res.status(400).json({ error: 'No fields to update' })
    }
    await docRef.update(update)
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.delete('/api/teachers/:id', requireAuth, async (req, res) => {
  try {
    const teacherId = req.params.id
    const classSnap = await db.collection('classes').where('main_teacher_id', '==', teacherId).get()
    for (const c of classSnap.docs) await c.ref.update({ main_teacher_id: '' })
    const lessonSnap = await db.collection('lessons').where('teacher_id', '==', teacherId).get()
    for (const l of lessonSnap.docs) await l.ref.update({ teacher_id: '' })
    await db.collection('teachers').doc(teacherId).delete()
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// --- Students ---
app.get('/api/students', requireAuth, async (req, res) => {
  try {
    const classesSnap = await db.collection('classes').get()
    const classes = classesSnap.docs.map(d => ({ id: d.id, ...d.data() }))
    const studentsSnap = await db.collection('students').get()
    const list = []
    for (const d of studentsSnap.docs) {
      const data = d.data()
      const enrSnap = await db.collection('enrolments').where('student_id', '==', d.id).where('status', '==', 'active').get()
      let totalRatePerLesson = 0
      const enrolledClasses = []
      for (const e of enrSnap.docs) {
        const ed = e.data()
        const cls = classes.find(c => c.id === ed.class_id)
        if (cls) {
          const rate = Number(cls.rate_per_hour ?? cls.rate_per_lesson ?? cls.monthly_fee) || 0
          const duration = Number(cls.default_duration_hours) || 2
          totalRatePerLesson += rate
          enrolledClasses.push({
            id: e.id,
            className: cls.name,
            join_date: ed.join_date,
            ratePerHour: rate,
            defaultDurationHours: duration,
            ratePerLesson: rate,
            monthlyFee: rate
          })
        }
      }
      list.push({ id: d.id, ...data, enrolledClasses, totalRatePerLesson, ratePerHourTotal: totalRatePerLesson, monthlyFee: totalRatePerLesson })
    }
    list.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    res.json(list)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.get('/api/students/:id', requireAuth, async (req, res) => {
  try {
    const doc = await db.collection('students').doc(req.params.id).get()
    if (!doc.exists) return res.status(404).json({ error: 'Not found' })
    const data = doc.data()
    const enrSnap = await db.collection('enrolments').where('student_id', '==', req.params.id).get()
    const classesSnap = await db.collection('classes').get()
    const classes = Object.fromEntries(classesSnap.docs.map(d => [d.id, d.data()]))
    let totalRatePerLesson = 0
    const enrolledClasses = []
    for (const e of enrSnap.docs) {
      const ed = e.data()
      const cls = classes[ed.class_id]
      if (cls && ed.status === 'active') {
        const rate = Number(cls.rate_per_hour ?? cls.rate_per_lesson ?? cls.monthly_fee) || 0
        const duration = Number(cls.default_duration_hours) || 2
        totalRatePerLesson += rate
        enrolledClasses.push({
          id: e.id,
          className: cls.name,
          join_date: ed.join_date,
          ratePerHour: rate,
          defaultDurationHours: duration,
          ratePerLesson: rate,
          monthlyFee: rate
        })
      }
    }
    res.json({ id: doc.id, ...data, enrolledClasses, totalRatePerLesson, ratePerHourTotal: totalRatePerLesson, monthlyFee: totalRatePerLesson })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.post('/api/students', requireAuth, async (req, res) => {
  try {
    const body = req.body || {}
    const ref = await db.collection('students').add({
      name: body.name || '',
      school: body.school || '',
      level: body.level || '',
      parent_name: body.parent_name || '',
      parent_contact: body.parent_contact || '',
      parent_email: body.parent_email || '',
      status: body.status || 'active',
      created_at: admin.firestore.FieldValue.serverTimestamp()
    })
    res.json({ id: ref.id })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.put('/api/students/:id', requireAuth, async (req, res) => {
  try {
    const { name, school, level, parent_name, parent_contact, parent_email, status } = req.body || {}
    const update = {}
    if (name !== undefined) update.name = name
    if (school !== undefined) update.school = school
    if (level !== undefined) update.level = level
    if (parent_name !== undefined) update.parent_name = parent_name
    if (parent_contact !== undefined) update.parent_contact = parent_contact
    if (parent_email !== undefined) update.parent_email = parent_email
    if (status !== undefined) update.status = status
    await db.collection('students').doc(req.params.id).update(update)
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.delete('/api/students/:id', requireAuth, async (req, res) => {
  try {
    const studentId = req.params.id
    const enrSnap = await db.collection('enrolments').where('student_id', '==', studentId).get()
    for (const e of enrSnap.docs) await e.ref.delete()
    const attSnap = await db.collection('attendance').where('student_id', '==', studentId).get()
    for (const a of attSnap.docs) await a.ref.delete()
    await db.collection('students').doc(studentId).delete()
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// --- Enrolments ---
app.get('/api/enrolments', requireAuth, async (req, res) => {
  try {
    const { student_id, class_id } = req.query
    let q = db.collection('enrolments')
    if (student_id) q = q.where('student_id', '==', student_id)
    if (class_id) q = q.where('class_id', '==', class_id)
    const snap = await q.get()
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    res.json(list)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.post('/api/enrolments', requireAuth, async (req, res) => {
  try {
    const { student_id, class_id } = req.body || {}
    if (!student_id || !class_id) return res.status(400).json({ error: 'student_id and class_id required' })
    const dup = await db
      .collection('enrolments')
      .where('student_id', '==', student_id)
      .where('class_id', '==', class_id)
      .limit(1)
      .get()
    if (!dup.empty) {
      const d = dup.docs[0]
      const prev = d.data() || {}
      if (prev.status === 'active') {
        return res.json({ id: d.id, alreadyEnrolled: true })
      }
      await d.ref.update({
        status: 'active',
        join_date: admin.firestore.FieldValue.serverTimestamp()
      })
      return res.json({ id: d.id, reactivated: true })
    }
    const ref = await db.collection('enrolments').add({
      student_id,
      class_id,
      join_date: admin.firestore.FieldValue.serverTimestamp(),
      status: 'active'
    })
    res.json({ id: ref.id })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.put('/api/enrolments/:id', requireAuth, async (req, res) => {
  try {
    const { status } = req.body || {}
    await db.collection('enrolments').doc(req.params.id).update({ status: status || 'inactive' })
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// --- Lessons ---
app.get('/api/lessons', requireAuth, async (req, res) => {
  try {
    const { class_id, from, limit } = req.query
    let q = db.collection('lessons').orderBy('created_at', 'desc')
    if (class_id) q = q.where('class_id', '==', class_id)
    if (from) q = q.where('created_at', '>=', new Date(from))
    if (limit) q = q.limit(Number(limit) || 50)
    const snap = await q.get()
    const list = snap.docs.map(d => {
      const data = d.data()
      return { id: d.id, ...data, created_at: data.created_at?.toMillis?.() ?? data.created_at }
    })
    res.json(list)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.get('/api/lessons/:id', requireAuth, async (req, res) => {
  try {
    const doc = await db.collection('lessons').doc(req.params.id).get()
    if (!doc.exists) return res.status(404).json({ error: 'Not found' })
    const data = doc.data()
    const attSnap = await db.collection('attendance').where('lesson_id', '==', req.params.id).get()
    const attendance = attSnap.docs.map(d => {
      const ad = d.data()
      return {
        id: d.id,
        ...ad,
        duration_hours: ad.duration_hours ?? ad.durationHours ?? null,
        is_makeup: Boolean(ad.is_makeup ?? ad.isMakeup)
      }
    })
    res.json({ id: doc.id, ...data, attendance })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// --- Admin: update a single attendance record (status / duration / makeup / remark) ---
app.put('/api/attendance/:id', requireAuth, async (req, res) => {
  try {
    const attRef = db.collection('attendance').doc(req.params.id)
    const snap = await attRef.get()
    if (!snap.exists) return res.status(404).json({ error: 'Attendance record not found' })

    const body = req.body || {}
    const update = {
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }

    if (body.status !== undefined) update.status = body.status

    if (body.duration_hours !== undefined || body.durationHours !== undefined) {
      const raw = Number(body.duration_hours ?? body.durationHours)
      if (Number.isFinite(raw) && raw > 0) {
        update.duration_hours = raw
        update.durationHours = raw
      }
    }

    if (body.is_makeup !== undefined || body.isMakeup !== undefined) {
      const flag = Boolean(body.is_makeup ?? body.isMakeup)
      update.is_makeup = flag
      update.isMakeup = flag
    }

    if (body.remark !== undefined) update.remark = body.remark ?? ''

    await attRef.update(update)
    const fresh = await attRef.get()
    res.json({ id: fresh.id, ...fresh.data() })
  } catch (e) {
    console.error('[PUT /api/attendance/:id] failed:', e)
    res.status(500).json({ error: e.message || 'Update failed' })
  }
})

// --- Admin: delete a single attendance record ---
app.delete('/api/attendance/:id', requireAuth, async (req, res) => {
  try {
    const attRef = db.collection('attendance').doc(req.params.id)
    const snap = await attRef.get()
    if (!snap.exists) return res.status(404).json({ error: 'Attendance record not found' })
    await attRef.delete()
    res.json({ ok: true, id: req.params.id })
  } catch (e) {
    console.error('[DELETE /api/attendance/:id] failed:', e)
    res.status(500).json({ error: e.message || 'Delete failed' })
  }
})

// --- Admin: delete a lesson record and all attendance docs tied to it ---
app.delete('/api/lessons/:id', requireAuth, async (req, res) => {
  try {
    const lessonId = req.params.id
    const lessonRef = db.collection('lessons').doc(lessonId)
    const lessonSnap = await lessonRef.get()
    if (!lessonSnap.exists) return res.status(404).json({ error: 'Lesson not found' })

    // Delete every attendance document referencing this lesson (both naming
    // conventions in case legacy rows used camelCase).
    const [snakeSnap, camelSnap] = await Promise.all([
      db.collection('attendance').where('lesson_id', '==', lessonId).get(),
      db.collection('attendance').where('lessonId', '==', lessonId).get()
    ])
    const seen = new Set()
    const batch = db.batch()
    for (const d of [...snakeSnap.docs, ...camelSnap.docs]) {
      if (seen.has(d.id)) continue
      seen.add(d.id)
      batch.delete(d.ref)
    }
    batch.delete(lessonRef)
    await batch.commit()

    res.json({ ok: true, id: lessonId, deletedAttendance: seen.size })
  } catch (e) {
    console.error('[DELETE /api/lessons/:id] failed:', e)
    res.status(500).json({ error: e.message || 'Delete failed' })
  }
})

// --- Admin: update lesson record + attendance in a single request ---
app.put('/api/lessons/:id', requireAuth, async (req, res) => {
  try {
    const lessonId = req.params.id
    const lessonRef = db.collection('lessons').doc(lessonId)
    const lessonSnap = await lessonRef.get()
    if (!lessonSnap.exists) return res.status(404).json({ error: 'Lesson not found' })

    const body = req.body || {}
    const lessonData = lessonSnap.data() || {}
    const classId = body.class_id ?? body.classId ?? lessonData.class_id ?? lessonData.classId

    // Resolve class default duration for fallback on new attendance rows.
    let classDefaultDuration = 2
    if (classId) {
      try {
        const classDoc = await db.collection('classes').doc(classId).get()
        if (classDoc.exists) {
          const dur = Number(classDoc.data().default_duration_hours)
          if (Number.isFinite(dur) && dur > 0) classDefaultDuration = dur
        }
      } catch (_) { /* non-fatal */ }
    }

    const update = {}
    const assignBoth = (snake, camel, value) => {
      update[snake] = value
      update[camel] = value
    }
    if (body.lesson_date !== undefined || body.lessonDate !== undefined) {
      assignBoth('lesson_date', 'lessonDate', body.lesson_date ?? body.lessonDate ?? '')
    }
    if (body.start_time !== undefined || body.startTime !== undefined) {
      assignBoth('start_time', 'startTime', body.start_time ?? body.startTime ?? '')
    }
    if (body.end_time !== undefined || body.endTime !== undefined) {
      assignBoth('end_time', 'endTime', body.end_time ?? body.endTime ?? '')
    }
    if (body.teacher_id !== undefined || body.teacherId !== undefined) {
      assignBoth('teacher_id', 'teacherId', body.teacher_id ?? body.teacherId ?? '')
    }
    if (body.remark !== undefined || body.remarks !== undefined) {
      const r = String(body.remark ?? body.remarks ?? '')
      update.remark = r
      update.remarks = r
    }
    if (body.lesson_type !== undefined || body.lessonType !== undefined) {
      const lt = (body.lesson_type ?? body.lessonType ?? '').toString()
      update.lesson_type = lt
      update.lessonType = lt
    }
    if (body.status !== undefined) {
      update.status = (body.status ?? '').toString()
    }
    if (body.description !== undefined) update.description = body.description ?? ''
    if (body.homework !== undefined) update.homework = body.homework ?? ''
    if (body.materials_link !== undefined || body.materialsLink !== undefined) {
      assignBoth('materials_link', 'materialsLink', body.materials_link ?? body.materialsLink ?? '')
    }
    if (body.duration_hours !== undefined || body.durationHours !== undefined) {
      const raw = Number(body.duration_hours ?? body.durationHours)
      const duration = Number.isFinite(raw) && raw > 0 ? raw : classDefaultDuration
      assignBoth('duration_hours', 'durationHours', duration)
    }
    update.updated_at = admin.firestore.FieldValue.serverTimestamp()
    update.updatedAt = admin.firestore.FieldValue.serverTimestamp()

    const batch = db.batch()
    batch.update(lessonRef, update)

    const rows = Array.isArray(body.attendance) ? body.attendance : []
    for (const row of rows) {
      if (!row || typeof row !== 'object') continue
      const studentId = row.student_id ?? row.studentId
      const attId = row.id || null

      // Row-level delete flag: remove this attendance doc if it exists.
      if (row._remove || row.shouldDelete) {
        if (attId) batch.delete(db.collection('attendance').doc(attId))
        continue
      }

      if (!studentId || !row.status) continue
      const rawDur = Number(row.duration_hours ?? row.durationHours)
      const duration = Number.isFinite(rawDur) && rawDur > 0 ? rawDur : classDefaultDuration
      const isMakeup = Boolean(row.is_makeup ?? row.isMakeup)
      const remark = row.remark ?? ''

      if (attId) {
        batch.update(db.collection('attendance').doc(attId), {
          lesson_id: lessonId,
          lessonId: lessonId,
          class_id: classId || null,
          classId: classId || null,
          student_id: studentId,
          studentId: studentId,
          status: row.status,
          remark,
          duration_hours: duration,
          durationHours: duration,
          is_makeup: isMakeup,
          isMakeup: isMakeup,
          updated_at: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        })
      } else {
        const newRef = db.collection('attendance').doc()
        batch.set(newRef, {
          lesson_id: lessonId,
          lessonId: lessonId,
          class_id: classId || null,
          classId: classId || null,
          student_id: studentId,
          studentId: studentId,
          status: row.status,
          remark,
          duration_hours: duration,
          durationHours: duration,
          is_makeup: isMakeup,
          isMakeup: isMakeup,
          created_at: admin.firestore.FieldValue.serverTimestamp(),
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        })
      }
    }

    await batch.commit()
    res.json({ ok: true })
  } catch (e) {
    console.error('[PUT /api/lessons/:id] failed:', e)
    res.status(500).json({ error: e.message || 'Update failed' })
  }
})

// --- Class lessons (for ClassView) ---
app.get('/api/classes/:id/lessons', requireAuth, async (req, res) => {
  try {
    const classId = req.params.id

    // Query by both field name conventions and merge. Done WITHOUT an orderBy so
    // that no composite index is required and docs that happen to be missing
    // `created_at` are still returned. Sorting happens in memory below.
    const [snakeSnap, camelSnap] = await Promise.all([
      db.collection('lessons').where('class_id', '==', classId).get(),
      db.collection('lessons').where('classId', '==', classId).get()
    ])
    const lessonDocs = []
    const seen = new Set()
    for (const d of [...snakeSnap.docs, ...camelSnap.docs]) {
      if (seen.has(d.id)) continue
      seen.add(d.id)
      lessonDocs.push(d)
    }

    const classDoc = await db.collection('classes').doc(classId).get()
    const className = classDoc.exists ? classDoc.data().name : 'Unknown'
    const teachersSnap = await db.collection('teachers').get()
    const teachers = Object.fromEntries(teachersSnap.docs.map(d => [d.id, d.data().name]))
    const studentsSnap = await db.collection('enrolments').where('class_id', '==', classId).get()
    const studentIds = studentsSnap.docs.map(d => d.data().student_id)
    const studentsMap = {}
    for (const id of studentIds) {
      const s = await db.collection('students').doc(id).get()
      if (s.exists) studentsMap[id] = s.data().name
    }

    const lessons = []
    for (const d of lessonDocs) {
      const data = d.data()
      const attSnap = await db.collection('attendance').where('lesson_id', '==', d.id).get()
      const attendance = attSnap.docs.map(att => {
        const ad = att.data()
        return {
          id: att.id,
          ...ad,
          student_id: ad.student_id ?? ad.studentId,
          studentName:
            studentsMap[ad.student_id ?? ad.studentId] ||
            ad.studentName ||
            ad.student_name ||
            'Unknown',
          duration_hours: ad.duration_hours ?? ad.durationHours ?? null,
          is_makeup: Boolean(ad.is_makeup ?? ad.isMakeup)
        }
      })
      lessons.push({
        id: d.id,
        ...data,
        // Normalize both naming conventions so the client can rely on snake_case.
        class_id: data.class_id || data.classId || classId,
        lesson_date: data.lesson_date || data.lessonDate || '',
        start_time: data.start_time ?? data.startTime ?? '',
        end_time: data.end_time ?? data.endTime ?? '',
        teacher_id: data.teacher_id || data.teacherId || '',
        materials_link: data.materials_link || data.materialsLink || '',
        duration_hours: data.duration_hours ?? data.durationHours ?? null,
        created_at: data.created_at || data.createdAt || null,
        className,
        teacherName: (data.teacher_id || data.teacherId) ? (teachers[data.teacher_id || data.teacherId] || 'Unknown') : 'Unknown',
        attendance
      })
    }

    // Newest first, by lesson date (fall back to created_at timestamp).
    const toMs = (value) => {
      if (!value) return 0
      if (typeof value === 'string') {
        const t = Date.parse(value)
        return Number.isNaN(t) ? 0 : t
      }
      if (value?.toDate) return value.toDate().getTime()
      if (typeof value === 'number') return value
      return 0
    }
    lessons.sort((a, b) => {
      const da = toMs(a.lesson_date) || toMs(a.created_at)
      const dbm = toMs(b.lesson_date) || toMs(b.created_at)
      return dbm - da
    })

    res.json(lessons)
  } catch (e) {
    console.error('[GET /api/classes/:id/lessons] failed:', e)
    res.status(500).json({ error: e.message })
  }
})

// --- Attendance status helpers (kept in sync with frontend/src/constants/attendance.js) ---
const ATTENDANCE_PRESENT = 'Present'
const ATTENDANCE_LATE = 'Late'
const ATTENDANCE_ABSENT_VALID = 'Absent (Valid)'
const ATTENDANCE_ABSENT_CHARGED = 'Absent (Charged by Policy)'
const ATTENDANCE_MISSED = 'Missed'

function normalizeAttendanceStatus(status) {
  if (status == null) return ''
  const raw = String(status).trim()
  const lower = raw.toLowerCase()
  if (lower === 'present') return ATTENDANCE_PRESENT
  if (lower === 'late') return ATTENDANCE_LATE
  // Legacy bare "Absent" => treat as valid absence (not chargeable).
  if (lower === 'absent' || lower === 'absent (valid)' || lower === 'absent_valid') {
    return ATTENDANCE_ABSENT_VALID
  }
  if (
    lower === 'absent (charged by policy)' ||
    lower === 'absent (charged)' ||
    lower === 'absent_charged'
  ) {
    return ATTENDANCE_ABSENT_CHARGED
  }
  if (lower === 'missed') return ATTENDANCE_MISSED
  return raw
}

function isChargeableAttendanceStatus(status) {
  const n = normalizeAttendanceStatus(status)
  if (n === ATTENDANCE_MISSED) return false
  return n === ATTENDANCE_PRESENT || n === ATTENDANCE_LATE || n === ATTENDANCE_ABSENT_CHARGED
}

function parseLessonDate(value) {
  if (!value) return null
  if (typeof value === 'string') {
    const m = value.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
    const d = new Date(value)
    return isNaN(d.getTime()) ? null : d
  }
  if (value?.toDate) return value.toDate()
  const d = new Date(value)
  return isNaN(d.getTime()) ? null : d
}

// --- Dashboard ---
app.get('/api/dashboard', requireAuth, async (req, res) => {
  try {
    const [classesSnap, studentsSnap, lessonsAllSnap, attendanceAllSnap] = await Promise.all([
      db.collection('classes').get(),
      db.collection('students').get(),
      db.collection('lessons').get(),
      db.collection('attendance').get()
    ])

    const totalClasses = classesSnap.size
    const totalStudents = studentsSnap.size

    const classRateMap = {}
    const classDefaultDurationMap = {}
    classesSnap.docs.forEach(d => {
      const data = d.data()
      classRateMap[d.id] = Number(data.rate_per_hour ?? data.rate_per_lesson ?? data.monthly_fee) || 0
      const dur = Number(data.default_duration_hours)
      classDefaultDurationMap[d.id] = Number.isFinite(dur) && dur > 0 ? dur : 2
    })

    // Build lesson lookup: lesson_id -> { date, classId, ratePerHour, defaultDuration }
    const lessonMap = {}
    lessonsAllSnap.docs.forEach(d => {
      const data = d.data()
      const classId = data.class_id ?? data.classId
      let ratePerHour = 0
      let defaultDuration = 2
      if (classId) {
        if (classRateMap[classId] == null) {
          console.warn('[dashboard] class not found for lesson', d.id, '(class_id:', classId, ')')
        } else {
          ratePerHour = classRateMap[classId]
          defaultDuration = classDefaultDurationMap[classId] ?? 2
        }
      }
      const lt = String(data.lesson_type ?? data.lessonType ?? '').toLowerCase()
      const st = String(data.status ?? '').toLowerCase()
      const isMissed = lt === 'missed' || st === 'missed'
      lessonMap[d.id] = {
        date: parseLessonDate(data.lesson_date ?? data.lessonDate) || parseLessonDate(data.created_at ?? data.createdAt),
        classId,
        ratePerHour,
        defaultDuration,
        isMissed
      }
    })

    const now = new Date()
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)

    // Revenue thus far = sum(chargeable attendance × rate_per_hour × duration_hours) up to today.
    let revenueThusFar = 0
    const chargeableEntries = []
    attendanceAllSnap.docs.forEach(d => {
      const data = d.data()
      if (!isChargeableAttendanceStatus(data.status)) return
      const lesson = lessonMap[data.lesson_id ?? data.lessonId]
      if (!lesson) return
      if (lesson.isMissed) return
      if (lesson.date && lesson.date > endOfToday) return
      const durationRaw = data.duration_hours ?? data.durationHours
      const duration = Number.isFinite(Number(durationRaw)) && Number(durationRaw) > 0
        ? Number(durationRaw)
        : lesson.defaultDuration
      const amount = (lesson.ratePerHour || 0) * duration
      revenueThusFar += amount
      if (lesson.date) chargeableEntries.push({ date: lesson.date, amount })
    })

    // Revenue grouped by week (Mon-Sun), keyed by the Monday of that week.
    const mondayOfWeek = (date) => {
      const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
      const dow = d.getDay() // Sun=0 .. Sat=6
      const offset = dow === 0 ? -6 : 1 - dow
      d.setDate(d.getDate() + offset)
      d.setHours(0, 0, 0, 0)
      return d
    }
    const weekBuckets = new Map()
    for (const entry of chargeableEntries) {
      if (!entry.date) continue
      const monday = mondayOfWeek(entry.date)
      const key = monday.getTime()
      weekBuckets.set(key, (weekBuckets.get(key) || 0) + entry.amount)
    }
    const weekEntries = Array.from(weekBuckets.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([key, revenue]) => {
        const monday = new Date(key)
        return {
          weekStartDate: monday.toISOString(),
          weekLabel: monday.toLocaleDateString('en-SG', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
          }),
          revenue
        }
      })

    // Revenue grouped by month (YYYY-MM). Always include the current month even
    // if there has been no chargeable revenue yet so the chart has a trailing
    // point for the ongoing period.
    const monthBuckets = new Map()
    for (const entry of chargeableEntries) {
      if (!entry.date) continue
      const mkey = `${entry.date.getFullYear()}-${String(entry.date.getMonth() + 1).padStart(2, '0')}`
      monthBuckets.set(mkey, (monthBuckets.get(mkey) || 0) + entry.amount)
    }
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    if (!monthBuckets.has(currentMonthKey)) {
      monthBuckets.set(currentMonthKey, 0)
    }
    const monthEntries = Array.from(monthBuckets.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, revenue]) => {
        const [y, m] = key.split('-').map(Number)
        const firstOfMonth = new Date(y, m - 1, 1)
        return {
          monthKey: key,
          monthLabel: firstOfMonth.toLocaleDateString('en-SG', {
            month: 'short',
            year: 'numeric'
          }),
          revenue
        }
      })
    // Current week (Monday 00:00 .. Sunday 23:59:59.999).
    const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const dayOfWeek = startOfWeek.getDay()
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
    startOfWeek.setDate(startOfWeek.getDate() + diffToMonday)
    startOfWeek.setHours(0, 0, 0, 0)
    const endOfWeek = new Date(startOfWeek)
    endOfWeek.setDate(endOfWeek.getDate() + 6)
    endOfWeek.setHours(23, 59, 59, 999)

    // Classes This Week = lessons whose actual lesson_date falls in this week.
    let weeklyClassesCount = 0
    for (const lesson of Object.values(lessonMap)) {
      if (!lesson.date) continue
      if (lesson.date >= startOfWeek && lesson.date <= endOfWeek) {
        weeklyClassesCount += 1
      }
    }

    // Recent Lesson Submissions (newest first, by submission time).
    const startOfWeekTs = admin.firestore.Timestamp.fromDate(startOfWeek)
    const lessonsSnap = await db.collection('lessons').where('created_at', '>=', startOfWeekTs).orderBy('created_at', 'desc').limit(10).get()
    const recentLessons = []
    const classIds = [...new Set(lessonsSnap.docs.map(d => d.data().class_id))]
    const teacherIds = [...new Set(lessonsSnap.docs.map(d => d.data().teacher_id).filter(Boolean))]
    const classesMap = {}
    const teachersMap = {}
    for (const id of classIds) {
      const c = await db.collection('classes').doc(id).get()
      if (c.exists) classesMap[id] = c.data().name
    }
    for (const id of teacherIds) {
      const t = await db.collection('teachers').doc(id).get()
      if (t.exists) teachersMap[id] = t.data().name
    }
    for (const d of lessonsSnap.docs) {
      const data = d.data()
      const attSnap = await db.collection('attendance').where('lesson_id', '==', d.id).get()
      const attendance = attSnap.docs.map(a => a.data())
      recentLessons.push({
        id: d.id,
        ...data,
        className: classesMap[data.class_id] || 'Unknown',
        teacherName: data.teacher_id ? (teachersMap[data.teacher_id] || 'Unknown') : 'Unknown',
        attendance
      })
    }
    res.json({
      totalClasses,
      totalStudents,
      revenueThusFar,
      // Alias kept for any older clients still reading the previous field name.
      monthlyRevenue: revenueThusFar,
      revenueByWeek: weekEntries,
      revenueByMonth: monthEntries,
      weeklyClassesCount,
      recentLessons
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// --- Cron: lesson submission reminders (call every 5 min from Vercel Cron or another scheduler) ---
app.get('/api/cron/telegram-lesson-reminders', async (req, res) => {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const hdr =
      req.headers['x-cron-secret'] ||
      (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
    if (hdr !== secret) return res.status(401).json({ error: 'Unauthorized' })
  }
  try {
    const result = await runTelegramLessonReminders({ db, admin, log: console.log })
    res.json({ ok: true, ...result })
  } catch (e) {
    console.error('[cron telegram-lesson-reminders]', e)
    res.status(500).json({ error: e.message })
  }
})

// Telegram lesson reminders: long-running Node server polls every 5 minutes.
// On Vercel, disable polling and schedule GET /api/cron/telegram-lesson-reminders instead.
const TELEGRAM_POLL_MS = 5 * 60 * 1000
if (process.env.TELEGRAM_BOT_TOKEN && process.env.APP_BASE_URL && !process.env.VERCEL) {
  setTimeout(() => {
    runTelegramLessonReminders({ db, admin, log: console.log }).catch((e) =>
      console.error('[telegram reminders]', e)
    )
  }, 20_000)
  setInterval(() => {
    runTelegramLessonReminders({ db, admin, log: console.log }).catch((e) =>
      console.error('[telegram reminders]', e)
    )
  }, TELEGRAM_POLL_MS)
}

// Return JSON (not HTML) for unknown paths so the SPA client can show a useful error
// and parse `error` (avoids a useless "Request failed" when the response body is HTML).
app.use((req, res) => {
  res.status(404).json({ error: `Not found: ${req.method} ${req.originalUrl || req.url || ''}` })
})

// Export the Express app so serverless platforms (e.g. Vercel) can invoke it
// without a long-running HTTP server. The Vercel entry point lives at
// `backend/api/index.js`.
export default app

// Only start a real HTTP server when this file is run directly (local dev or
// a container / VPS). On Vercel the file is imported, so `app.listen` is
// skipped.
const invokedDirectly =
  process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
if (invokedDirectly && !process.env.VERCEL) {
  app.listen(PORT, () => console.log(`Backend running on http://localhost:${PORT}`))
}
