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

export type Mission = {
    id: string
    status: MissionStatus
    otp?: string
    otpExpiresAt?: string
}

type SessionState = {
    mission: Mission | null
    actions: {
        setMission: (mission: Mission | null) => void
        setStatus: (status: MissionStatus) => void
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
        reset: () => set({ mission: null }),
    },
}))

export const useMission = () => useSessionStore((state) => state.mission)
export const useSessionActions = () => useSessionStore((state) => state.actions)
