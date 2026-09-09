const TOKEN_TTL_MS = 60_000
const TOKEN_TIMEOUT_MS = 8_000

let cachedToken: { value: string; expires: number } | null = null
let tokenInFlight: Promise<string> | null = null

export function clearAccessTokenCache(): void {
    cachedToken = null
}

export async function getBrowserAccessToken(): Promise<string> {
    if (cachedToken && cachedToken.expires > Date.now()) {
        return cachedToken.value
    }
    if (tokenInFlight) return tokenInFlight

    tokenInFlight = (async () => {
        try {
            const { getAccessTokenAction } = await import("@/actions/auth-token")
            const token = await Promise.race([
                getAccessTokenAction(),
                new Promise<never>((_, reject) => {
                    setTimeout(
                        () => reject(new Error("Sign in required (token timeout).")),
                        TOKEN_TIMEOUT_MS
                    )
                }),
            ])
            cachedToken = { value: token, expires: Date.now() + TOKEN_TTL_MS }
            return token
        } catch (error) {
            cachedToken = null
            throw error
        } finally {
            tokenInFlight = null
        }
    })()

    return tokenInFlight
}
