"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"

import { apiFetch } from "@/lib/api"

export type OrganisationSummary = {
    id: string
    name: string
    slug: string
    role: string
}

export type Profile = {
    user_id: string
    email: string
    display_name: string
    roles: string[]
    organisations: OrganisationSummary[]
    is_admin: boolean
}

type AuthState = {
    token: string | null
    profile: Profile | null
    hydrated: boolean
    actions: {
        startSession: (
            endpoint: string,
            body: Record<string, unknown>
        ) => Promise<string>
        setProfile: (profile: Profile | null) => void
        setHydrated: () => void
        signOut: () => void
    }
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set) => ({
            token: null,
            profile: null,
            hydrated: false,
            actions: {
                startSession: async (endpoint, body) => {
                    const session = await apiFetch<{
                        token: string
                        user_id: string
                    }>(endpoint, { method: "POST", body })
                    set({ token: session.token })
                    const profile = await apiFetch<Profile>("/api/v1/auth/me", {
                        token: session.token,
                    })
                    set({ profile })
                    return profile.is_admin ? "/organisation" : "/deposit"
                },
                setProfile: (profile) => set({ profile }),
                setHydrated: () => set({ hydrated: true }),
                signOut: () => set({ token: null, profile: null }),
            },
        }),
        {
            name: "conserve-naija-auth",
            partialize: (state) => ({
                token: state.token,
                profile: state.profile,
            }),
            onRehydrateStorage: () => (state) => state?.actions.setHydrated(),
        }
    )
)

export const useAuthToken = () => useAuthStore((state) => state.token)
export const useIsSignedIn = () => useAuthStore((state) => Boolean(state.token))
/** False until persisted auth finishes restoring, to avoid signed-out flicker. */
export const useAuthHydrated = () => useAuthStore((state) => state.hydrated)
export const useProfile = () => useAuthStore((state) => state.profile)
export const useAuthActions = () => useAuthStore((state) => state.actions)
