const BASE = import.meta.env.VITE_API_URL || ''

function getToken() {
  return localStorage.getItem('tms_token')
}

function setToken(token) {
  if (token) localStorage.setItem('tms_token', token)
  else localStorage.removeItem('tms_token')
}

function clearToken() {
  localStorage.removeItem('tms_token')
}

async function request(method, path, body = undefined) {
  const opts = { method, headers: {} }
  const token = getToken()
  if (token) opts.headers.Authorization = `Bearer ${token}`
  if (body !== undefined && body !== null) {
    opts.headers['Content-Type'] = 'application/json'
    opts.body = JSON.stringify(body)
  }
  const res = await fetch(BASE + path, opts)
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || res.statusText || 'Request failed')
  return data
}

async function requestPublic(method, path, body = undefined) {
  const opts = { method, headers: {} }
  if (body !== undefined && body !== null) {
    opts.headers['Content-Type'] = 'application/json'
    opts.body = JSON.stringify(body)
  }
  const res = await fetch(BASE + path, opts)
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || res.statusText || 'Request failed')
  return data
}

export const api = {
  get: (path) => request('GET', path),
  post: (path, body) => request('POST', path, body),
  put: (path, body) => request('PUT', path, body),
  delete: (path) => request('DELETE', path),
  getPublic: (path) => requestPublic('GET', path),
  postPublic: (path, body) => requestPublic('POST', path, body),
  getToken,
  setToken,
  clearToken
}
