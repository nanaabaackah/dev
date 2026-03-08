import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { normalizeLegacySessionToken } from './utils/authSession'

const AUTH_CSRF_COOKIE_NAME = import.meta.env.VITE_AUTH_CSRF_COOKIE_NAME || 'dev_kpi_csrf'
const FETCH_PATCH_FLAG = '__devKpiApiFetchPatched__'

const readCookie = (name) => {
  if (!name || typeof document === 'undefined') return ''
  const entries = document.cookie ? document.cookie.split(';') : []
  for (const entry of entries) {
    const [rawKey, ...rawValueParts] = entry.split('=')
    let key = rawKey.trim()
    try {
      key = decodeURIComponent(rawKey.trim())
    } catch {
      key = rawKey.trim()
    }
    if (key !== name) continue
    const rawValue = rawValueParts.join('=').trim()
    try {
      return decodeURIComponent(rawValue)
    } catch {
      return rawValue
    }
  }
  return ''
}

const isApiRequest = (input) => {
  if (typeof window === 'undefined') return false
  const rawUrl =
    typeof input === 'string' || input instanceof URL
      ? String(input)
      : input instanceof Request
        ? input.url
        : ''
  if (!rawUrl) return false
  try {
    const parsed = new URL(rawUrl, window.location.origin)
    return parsed.pathname.startsWith('/api/')
  } catch {
    return false
  }
}

const isCsrfMethod = (method) => {
  const normalized = String(method || 'GET').toUpperCase()
  return !['GET', 'HEAD', 'OPTIONS'].includes(normalized)
}

const patchApiFetch = () => {
  if (typeof window === 'undefined' || window[FETCH_PATCH_FLAG]) return
  const nativeFetch = window.fetch.bind(window)

  window.fetch = (input, init = {}) => {
    if (!isApiRequest(input)) {
      return nativeFetch(input, init)
    }

    const method =
      init.method || (input instanceof Request ? input.method : 'GET')
    const headers = new Headers(
      init.headers || (input instanceof Request ? input.headers : undefined),
    )
    if (isCsrfMethod(method) && !headers.has('x-csrf-token')) {
      const csrfToken = readCookie(AUTH_CSRF_COOKIE_NAME)
      if (csrfToken) {
        headers.set('x-csrf-token', csrfToken)
      }
    }

    const credentials =
      init.credentials ||
      (input instanceof Request ? input.credentials : undefined) ||
      'include'

    return nativeFetch(input, {
      ...init,
      headers,
      credentials,
    })
  }

  window[FETCH_PATCH_FLAG] = true
}

patchApiFetch()
normalizeLegacySessionToken()

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
