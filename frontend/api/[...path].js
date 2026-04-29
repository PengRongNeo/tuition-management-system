/**
 * Proxy /api/* on the **frontend** Vercel project to the real Express backend.
 * Without this, /api/... hits the static SPA and returns 404 (Telegram webhooks
 * must not use the frontend-only URL unless this proxy is active).
 *
 * Set BACKEND_API_URL or VITE_API_BASE_URL in the frontend project's env to the
 * backend origin only, e.g. https://your-backend.vercel.app (no /api suffix).
 */
import { buffer } from 'node:stream/consumers'

function normalizeBackendOrigin () {
  const raw = (process.env.BACKEND_API_URL || process.env.VITE_API_BASE_URL || '').trim()
  if (!raw) return ''
  let s = raw.replace(/\/$/, '')
  if (s.toLowerCase().endsWith('/api')) s = s.slice(0, -4)
  return s
}

export default async function handler (req, res) {
  const base = normalizeBackendOrigin()
  if (!base) {
    res.status(503).json({
      error: 'Backend proxy not configured',
      hint:
        'Set BACKEND_API_URL (or VITE_API_BASE_URL) on this Vercel project to your backend URL, e.g. https://your-api.vercel.app — or point Telegram setWebhook at the backend URL directly.'
    })
    return
  }

  const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost'
  const proto = req.headers['x-forwarded-proto'] || 'https'
  const incoming = new URL(req.url || '/', `${proto}://${host}`)
  const destUrl = `${base}${incoming.pathname}${incoming.search}`

  let bodyBuf
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    try {
      bodyBuf = await buffer(req)
    } catch (_) {
      bodyBuf = undefined
    }
  }

  const headers = new Headers()
  for (const [k, v] of Object.entries(req.headers)) {
    if (v == null) continue
    const lk = k.toLowerCase()
    if (['host', 'connection', 'content-length'].includes(lk)) continue
    if (Array.isArray(v)) v.forEach((x) => headers.append(k, x))
    else headers.set(k, v)
  }

  const init = { method: req.method, headers, redirect: 'manual' }
  if (bodyBuf && bodyBuf.length) init.body = bodyBuf

  let r
  try {
    r = await fetch(destUrl, init)
  } catch (e) {
    res.status(502).json({ error: 'Proxy fetch failed', detail: String(e?.message || e) })
    return
  }

  res.status(r.status)
  r.headers.forEach((value, key) => {
    if (key.toLowerCase() === 'transfer-encoding') return
    res.setHeader(key, value)
  })
  const out = Buffer.from(await r.arrayBuffer())
  res.send(out)
}
