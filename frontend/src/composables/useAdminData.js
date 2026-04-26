/**
 * Session-level cache for admin views: one load per visit (or after logout),
 * deduped in-flight requests, and granular refresh after mutations.
 */
import { ref } from 'vue'
import { api } from '../api'
import { db, auth } from '../firebase'
import { collection, getDocs, query, where } from 'firebase/firestore'

const TTL_MS = 5 * 60 * 1000

export const students = ref([])
export const classes = ref([])
export const teachers = ref([])
export const lessons = ref([])
export const attendance = ref([])
export const pendingStudents = ref([])

export const isLoaded = ref(false)
export const isLoading = ref(false)
export const lastLoadedAt = ref(null)

let loadCorePromise = null
let backgroundRefreshInFlight = null

function sortStudents (list) {
  return [...(list || [])].sort((a, b) => (a.name || '').localeCompare(b.name || ''))
}

function sortTeachers (list) {
  return [...(list || [])].sort((a, b) => (a.name || '').localeCompare(b.name || ''))
}

async function fetchStudents () {
  const list = await api.get('/api/students')
  students.value = sortStudents(list)
}

async function fetchClasses () {
  const list = await api.get('/api/classes')
  classes.value = list || []
}

async function fetchTeachers () {
  const list = await api.get('/api/teachers')
  teachers.value = sortTeachers(list)
}

async function fetchLessons () {
  await auth.authStateReady?.()
  if (!auth.currentUser) {
    lessons.value = []
    return
  }
  const snap = await getDocs(collection(db, 'lessons'))
  lessons.value = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

async function fetchAttendance () {
  await auth.authStateReady?.()
  if (!auth.currentUser) {
    attendance.value = []
    return
  }
  const snap = await getDocs(collection(db, 'attendance'))
  attendance.value = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

function toSubmittedDate (value) {
  if (!value) return null
  if (value?.toDate) return value.toDate()
  if (typeof value === 'number') return new Date(value)
  if (typeof value === 'string') {
    const d = new Date(value)
    return Number.isNaN(d.getTime()) ? null : d
  }
  if (value?.seconds != null) return new Date(value.seconds * 1000)
  return null
}

// Same source as `PendingStudentsTable` (collection `pendingStudents`, not the REST `pending_students` bucket).
async function fetchPendingStudents () {
  await auth.authStateReady?.()
  if (!auth.currentUser) {
    pendingStudents.value = []
    return
  }
  const q = query(
    collection(db, 'pendingStudents'),
    where('status', '==', 'pending')
  )
  const snap = await getDocs(q)
  const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
  docs.sort(
    (a, b) =>
      (toSubmittedDate(b.submittedAt)?.getTime() ?? 0) -
      (toSubmittedDate(a.submittedAt)?.getTime() ?? 0)
  )
  pendingStudents.value = docs.map((p) => ({ ...p, officialSchool: p.officialSchool || '' }))
}

function scheduleStaleRefresh () {
  if (!isLoaded.value || !lastLoadedAt.value) return
  if (Date.now() - lastLoadedAt.value.getTime() < TTL_MS) return
  if (backgroundRefreshInFlight) return
  backgroundRefreshInFlight = (async () => {
    try {
      await loadCoreData({ force: true, background: true })
    } finally {
      backgroundRefreshInFlight = null
    }
  })()
}

async function loadCoreData ({ force = false, background = false } = {}) {
  await auth.authStateReady?.()
  if (!auth.currentUser) {
    clearAdminData()
    return
  }
  if (loadCorePromise && !force) {
    return loadCorePromise
  }
  if (force && loadCorePromise) {
    try {
      await loadCorePromise
    } catch (_) { /* let new load run */ }
  }
  if (!background) isLoading.value = true
  const p = (async () => {
    try {
      await Promise.all([
        fetchStudents(),
        fetchClasses(),
        fetchTeachers(),
        fetchLessons(),
        fetchAttendance(),
        fetchPendingStudents()
      ])
      isLoaded.value = true
      lastLoadedAt.value = new Date()
    } catch (e) {
      console.error('[useAdminData] loadCoreData failed', e)
      isLoaded.value = false
      throw e
    }
  })()
  loadCorePromise = p.finally(() => {
    isLoading.value = false
    loadCorePromise = null
  })
  return loadCorePromise
}

/**
 * @param {{ force?: boolean }=} opts
 * If data is already loaded and force is false, returns after optional stale-refresh scheduling.
 * Reuses a single in-flight load promise.
 */
export async function loadAdminData ({ force = false } = {}) {
  if (isLoaded.value && !force) {
    scheduleStaleRefresh()
    return
  }
  return loadCoreData({ force, background: false })
}

export async function refreshAll ({ background = false } = {}) {
  return loadCoreData({ force: true, background })
}

export async function refreshStudents () {
  await auth.authStateReady?.()
  if (!auth.currentUser) return
  try {
    await fetchStudents()
  } catch (e) {
    console.error('[useAdminData] refreshStudents', e)
  }
}

export async function refreshClasses () {
  await auth.authStateReady?.()
  if (!auth.currentUser) return
  try {
    await fetchClasses()
  } catch (e) {
    console.error('[useAdminData] refreshClasses', e)
  }
}

export async function refreshTeachers () {
  await auth.authStateReady?.()
  if (!auth.currentUser) return
  try {
    await fetchTeachers()
  } catch (e) {
    console.error('[useAdminData] refreshTeachers', e)
  }
}

export async function refreshLessons () {
  await auth.authStateReady?.()
  if (!auth.currentUser) return
  try {
    await fetchLessons()
  } catch (e) {
    console.error('[useAdminData] refreshLessons', e)
  }
}

export async function refreshAttendance () {
  await auth.authStateReady?.()
  if (!auth.currentUser) return
  try {
    await fetchAttendance()
  } catch (e) {
    console.error('[useAdminData] refreshAttendance', e)
  }
}

export async function refreshPendingStudents () {
  await auth.authStateReady?.()
  if (!auth.currentUser) return
  try {
    await fetchPendingStudents()
  } catch (e) {
    console.error('[useAdminData] refreshPendingStudents', e)
  }
}

export function clearAdminData () {
  students.value = []
  classes.value = []
  teachers.value = []
  lessons.value = []
  attendance.value = []
  pendingStudents.value = []
  isLoaded.value = false
  isLoading.value = false
  lastLoadedAt.value = null
  loadCorePromise = null
  backgroundRefreshInFlight = null
}

export function useAdminData () {
  return {
    students,
    classes,
    teachers,
    lessons,
    attendance,
    pendingStudents,
    isLoaded,
    isLoading,
    lastLoadedAt,
    loadAdminData,
    refreshAll,
    refreshStudents,
    refreshClasses,
    refreshTeachers,
    refreshLessons,
    refreshAttendance,
    refreshPendingStudents,
    clearAdminData
  }
}
