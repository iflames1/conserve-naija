"use client"

import { useEffect } from "react"

import { appSocket } from "@/lib/ws/app-socket"
import { useLiveActions } from "@/stores/live"

export function AppWsProvider({ children }: { children: React.ReactNode }) {
    const { setLastEvent } = useLiveActions()

    useEffect(() => {
        const token = window.localStorage.getItem("conserve-naija-token")
        if (!token) return
        appSocket.connect(token)
        const unsubscribe = appSocket.subscribe((message) =>
            setLastEvent(message.kind)
        )
        return () => {
            unsubscribe()
        }
    }, [setLastEvent])

    return children
}
