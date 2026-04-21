const BASE = import.meta.env.VITE_API_URL || ''

const TOKEN_KEY = 'tms_token'
const SESSION_EXPIRED_MESSAGE = 'Session expired. Please log in again.'

let redirecting = false

function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

function clearToken() {
  localStorage.removeItem(TOKEN_KEY)
}

async function firebaseSignOut() {
  try {
    const { getAuth, signOut } = await import('firebase/auth')
    await signOut(getAuth())
  } catch (_) {
    // ignore; Firebase may not be initialized yet or already signed out
  }
}

function handleUnauthorized() {
  clearToken()
  firebaseSignOut()
  if (typeof window === 'undefined') return
  if (redirecting) return
  const pathname = window.location.pathname || ''
  if (pathname.startsWith('/login')) return
  redirecting = true
  window.location.replace('/login?reason=session-expired')
}

function isPublicPath(path) {
  return path.startsWith('/api/public/') || path.startsWith('/api/auth/')
}

async function request(method, path, body = undefined, { requireAuth } = {}) {
  const needsAuth = requireAuth ?? !isPublicPath(path)
  const token = getToken()
  if (needsAuth && !token) {
    handleUnauthorized()
    const err = new Error(SESSION_EXPIRED_MESSAGE)
    err.status = 401
    throw err
  }
  const opts = { method, headers: {} }
  if (token) opts.headers.Authorization = `Bearer ${token}`
  if (body !== undefined && body !== null) {
    opts.headers['Content-Type'] = 'application/json'
    opts.body = JSON.stringify(body)
  }
  let res
  try {
    res = await fetch(BASE + path, opts)
  } catch (networkErr) {
    const err = new Error(networkErr.message || 'Network error. Please check your connection.')
    err.cause = networkErr
    throw err
  }
  if (res.status === 401 && needsAuth) {
    handleUnauthorized()
    const err = new Error(SESSION_EXPIRED_MESSAGE)
    err.status = 401
    throw err
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(data.error || res.statusText || 'Request failed')
    err.status = res.status
    throw err
  }
  return data
}

export const api = {
  get: (path) => request('GET', path),
  post: (path, body) => request('POST', path, body),
  put: (path, body) => request('PUT', path, body),
  delete: (path) => request('DELETE', path),
  getPublic: (path) => request('GET', path, undefined, { requireAuth: false }),
  postPublic: (path, body) => request('POST', path, body, { requireAuth: false }),
  getToken,
  setToken,
  clearToken
}
