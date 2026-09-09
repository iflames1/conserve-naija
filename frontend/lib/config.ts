export const LOCAL_INTERNAL_API_SECRET = "cn-dev-internal"
export const LOCAL_DATABASE_URL =
    "postgres://postgres:postgres@127.0.0.1:5434/conserve_naija"
export const LOCAL_BETTER_AUTH_SECRET =
    "cn-dev-better-auth-secret-min-32-chars!"
export const LOCAL_APP_URL = "http://localhost:3000"
export const LOCAL_API_URL = "http://127.0.0.1:8080"
export const LOCAL_DEVICE_API_KEY = "cn-dev-lekki-device-key"

function isMain(): boolean {
    const network = process.env.NETWORK?.trim().toLowerCase()
    return process.env.NODE_ENV === "production" || network === "main"
}

export function isDev(): boolean {
    return !isMain()
}

function read(name: string): string | undefined {
    const value = process.env[name]?.trim()
    return value || undefined
}

export function env(name: string, local: string): string {
    const value = read(name)
    if (value) return value
    if (isDev()) return local
    throw new Error(`${name} must be set`)
}

export function optional(name: string): string | undefined {
    return read(name)
}

export function appUrl(): string {
    if (isDev()) return LOCAL_APP_URL
    return (process.env.APP_URL ?? LOCAL_APP_URL).replace(/\/$/, "")
}

export function apiUrl(): string {
    if (isDev()) return LOCAL_API_URL.replace(/\/$/, "")
    return (process.env.API_URL ?? LOCAL_API_URL).replace(/\/$/, "")
}

export function wsUrl(): string {
    const publicApi = process.env.NEXT_PUBLIC_API_URL?.trim()
    const api = (publicApi || LOCAL_API_URL).replace(/\/$/, "")
    return `${api.replace(/^http/i, "ws")}/app`
}
