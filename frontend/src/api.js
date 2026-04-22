// Backend origin. In production (e.g. Vercel) set VITE_API_BASE_URL to the
// deployed backend URL, e.g. https://tms-api.vercel.app. Locally this is left
// empty so the Vite dev server's /api proxy (see vite.config.js) forwards
// requests to http://localhost:4000. VITE_API_URL is kept as a fallback for
// backward compatibility with the previous env var name.
function normalizeBase(raw) {
  if (!raw) return ''
  let s = String(raw).trim()
  if (!s) return ''
  // Strip trailing slashes so BASE + "/api/foo" is always exactly one slash.
  s = s.replace(/\/+$/, '')
  // Be forgiving if someone forgets the scheme (e.g. "myapi.vercel.app").
  if (!/^https?:\/\//i.test(s)) {
    console.warn(
      `[api] VITE_API_BASE_URL "${raw}" is missing https://; assuming https://${s}. ` +
        'Update your env to include the scheme.'
    )
    s = `https://${s}`
  }
  return s
}

const BASE = normalizeBase(
  import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || ''
)

if (typeof window !== 'undefined') {
  console.info('[api] API_BASE_URL =', BASE || '(empty — using Vite dev proxy)')
}

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
  const fullUrl = BASE + path
  let res
  try {
    res = await fetch(fullUrl, opts)
  } catch (networkErr) {
    // "Failed to fetch" almost always means one of:
    //   * BASE is wrong or unreachable
    //   * CORS rejected the request (browser blocks the response)
    //   * User is offline
    // We surface the full URL we tried to hit so it's obvious in DevTools.
    console.error('[api] request failed', { method, url: fullUrl, error: networkErr })
    const err = new Error(
      `Could not reach backend at ${fullUrl}. ` +
        'Check the API URL and the backend CORS configuration.'
    )
    err.cause = networkErr
    err.url = fullUrl
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
