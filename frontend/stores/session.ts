"use client"

import { create } from "zustand"

import type { AppUser } from "@/lib/api/types"

type SessionState = {
    user: AppUser | null
    loading: boolean
    actions: {
        setUser: (user: AppUser | null) => void
        setLoading: (loading: boolean) => void
        patchBalance: (greenPointsBalance: number) => void
    }
}

export const useSessionStore = create<SessionState>((set) => ({
    user: null,
    loading: true,
    actions: {
        setUser: (user) => set({ user }),
        setLoading: (loading) => set({ loading }),
        patchBalance: (greenPointsBalance) =>
            set((state) =>
                state.user
                    ? {
                          user: {
                              ...state.user,
                              greenPointsBalance,
                              nairaValue: greenPointsBalance,
                          },
                      }
                    : {}
            ),
    },
}))

export const useSessionUser = () => useSessionStore((s) => s.user)
export const useSessionLoading = () => useSessionStore((s) => s.loading)
export const useSessionActions = () => useSessionStore((s) => s.actions)
