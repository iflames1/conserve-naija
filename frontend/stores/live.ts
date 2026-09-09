"use client"

import { create } from "zustand"

import type { RecyclingSession } from "@/lib/api/types"

type LiveState = {
    session: RecyclingSession | null
    actions: {
        setSession: (session: RecyclingSession | null) => void
        patchSession: (session: RecyclingSession) => void
        clearSession: () => void
    }
}

export const useLiveStore = create<LiveState>((set) => ({
    session: null,
    actions: {
        setSession: (session) => set({ session }),
        patchSession: (session) =>
            set((state) => {
                if (!state.session || state.session.id === session.id) {
                    return { session }
                }
                return state
            }),
        clearSession: () => set({ session: null }),
    },
}))

export const useLiveSession = () => useLiveStore((s) => s.session)
export const useLiveActions = () => useLiveStore((s) => s.actions)
