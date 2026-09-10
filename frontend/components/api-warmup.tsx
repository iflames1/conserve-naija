"use client"

import { useQueryClient } from "@tanstack/react-query"
import * as React from "react"

import { browserApi } from "@/lib/api/browser"
import { appSocket } from "@/lib/ws/app-socket"

/** Wake a sleeping API before the first real click, then refresh public lists. */
export function ApiWarmup() {
    const queryClient = useQueryClient()

    React.useEffect(() => {
        let cancelled = false
        void browserApi("/health", {
            auth: false,
            fallback: "API unreachable",
            signal: AbortSignal.timeout(4_000),
        })
            .then(() => {
                if (cancelled) return
                void queryClient.invalidateQueries({ queryKey: ["explore-points"] })
                if (appSocket.getStatus() === "closed") appSocket.connect()
            })
            .catch(() => {})
        return () => {
            cancelled = true
        }
    }, [queryClient])

    return null
}
