"use client"

import { useEffect, useState } from "react"

import { apiFetch } from "@/lib/api"
import { useAuthHydrated, useAuthToken } from "@/stores/auth"

export type Organisation = {
    id: string
    name: string
    slug: string
    role: string
}

/**
 * Resolves the organisation the signed-in user operates, plus a loader bound to
 * its id. Every operations panel starts from this so the routes stay in sync
 * once an account belongs to more than one organisation.
 */
export function useOrganisation() {
    const token = useAuthToken()
    const hydrated = useAuthHydrated()
    const [organisation, setOrganisation] = useState<Organisation | null>(null)
    const [resolved, setResolved] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const loading = Boolean(token) && !resolved

    useEffect(() => {
        if (!token) return
        let active = true
        apiFetch<Organisation[]>("/api/v1/organisations", { token })
            .then((items) => {
                if (active) setOrganisation(items[0] ?? null)
            })
            .catch(() => {
                if (active) setError("We could not load your organisation.")
            })
            .finally(() => {
                if (active) setResolved(true)
            })
        return () => {
            active = false
        }
    }, [token])

    /** Load a path under this organisation, e.g. `overview` or `inventory`. */
    async function load<T>(path: string): Promise<T> {
        if (!organisation) throw new Error("No organisation loaded")
        return apiFetch<T>(`/api/v1/organisations/${organisation.id}/${path}`, {
            token,
        })
    }

    return { token, hydrated, organisation, loading, error, load }
}

/** Format stored grams as a readable kilogram value. */
export function formatKilograms(grams: number): string {
    const kilograms = grams / 1000
    return `${kilograms.toLocaleString("en-NG", {
        maximumFractionDigits: 1,
        minimumFractionDigits: 0,
    })} kg`
}
