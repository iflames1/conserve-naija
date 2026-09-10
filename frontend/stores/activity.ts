"use client"

import { create } from "zustand"

import type { Deposit } from "@/lib/api/types"

function byNewest(a: Deposit, b: Deposit) {
    return Date.parse(b.createdAt) - Date.parse(a.createdAt)
}

function confirmed(rows: Deposit[]) {
    return rows.filter((row) => row.status === "confirmed")
}

type ActivityState = {
    deposits: Deposit[]
    loading: boolean
    actions: {
        setDeposits: (deposits: Deposit[]) => void
        upsertDeposit: (deposit: Deposit) => void
        setLoading: (loading: boolean) => void
        clear: () => void
    }
}

export const useActivityStore = create<ActivityState>((set) => ({
    deposits: [],
    loading: false,
    actions: {
        setDeposits: (deposits) =>
            set((state) => {
                const byId = new Map(
                    confirmed(deposits).map((row) => [row.id, row] as const)
                )
                for (const row of state.deposits) {
                    if (!byId.has(row.id)) byId.set(row.id, row)
                }
                return {
                    deposits: [...byId.values()].sort(byNewest),
                    loading: false,
                }
            }),
        upsertDeposit: (deposit) =>
            set((state) => {
                if (deposit.status !== "confirmed") return state
                return {
                    deposits: [
                        deposit,
                        ...state.deposits.filter((row) => row.id !== deposit.id),
                    ].sort(byNewest),
                }
            }),
        setLoading: (loading) => set({ loading }),
        clear: () => set({ deposits: [], loading: false }),
    },
}))

export const useActivityDeposits = () => useActivityStore((s) => s.deposits)
export const useActivityLoading = () => useActivityStore((s) => s.loading)
export const useActivityActions = () => useActivityStore((s) => s.actions)
