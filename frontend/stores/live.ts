"use client"

import { create } from "zustand"

import type { ConnectionStatus } from "@/lib/ws/app-socket"

type LiveState = {
    status: ConnectionStatus
    lastEvent: string | null
    actions: {
        setStatus: (status: ConnectionStatus) => void
        setLastEvent: (kind: string) => void
    }
}

export const useLiveStore = create<LiveState>((set) => ({
    status: "idle",
    lastEvent: null,
    actions: {
        setStatus: (status) => set({ status }),
        setLastEvent: (lastEvent) => set({ lastEvent }),
    },
}))

export const useConnectionStatus = () => useLiveStore((state) => state.status)
export const useLiveActions = () => useLiveStore((state) => state.actions)
