"use client"

import * as React from "react"

import { syncAuthUser } from "@/actions/users"
import { authClient } from "@/lib/auth/client"
import { isVerificationDisabled } from "@/lib/auth/flags"
import { clearAccessTokenCache } from "@/components/ws/app-ws-provider"
import { useSessionActions } from "@/stores/session"

export function AuthSync() {
    const { data: session, isPending } = authClient.useSession()
    const { setUser, setLoading } = useSessionActions()
    const id = session?.user?.id ?? null
    const email = session?.user?.email ?? null
    const name = session?.user?.name ?? null
    const image = session?.user?.image ?? null
    const emailVerified = session?.user?.emailVerified ?? null

    React.useEffect(() => {
        if (isPending) return
        let cancelled = false

        async function sync() {
            if (!id || !email) {
                setUser(null)
                setLoading(false)
                clearAccessTokenCache()
                return
            }
            setLoading(true)
            try {
                const synced = await syncAuthUser({
                    id,
                    email,
                    name,
                    image,
                    emailVerified: emailVerified || isVerificationDisabled(),
                })
                if (!cancelled) setUser(synced)
            } catch (error) {
                console.error("Failed to sync app user", error)
                if (!cancelled) setUser(null)
            } finally {
                if (!cancelled) setLoading(false)
            }
        }

        void sync()
        return () => {
            cancelled = true
        }
    }, [isPending, id, email, name, image, emailVerified, setLoading, setUser])

    return null
}
