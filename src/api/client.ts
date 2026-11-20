/**
 * HTTP 공통 계층. 백엔드가 바뀌면 이 파일(인증 헤더, base URL, 에러 형태)과
 * 각 리소스 어댑터의 DTO 변환만 수정함. 화면은 이 파일을 직접 쓰지 않음.
 */

import { auth, bearerToken } from './auth'

const BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')
const API_PATH = import.meta.env.VITE_USE_MOCK === 'false' ? '/api/reading' : '/api'

export class ApiError extends Error {
  readonly status: number
  readonly body: unknown
  constructor(status: number, message: string, body?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.body = body
  }
}

type Query = Record<string, string | number | boolean | undefined>

export function requestKeyHeaders(): Record<string, string> {
  return typeof globalThis.crypto?.randomUUID === 'function' ? { 'Idempotency-Key': crypto.randomUUID() } : {}
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  query?: Query
  body?: unknown
}

function buildUrl(path: string, query?: Query) {
  const url = `${BASE_URL}${API_PATH}${path}`
  if (!query) return url
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(query)) if (v !== undefined) qs.set(k, String(v))
  const s = qs.toString()
  return s ? `${url}?${s}` : url
}

export async function http<T>(path: string, { query, body, headers, ...init }: RequestOptions = {}): Promise<T> {
  const token = bearerToken()
  if (auth && !token) throw new ApiError(401, '로그인이 필요해요.')
  const isForm = body instanceof FormData
  const res = await fetch(buildUrl(path, query), {
    ...init,
    headers: {
      ...(body !== undefined && !isForm ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
    },
    body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
  })

  const text = await res.text()
  if (text && !res.headers.get('content-type')?.includes('json')) {
    throw new ApiError(res.status, '독서 서버 주소와 배포 상태를 확인해 주세요.')
  }
  const data = text ? JSON.parse(text) : undefined
  if (!res.ok) {
    const message = (typeof data?.message === 'string' && data.message)
      || (typeof data?.detail === 'string' && data.detail)
      || res.statusText
    throw new ApiError(res.status, message, data)
  }
  return data as T
}
