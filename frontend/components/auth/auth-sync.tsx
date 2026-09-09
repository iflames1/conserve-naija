"use client"

import { useQueryClient } from "@tanstack/react-query"
import * as React from "react"

import { browserApi } from "@/lib/api/browser"
import type { AppUser } from "@/lib/api/types"
import { authClient } from "@/lib/auth/client"
import { isVerificationDisabled } from "@/lib/auth/flags"
import { userFromAuthSession } from "@/lib/auth/session-user"
import { clearAccessTokenCache } from "@/lib/auth/browser-token"
import { useSessionActions, useSessionStore } from "@/stores/session"

export function AuthSync() {
    const queryClient = useQueryClient()
    const { data: session, isPending } = authClient.useSession()
    const { setUser, setLoading } = useSessionActions()
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
    }, [isPending, id, email, name, image, emailVerified, queryClient, setLoading, setUser])

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
                if (!cancelled) setUser(synced)
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
