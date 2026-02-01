import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import path from 'path'
import { readdirSync, readFileSync, existsSync } from 'fs'
import { fileURLToPath } from 'url'
import admin from 'firebase-admin'

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
  const credPath = getServiceAccountPath()
  if (credPath) {
    const key = JSON.parse(readFileSync(credPath, 'utf8'))
    admin.initializeApp({ credential: admin.credential.cert(key) })
  } else if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
      })
    })
  } else {
    console.error('Missing Firebase Admin config. Set GOOGLE_APPLICATION_CREDENTIALS, or place service account JSON in backend/node_modules (e.g. serviceAccountKey.json or *firebase*adminsdk*.json), or set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY')
    process.exit(1)
  }
}

const db = admin.firestore()
const auth = admin.auth()
const app = express()
const PORT = process.env.PORT || 4000
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:3000'

app.use(cors({ origin: FRONTEND_ORIGIN, credentials: true }))
app.use(express.json())

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

// --- Public: create student from Google Form (no auth; requires X-Form-Secret header) ---
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
    const ref = await db.collection('students').add({
      name: (body.name || '').trim(),
      school: (body.school || '').trim(),
      level: (body.level || '').trim(),
      parent_name: (body.parent_name || '').trim(),
      parent_contact: (body.parent_contact || '').trim(),
      parent_email: (body.parent_email || '').trim(),
      status: body.status === 'inactive' ? 'inactive' : 'active',
      created_at: admin.firestore.FieldValue.serverTimestamp()
    })
    res.status(201).json({ id: ref.id, ok: true })
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
    res.json({ id: classDoc.id, ...classData, teacherName, students })
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
    const lessonRef = await db.collection('lessons').add({
      class_id: classId,
      teacher_id: teacherId,
      lesson_date: lessonDate,
      description: description || '',
      homework: homework || '',
      materials_link: materialsLink || '',
      created_at: admin.firestore.FieldValue.serverTimestamp()
    })
    const batch = db.batch()
    for (const [studentId, att] of Object.entries(attendance)) {
      if (!att?.status) continue
      const ref = db.collection('attendance').doc()
      batch.set(ref, { lesson_id: lessonRef.id, student_id: studentId, status: att.status, remark: att.remark || '' })
    }
    await batch.commit()
    res.json({ id: lessonRef.id })
  } catch (e) {
    res.status(500).json({ error: e.message || 'Submit failed' })
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
      students.push({ id: e.id, student_id: ed.student_id, studentName: s.exists ? s.data().name : 'Unknown', join_date: ed.join_date, status: ed.status })
    }
    res.json({ id: doc.id, ...data, teacherName, students })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.post('/api/classes', requireAuth, async (req, res) => {
  try {
    const { name, subject, level, stream, day_of_week, start_time, end_time, main_teacher_id, monthly_fee, active } = req.body || {}
    const ref = await db.collection('classes').add({
      name: name || '',
      subject: subject || '',
      level: level || '',
      stream: stream || '',
      day_of_week: day_of_week || '',
      start_time: start_time || '',
      end_time: end_time || '',
      main_teacher_id: main_teacher_id || '',
      monthly_fee: Number(monthly_fee) || 0,
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
    const { name, subject, level, stream, day_of_week, start_time, end_time, main_teacher_id, monthly_fee, active } = req.body || {}
    await db.collection('classes').doc(req.params.id).update({
      name: name ?? '',
      subject: subject ?? '',
      level: level ?? '',
      stream: stream ?? '',
      day_of_week: day_of_week ?? '',
      start_time: start_time ?? '',
      end_time: end_time ?? '',
      main_teacher_id: main_teacher_id ?? '',
      monthly_fee: Number(monthly_fee) ?? 0,
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
    const { name, contact, bank_acct, qualifications_desc, subjects, join_date, active } = req.body || {}
    const ref = await db.collection('teachers').add({
      name: name || '',
      contact: contact || '',
      bank_acct: bank_acct || '',
      qualifications_desc: qualifications_desc || '',
      subjects: Array.isArray(subjects) ? subjects : [],
      join_date: join_date ? admin.firestore.Timestamp.fromDate(new Date(join_date)) : admin.firestore.FieldValue.serverTimestamp(),
      active: active !== false
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
    const { name, contact, bank_acct, qualifications_desc, subjects, join_date, active } = body
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
      let monthlyFee = 0
      const enrolledClasses = []
      for (const e of enrSnap.docs) {
        const ed = e.data()
        const cls = classes.find(c => c.id === ed.class_id)
        if (cls) {
          monthlyFee += Number(cls.monthly_fee) || 0
          enrolledClasses.push({ id: e.id, className: cls.name, join_date: ed.join_date, monthlyFee: cls.monthly_fee })
        }
      }
      list.push({ id: d.id, ...data, enrolledClasses, monthlyFee })
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
    let monthlyFee = 0
    const enrolledClasses = []
    for (const e of enrSnap.docs) {
      const ed = e.data()
      const cls = classes[ed.class_id]
      if (cls && ed.status === 'active') {
        monthlyFee += Number(cls.monthly_fee) || 0
        enrolledClasses.push({ id: e.id, className: cls.name, join_date: ed.join_date, monthlyFee: cls.monthly_fee })
      }
    }
    res.json({ id: doc.id, ...data, enrolledClasses, monthlyFee })
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
    const attendance = attSnap.docs.map(d => ({ id: d.id, ...d.data() }))
    res.json({ id: doc.id, ...data, attendance })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// --- Class lessons (for ClassView) ---
app.get('/api/classes/:id/lessons', requireAuth, async (req, res) => {
  try {
    const snap = await db.collection('lessons').where('class_id', '==', req.params.id).orderBy('created_at', 'desc').get()
    const lessons = []
    const classDoc = await db.collection('classes').doc(req.params.id).get()
    const className = classDoc.exists ? classDoc.data().name : 'Unknown'
    const teachersSnap = await db.collection('teachers').get()
    const teachers = Object.fromEntries(teachersSnap.docs.map(d => [d.id, d.data().name]))
    const studentsSnap = await db.collection('enrolments').where('class_id', '==', req.params.id).get()
    const studentIds = studentsSnap.docs.map(d => d.data().student_id)
    const studentsMap = {}
    for (const id of studentIds) {
      const s = await db.collection('students').doc(id).get()
      if (s.exists) studentsMap[id] = s.data().name
    }
    for (const d of snap.docs) {
      const data = d.data()
      const attSnap = await db.collection('attendance').where('lesson_id', '==', d.id).get()
      const attendance = attSnap.docs.map(att => {
        const ad = att.data()
        return { ...ad, student_id: ad.student_id, studentName: studentsMap[ad.student_id] || 'Unknown' }
      })
      lessons.push({
        id: d.id,
        ...data,
        className,
        teacherName: data.teacher_id ? teachers[data.teacher_id] : 'Unknown',
        attendance
      })
    }
    res.json(lessons)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// --- Dashboard ---
app.get('/api/dashboard', requireAuth, async (req, res) => {
  try {
    const classesSnap = await db.collection('classes').get()
    const totalClasses = classesSnap.size
    const classFeeMap = {}
    classesSnap.docs.forEach(d => { classFeeMap[d.id] = Number(d.data().monthly_fee) || 0 })
    const studentsSnap = await db.collection('students').get()
    const totalStudents = studentsSnap.size
    const enrolmentsSnap = await db.collection('enrolments').get()
    let monthlyRevenue = 0
    enrolmentsSnap.docs.forEach(d => {
      const { class_id, status } = d.data()
      if (status !== 'inactive' && class_id && classFeeMap[class_id] != null) monthlyRevenue += classFeeMap[class_id]
    })
    const enrolmentsWithFee = enrolmentsSnap.docs.map(d => {
      const { class_id, join_date, status } = d.data()
      const fee = class_id && classFeeMap[class_id] != null ? classFeeMap[class_id] : 0
      const joinDate = join_date?.toDate ? join_date.toDate() : (join_date ? new Date(join_date) : null)
      return { joinDate, fee, status }
    }).filter(e => e.joinDate != null)
    const now = new Date()
    const monthLabels = []
    const monthRevenues = []
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const endOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59)
      const isCurrentMonth = d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
      monthLabels.push(d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }))
      const rev = enrolmentsWithFee
        .filter(e => e.joinDate <= endOfMonth && (!isCurrentMonth || e.status !== 'inactive'))
        .reduce((sum, e) => sum + e.fee, 0)
      monthRevenues.push(rev)
    }
    const startOfWeek = new Date(now)
    const day = now.getDay()
    const diff = now.getDate() - day + (day === 0 ? -6 : 1)
    startOfWeek.setDate(diff)
    startOfWeek.setHours(0, 0, 0, 0)
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
    const weeklyClassesCount = recentLessons.length
    res.json({
      totalClasses,
      totalStudents,
      monthlyRevenue,
      revenueByMonth: { labels: monthLabels, values: monthRevenues },
      weeklyClassesCount,
      recentLessons
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.listen(PORT, () => console.log(`Backend running on http://localhost:${PORT}`))
