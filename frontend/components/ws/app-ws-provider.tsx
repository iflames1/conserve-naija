"use client"

import { useEffect } from "react"

import { appSocket } from "@/lib/ws/app-socket"
import { useAuthToken } from "@/stores/auth"
import { useLiveActions } from "@/stores/live"
import { useSessionActions, type MissionStatus } from "@/stores/session"

type SessionUpdated = {
    id?: string
    status?: MissionStatus
    deposit_id?: string
    conserve_points?: number
    fractions?: {
        material: string
        weight_grams: number
        conserve_points: number
    }[]
}

export function AppWsProvider({ children }: { children: React.ReactNode }) {
    const { setLastEvent } = useLiveActions()
    const { applyServerUpdate } = useSessionActions()
    const token = useAuthToken()

    useEffect(() => {
        if (!token) return
        appSocket.connect(token)
        const unsubscribe = appSocket.subscribe((message) => {
            setLastEvent(message.kind)
            // Mission events are applied here, at the app root, so a machine
            // update still lands when the mission dialog is closed. The result
            // comes only from the server, never from a client calculation.
            if (message.kind === "session.updated") {
                applyServerUpdate(message.payload as SessionUpdated)
            }
        })
        return () => {
            unsubscribe()
        }
    }, [token, setLastEvent, applyServerUpdate])

    return children
}
