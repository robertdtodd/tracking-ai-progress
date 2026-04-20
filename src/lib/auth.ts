export const SESSION_COOKIE = 'editor_session'
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30

function toBase64Url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function hmac(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))
  return toBase64Url(sig)
}

export async function signSession(secret: string, issuedAt = Date.now()): Promise<string> {
  const payload = String(issuedAt)
  const sig = await hmac(secret, payload)
  return `${payload}.${sig}`
}

export async function verifySession(
  secret: string,
  cookieValue: string | undefined,
): Promise<boolean> {
  if (!cookieValue) return false
  const parts = cookieValue.split('.')
  if (parts.length !== 2) return false
  const [payload, providedSig] = parts
  const issuedAt = Number(payload)
  if (!Number.isFinite(issuedAt)) return false
  const ageMs = Date.now() - issuedAt
  if (ageMs < 0 || ageMs > SESSION_MAX_AGE * 1000) return false
  const expectedSig = await hmac(secret, payload)
  if (expectedSig.length !== providedSig.length) return false
  let diff = 0
  for (let i = 0; i < expectedSig.length; i++) {
    diff |= expectedSig.charCodeAt(i) ^ providedSig.charCodeAt(i)
  }
  return diff === 0
}
