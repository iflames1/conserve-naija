"use client"

import { create } from "zustand"

export type MissionStatus =
    | "idle"
    | "starting"
    | "waiting_for_machine"
    | "connected"
    | "sorting"
    | "measuring"
    | "processing"
    | "completed"
    | "failed"

export type MissionFraction = {
    material: string
    weight_grams: number
    conserve_points: number
}

export type MissionResult = {
    depositId: string
    conservePoints: number
    fractions: MissionFraction[]
}

export type Mission = {
    id: string
    status: MissionStatus
    otp?: string
    otpExpiresAt?: string
    result?: MissionResult
}

type ServerUpdate = {
    id?: string
    status?: MissionStatus
    deposit_id?: string
    conserve_points?: number
    fractions?: MissionFraction[]
}

type SessionState = {
    mission: Mission | null
    actions: {
        setMission: (mission: Mission | null) => void
        setStatus: (status: MissionStatus) => void
        applyServerUpdate: (update: ServerUpdate) => void
        reset: () => void
    }
}

export const useSessionStore = create<SessionState>((set) => ({
    mission: null,
    actions: {
        setMission: (mission) => set({ mission }),
        setStatus: (status) =>
            set((state) =>
                state.mission
                    ? { mission: { ...state.mission, status } }
                    : state
            ),
        applyServerUpdate: (update) =>
            set((state) => {
                if (!state.mission) return state
                // Ignore events for a different session (an older mission may
                // still be finishing while a new one is open).
                if (update.id && update.id !== state.mission.id) return state

                const result =
                    update.deposit_id !== undefined &&
                    update.status === "completed"
                        ? {
                              depositId: update.deposit_id,
                              conservePoints: update.conserve_points ?? 0,
                              fractions: update.fractions ?? [],
                          }
                        : state.mission.result

                return {
                    mission: {
                        ...state.mission,
                        status: update.status ?? state.mission.status,
                        result,
                    },
                }
            }),
        reset: () => set({ mission: null }),
    },
}))

export const useMission = () => useSessionStore((state) => state.mission)
export const useSessionActions = () => useSessionStore((state) => state.actions)
