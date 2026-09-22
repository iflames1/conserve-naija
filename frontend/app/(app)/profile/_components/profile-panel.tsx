"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

import { AppHeader } from "@/components/common/app-header"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { apiFetch } from "@/lib/api"
import { formatKilograms } from "@/lib/operations"
import {
    useAuthActions,
    useAuthHydrated,
    useAuthToken,
    type Profile,
} from "@/stores/auth"

type ActivitySummary = {
    conserve_points: number
    total_weight_grams: number
    deposits: number
}

/**
 * The account hub: identity, Conserve Points, organisation access, and sign out.
 *
 * Sign out lives here rather than in the navigation so it is somewhere
 * deliberate instead of one mis-tap away.
 */
export function ProfilePanel() {
    const token = useAuthToken()
    const hydrated = useAuthHydrated()
    const { signOut } = useAuthActions()
    const router = useRouter()

    const [profile, setProfile] = useState<Profile | null>(null)
    const [activity, setActivity] = useState<ActivitySummary | null>(null)
    const [error, setError] = useState<string | null>(null)
    const loading = Boolean(token) && !profile && !error

    useEffect(() => {
        if (!token) return
        let active = true
        Promise.all([
            apiFetch<Profile>("/api/v1/auth/me", { token }),
            apiFetch<ActivitySummary>("/api/v1/me/activity", { token }).catch(
                () => null
            ),
        ])
            .then(([loadedProfile, loadedActivity]) => {
                if (!active) return
                setProfile(loadedProfile)
                setActivity(loadedActivity)
            })
            .catch(() => {
                if (active) setError("We could not load your profile.")
            })
        return () => {
            active = false
        }
    }, [token])

    function handleSignOut() {
        signOut()
        router.push("/")
    }

    return (
        <main className="mx-auto flex min-h-svh w-full max-w-6xl flex-col px-5 pt-6 pb-12 sm:px-8 lg:px-12">
            <AppHeader active="profile" />

            {hydrated && !token ? (
                <section className="py-20">
                    <h1 className="font-display text-4xl tracking-tight">
                        Your recycling record.
                    </h1>
                    <p className="mt-4 max-w-lg text-muted-foreground">
                        Sign in to see your Conserve Points, weight returned,
                        and organisation access.
                    </p>
                    <Link
                        href="/auth/login?next=/profile"
                        className="mt-6 inline-flex h-11 items-center rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground"
                    >
                        Sign in
                    </Link>
                </section>
            ) : error && !profile ? (
                <section className="py-20">
                    <h1 className="font-display text-4xl tracking-tight">
                        We could not load your profile.
                    </h1>
                    <p className="mt-4 text-muted-foreground">{error}</p>
                    <Link
                        href="/"
                        className="mt-6 inline-flex h-11 items-center rounded-xl border border-border px-4 text-sm hover:bg-muted"
                    >
                        Back to home
                    </Link>
                </section>
            ) : loading || !profile ? (
                <section className="space-y-4 py-12">
                    <Skeleton className="h-10 w-56" />
                    <div className="grid gap-4 sm:grid-cols-3">
                        <Skeleton className="h-28 rounded-2xl" />
                        <Skeleton className="h-28 rounded-2xl" />
                        <Skeleton className="h-28 rounded-2xl" />
                    </div>
                    <Skeleton className="h-32 rounded-2xl" />
                </section>
            ) : (
                <section className="py-12">
                    <h1 className="font-display text-4xl tracking-tight">
                        {profile.display_name || profile.email}
                    </h1>
                    <p className="mt-2 text-muted-foreground">
                        {profile.email}
                    </p>

                    <div className="mt-8 grid gap-4 sm:grid-cols-3">
                        <div className="rounded-2xl border border-border p-5 surface-raised">
                            <p className="text-sm text-muted-foreground">
                                Conserve Points
                            </p>
                            <p className="tnum mt-2 font-display text-3xl text-primary">
                                {(
                                    activity?.conserve_points ?? 0
                                ).toLocaleString("en-NG")}{" "}
                                CP
                            </p>
                        </div>
                        <div className="rounded-2xl border border-border p-5 surface-raised">
                            <p className="text-sm text-muted-foreground">
                                Weight returned
                            </p>
                            <p className="tnum mt-2 font-display text-3xl">
                                {formatKilograms(
                                    activity?.total_weight_grams ?? 0
                                )}
                            </p>
                        </div>
                        <div className="rounded-2xl border border-border p-5 surface-raised">
                            <p className="text-sm text-muted-foreground">
                                Deposits
                            </p>
                            <p className="tnum mt-2 font-display text-3xl">
                                {activity?.deposits ?? 0}
                            </p>
                        </div>
                    </div>

                    <p className="mt-3 text-sm text-muted-foreground">
                        Conserve Points are valued at ₦1 each.{" "}
                        <Link
                            href="/activity"
                            className="text-primary hover:underline"
                        >
                            See how you earned them
                        </Link>
                    </p>

                    <div className="mt-6 grid gap-4 lg:grid-cols-2">
                        <div className="rounded-2xl border border-border p-5 surface-raised">
                            <p className="text-sm text-muted-foreground">
                                Roles
                            </p>
                            <div className="mt-3 flex flex-wrap gap-2">
                                {profile.roles.map((role) => (
                                    <span
                                        key={role}
                                        className="rounded-full border border-border px-3 py-1 text-xs text-primary"
                                    >
                                        {role}
                                    </span>
                                ))}
                            </div>
                        </div>

                        <div className="rounded-2xl border border-border p-5 surface-raised">
                            <p className="text-sm text-muted-foreground">
                                Organisations
                            </p>
                            {profile.organisations.length === 0 ? (
                                <p className="mt-3 text-sm">
                                    You are not part of an organisation yet.
                                </p>
                            ) : (
                                <ul className="mt-3 space-y-2">
                                    {profile.organisations.map(
                                        (organisation) => (
                                            <li
                                                key={organisation.id}
                                                className="flex items-center justify-between gap-3 text-sm"
                                            >
                                                <span>{organisation.name}</span>
                                                <span className="text-muted-foreground">
                                                    {organisation.role ===
                                                    "admin"
                                                        ? "Administrator"
                                                        : "Member"}
                                                </span>
                                            </li>
                                        )
                                    )}
                                </ul>
                            )}
                            {profile.organisations.length > 0 ? (
                                <Link
                                    href="/organisation"
                                    className="mt-5 inline-flex h-10 items-center rounded-xl border border-border px-4 text-sm hover:bg-muted"
                                >
                                    Open operations
                                </Link>
                            ) : null}
                        </div>
                    </div>

                    <div className="mt-10 border-t border-border pt-6">
                        <Button
                            variant="outline"
                            className="rounded-xl"
                            onClick={handleSignOut}
                        >
                            Sign out
                        </Button>
                    </div>
                </section>
            )}
        </main>
    )
}
