"use client"

import * as React from "react"

import { getActiveRecyclingSessionAction } from "@/actions/sessions"
import { appSocket } from "@/lib/ws/app-socket"
import type { RecyclingSession } from "@/lib/api/types"
import type { WsEnvelope } from "@/lib/ws/protocol"
import { useLiveActions } from "@/stores/live"
import { useSessionActions, useSessionStore, useSessionUser } from "@/stores/session"

const TOKEN_TTL_MS = 60_000
let cachedToken: { value: string; expires: number } | null = null
let tokenInFlight: Promise<string | null> | null = null

async function mintAccessToken(): Promise<string | null> {
    if (cachedToken && cachedToken.expires > Date.now()) {
        return cachedToken.value
    }
    if (tokenInFlight) return tokenInFlight

    tokenInFlight = (async () => {
        try {
            const { getAccessTokenAction } = await import("@/actions/auth-token")
            const token = await getAccessTokenAction()
            cachedToken = { value: token, expires: Date.now() + TOKEN_TTL_MS }
            return token
        } catch {
            cachedToken = null
            return null
        } finally {
            tokenInFlight = null
        }
    })()

    return tokenInFlight
}

export function clearAccessTokenCache(): void {
    cachedToken = null
}

function asSession(value: unknown): RecyclingSession | null {
    if (!value || typeof value !== "object") return null
    const record = value as Partial<RecyclingSession>
    if (typeof record.id !== "string" || typeof record.code !== "string") {
        return null
    }
    return record as RecyclingSession
}

export function AppWsProvider() {
    const user = useSessionUser()
    const { patchBalance } = useSessionActions()
    const live = useLiveActions()

    React.useEffect(() => {
        appSocket.setTokenProvider(mintAccessToken)
        if (!user) {
            appSocket.disconnect()
            return
        }
        appSocket.connect()
        appSocket.refreshAuth()
        return () => {
            appSocket.disconnect()
        }
    }, [user?.id])

    React.useEffect(() => {
        if (!user) return
        let cancelled = false
        void getActiveRecyclingSessionAction().then((result) => {
            if (cancelled || !result.ok) return
            live.setSession(result.data)
        })
        return () => {
            cancelled = true
        }
    }, [user?.id, live])

    React.useEffect(() => {
        return appSocket.onMessage((message: WsEnvelope) => {
            if (message.kind !== "session.updated") return
            const session = asSession(message.payload.session)
            if (session) live.patchSession(session)
            const balance = message.payload.greenPointsBalance
            if (typeof balance === "number") {
                patchBalance(balance)
                const current = useSessionStore.getState().user
                if (current) {
                    useSessionStore.getState().actions.setUser({
                        ...current,
                        greenPointsBalance: balance,
                        nairaValue: balance,
                    })
                }
            }
        })
    }, [live, patchBalance])

    return null
}
