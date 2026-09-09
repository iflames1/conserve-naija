import { apiUrl } from "@/lib/config"

const API_TIMEOUT_MS = 20_000

async function authHeaders(): Promise<HeadersInit> {
    const { getAccessTokenAction } = await import("@/actions/auth-token")
    const token = await getAccessTokenAction()
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
    init: RequestInit & { fallback?: string } = {}
): Promise<T> {
    const { fallback = "Request failed", ...rest } = init
    const response = await fetch(`${apiUrl()}${path}`, {
        cache: "no-store",
        ...rest,
        headers: {
            ...(await authHeaders()),
            ...rest.headers,
        },
        signal: rest.signal ?? AbortSignal.timeout(API_TIMEOUT_MS),
    })
    return parse<T>(response, fallback)
}
