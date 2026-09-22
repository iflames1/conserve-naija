"use client"

import { useEffect } from "react"

import { appSocket } from "@/lib/ws/app-socket"
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

/**
 * Applies machine-driven session updates to the active mission.
 *
 * The deposit result (points and fractions) is only ever read from the server
 * event, so the browser cannot invent a reward.
 */
export function useMissionSocket() {
    const { applyServerUpdate } = useSessionActions()

    useEffect(() => {
        return appSocket.subscribe((message) => {
            if (message.kind !== "session.updated") return
            applyServerUpdate(message.payload as SessionUpdated)
        })
    }, [applyServerUpdate])
}
