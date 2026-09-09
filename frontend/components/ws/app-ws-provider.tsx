"use client"

import * as React from "react"

import { getActiveRecyclingSessionAction } from "@/actions/sessions"
import { getBrowserAccessToken } from "@/lib/auth/browser-token"
import { appSocket } from "@/lib/ws/app-socket"
import type { RecyclingSession } from "@/lib/api/types"
import type { WsEnvelope } from "@/lib/ws/protocol"
import { useLiveActions } from "@/stores/live"
import { useSessionActions, useSessionStore, useSessionUser } from "@/stores/session"

async function mintAccessToken(): Promise<string | null> {
    try {
        return await getBrowserAccessToken()
    } catch {
        return null
    }
}

export { clearAccessTokenCache } from "@/lib/auth/browser-token"

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
