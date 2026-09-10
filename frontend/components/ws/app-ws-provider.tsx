"use client"

import * as React from "react"

import { getBrowserAccessToken } from "@/lib/auth/browser-token"
import { browserApi } from "@/lib/api/browser"
import { appSocket } from "@/lib/ws/app-socket"
import type { Deposit, RecyclingSession } from "@/lib/api/types"
import type { WsEnvelope } from "@/lib/ws/protocol"
import { useActivityActions } from "@/stores/activity"
import { useLiveActions } from "@/stores/live"
import { useSessionActions, useSessionUser } from "@/stores/session"

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

function asDeposit(value: unknown): Deposit | null {
    if (!value || typeof value !== "object") return null
    const record = value as Partial<Deposit>
    if (typeof record.id !== "string" || typeof record.status !== "string") {
        return null
    }
    return record as Deposit
}

function asFiniteNumber(value: unknown): number | undefined {
    return typeof value === "number" && Number.isFinite(value) ? value : undefined
}

export function AppWsProvider() {
    const user = useSessionUser()
    const { patchStats } = useSessionActions()
    const live = useLiveActions()
    const activity = useActivityActions()

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
        if (!user) {
            live.clearSession()
            activity.clear()
            return
        }
        let cancelled = false
        activity.setLoading(true)
        void Promise.all([
            browserApi<RecyclingSession | null>("/recycling-sessions/active", {
                fallback: "Couldn't load your OTP",
            }),
            browserApi<Deposit[]>("/me/deposits", {
                fallback: "Failed to load deposits",
            }),
        ])
            .then(([session, deposits]) => {
                if (cancelled) return
                if (session) live.setSession(session)
                activity.setDeposits(deposits)
            })
            .catch(() => {
                if (!cancelled) activity.setLoading(false)
            })
        return () => {
            cancelled = true
        }
    }, [user?.id, live, activity])

    React.useEffect(() => {
        return appSocket.onMessage((message: WsEnvelope) => {
            if (message.kind !== "session.updated") return
            const session = asSession(message.payload.session)
            if (session) live.patchSession(session)

            const balance =
                asFiniteNumber(message.payload.conservePointsBalance) ??
                asFiniteNumber(message.payload.greenPointsBalance)
            const depositCount = asFiniteNumber(message.payload.depositCount)
            const recycledKg = asFiniteNumber(message.payload.recycledKg)
            patchStats({
                ...(typeof balance === "number"
                    ? { conservePointsBalance: balance }
                    : {}),
                ...(typeof depositCount === "number" ? { depositCount } : {}),
                ...(typeof recycledKg === "number" ? { recycledKg } : {}),
            })

            const deposit = asDeposit(message.payload.deposit)
            if (deposit) activity.upsertDeposit(deposit)
        })
    }, [live, patchStats, activity])

    return null
}
