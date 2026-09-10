"use client"

import { create } from "zustand"

import type { AppUser } from "@/lib/api/types"

export type UserStatsPatch = {
    conservePointsBalance?: number
    depositCount?: number
    recycledKg?: number
}

type SessionState = {
    user: AppUser | null
    loading: boolean
    actions: {
        setUser: (user: AppUser | null) => void
        setLoading: (loading: boolean) => void
        patchBalance: (greenPointsBalance: number) => void
        patchStats: (patch: UserStatsPatch) => void
    }
}

export const useSessionStore = create<SessionState>((set) => ({
    user: null,
    loading: true,
    actions: {
        setUser: (user) => set({ user }),
        setLoading: (loading) => set({ loading }),
        patchBalance: (greenPointsBalance) =>
            useSessionStore.getState().actions.patchStats({
                conservePointsBalance: greenPointsBalance,
            }),
        patchStats: (patch) =>
            set((state) => {
                if (!state.user) return {}
                const balance = patch.conservePointsBalance
                return {
                    user: {
                        ...state.user,
                        ...(typeof balance === "number"
                            ? {
                                  greenPointsBalance: balance,
                                  conservePointsBalance: balance,
                                  nairaValue: balance,
                              }
                            : {}),
                        ...(typeof patch.depositCount === "number"
                            ? { depositCount: patch.depositCount }
                            : {}),
                        ...(typeof patch.recycledKg === "number"
                            ? { recycledKg: patch.recycledKg }
                            : {}),
                    },
                }
            }),
    },
}))

export const useSessionUser = () => useSessionStore((s) => s.user)
export const useSessionLoading = () => useSessionStore((s) => s.loading)
export const useSessionActions = () => useSessionStore((s) => s.actions)
