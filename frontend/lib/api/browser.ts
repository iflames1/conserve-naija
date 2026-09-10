import { getBrowserAccessToken } from "@/lib/auth/browser-token"
import { publicApiUrl } from "@/lib/config"

const API_TIMEOUT_MS = 8_000

async function authHeaders(): Promise<HeadersInit> {
    const token = await getBrowserAccessToken()
    return {
        "content-type": "application/json",
        Authorization: `Bearer ${token}`,
    }
}

async function parse<T>(response: Response, fallback: string): Promise<T> {
    if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
            error?: string
        } | null
        throw new Error(body?.error ?? `${fallback} (${response.status})`)
    }
    return (await response.json()) as T
}

/** Browser → API. Avoids Next.js server-action ↔ JWKS deadlock. */
export async function browserApi<T>(
    path: string,
    init: RequestInit & { fallback?: string; auth?: boolean } = {}
): Promise<T> {
    const { fallback = "Request failed", auth = true, ...rest } = init
    const headers: HeadersInit = {
        ...(auth
            ? await authHeaders()
            : { "content-type": "application/json" }),
        ...rest.headers,
    }
    const response = await fetch(`${publicApiUrl()}${path}`, {
        cache: "no-store",
        ...rest,
        headers,
        signal: rest.signal ?? AbortSignal.timeout(API_TIMEOUT_MS),
    })
    return parse<T>(response, fallback)
}
