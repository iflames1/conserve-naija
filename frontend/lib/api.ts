const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080"

export class ApiError extends Error {
    constructor(
        message: string,
        readonly status: number
    ) {
        super(message)
        this.name = "ApiError"
    }
}

type RequestOptions = Omit<RequestInit, "body"> & {
    body?: unknown
    token?: string | null
}

/**
 * Small typed wrapper around the FastAPI service.
 *
 * Every call attaches the stored bearer token when one exists; error bodies are
 * unwrapped into an {@link ApiError} so callers can show a real message.
 */
export async function apiFetch<T>(
    path: string,
    { body, token, headers, ...init }: RequestOptions = {}
): Promise<T> {
    const response = await fetch(`${API_URL}${path}`, {
        ...init,
        headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...headers,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
    })

    if (!response.ok) {
        let detail = "Something went wrong. Please try again."
        try {
            const payload = (await response.json()) as { detail?: unknown }
            if (typeof payload.detail === "string") detail = payload.detail
        } catch {
            // Non-JSON error body; keep the generic message.
        }
        throw new ApiError(detail, response.status)
    }

    if (response.status === 204) return undefined as T
    return (await response.json()) as T
}
