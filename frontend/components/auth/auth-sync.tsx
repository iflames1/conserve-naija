"use client"

import { useQueryClient } from "@tanstack/react-query"
import * as React from "react"

import { browserApi } from "@/lib/api/browser"
import type { AppUser } from "@/lib/api/types"
import { authClient } from "@/lib/auth/client"
import { isVerificationDisabled } from "@/lib/auth/flags"
import { userFromAuthSession } from "@/lib/auth/session-user"
import { clearAccessTokenCache } from "@/lib/auth/browser-token"
import { useActivityActions } from "@/stores/activity"
import { useLiveActions } from "@/stores/live"
import { useSessionActions, useSessionStore } from "@/stores/session"

export function AuthSync() {
    const queryClient = useQueryClient()
    const { data: session, isPending } = authClient.useSession()
    const { setUser, setLoading } = useSessionActions()
    const { clear: clearActivity } = useActivityActions()
    const { clearSession } = useLiveActions()
    const id = session?.user?.id ?? null
    const email = session?.user?.email ?? null
    const name = session?.user?.name ?? null
    const image = session?.user?.image ?? null
    const emailVerified = session?.user?.emailVerified ?? null

    React.useLayoutEffect(() => {
        if (isPending) return
        if (!id || !email) {
            if (useSessionStore.getState().user) queryClient.clear()
            setUser(null)
            clearActivity()
            clearSession()
            setLoading(false)
            clearAccessTokenCache()
            return
        }
        const current = useSessionStore.getState().user
        if (!current || current.id !== id) {
            setUser(
                userFromAuthSession({
                    id,
                    email,
                    name,
                    image,
                    emailVerified,
                })
            )
        }
        setLoading(false)
    }, [
        isPending,
        id,
        email,
        name,
        image,
        emailVerified,
        queryClient,
        setLoading,
        setUser,
        clearActivity,
        clearSession,
    ])

    React.useEffect(() => {
        if (isPending || !id || !email) return
        let cancelled = false

        async function sync() {
            try {
                const synced = await browserApi<AppUser>("/users", {
                    method: "POST",
                    fallback: "Failed to sync account",
                    body: JSON.stringify({
                        id,
                        email,
                        displayName: name,
                        avatarUrl: image,
                        emailVerified: emailVerified || isVerificationDisabled(),
                    }),
                })
                if (cancelled) return
                const current = useSessionStore.getState().user
                if (current && current.id === synced.id) {
                    setUser({
                        ...synced,
                        greenPointsBalance: Math.max(
                            current.greenPointsBalance,
                            synced.greenPointsBalance
                        ),
                        conservePointsBalance: Math.max(
                            current.conservePointsBalance ?? current.greenPointsBalance,
                            synced.conservePointsBalance ?? synced.greenPointsBalance
                        ),
                        nairaValue: Math.max(current.nairaValue, synced.nairaValue),
                        depositCount: Math.max(
                            current.depositCount ?? 0,
                            synced.depositCount ?? 0
                        ),
                        recycledKg: Math.max(
                            current.recycledKg ?? 0,
                            synced.recycledKg ?? 0
                        ),
                    })
                    return
                }
                setUser(synced)
            } catch (error) {
                console.error("Failed to sync app user", error)
            }
        }

        void sync()
        return () => {
            cancelled = true
        }
    }, [isPending, id, email, name, image, emailVerified, setUser])

    return null
}
