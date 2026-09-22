"use client"

import { useEffect } from "react"

import { appSocket } from "@/lib/ws/app-socket"
import { useAuthToken } from "@/stores/auth"
import { useLiveActions } from "@/stores/live"

export function AppWsProvider({ children }: { children: React.ReactNode }) {
    const { setLastEvent } = useLiveActions()
    const token = useAuthToken()

    useEffect(() => {
        if (!token) return
        appSocket.connect(token)
        const unsubscribe = appSocket.subscribe((message) =>
            setLastEvent(message.kind)
        )
        return () => {
            unsubscribe()
        }
    }, [token, setLastEvent])

    return children
}
