"use client"

import Link from "next/link"
import { useEffect, useState } from "react"

import { AppHeader } from "@/components/common/app-header"
import { Skeleton } from "@/components/ui/skeleton"
import { apiFetch } from "@/lib/api"
import { useAuthToken, type Profile } from "@/stores/auth"

export function ProfilePanel() {
    const token = useAuthToken()
    const [profile, setProfile] = useState<Profile | null>(null)
    const [error, setError] = useState<string | null>(null)
    const loading = Boolean(token) && !profile && !error

    useEffect(() => {
        if (!token) return
        let active = true
        apiFetch<Profile>("/api/v1/auth/me", { token })
            .then((data) => {
                if (active) setProfile(data)
            })
            .catch(() => {
                if (active) setError("We could not load your profile.")
            })
        return () => {
            active = false
        }
    }, [token])

    return (
        <main className="mx-auto min-h-svh w-full max-w-3xl px-5 py-8 sm:px-8">
            <AppHeader active="profile" />

            {!token ? (
                <section className="py-20">
                    <h1 className="font-display text-4xl tracking-tight">
                        Your recycling record.
                    </h1>
                    <p className="mt-4 text-muted-foreground">
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
            ) : loading || !profile ? (
                <section className="space-y-4 py-12">
                    <Skeleton className="h-10 w-56" />
                    <Skeleton className="h-28 rounded-2xl" />
                    <Skeleton className="h-28 rounded-2xl" />
                </section>
            ) : (
                <section className="py-12">
                    <h1 className="font-display text-4xl tracking-tight">
                        {profile.display_name || profile.email}
                    </h1>
                    <p className="mt-2 text-muted-foreground">
                        {profile.email}
                    </p>

                    <div className="mt-8 grid gap-4 sm:grid-cols-2">
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
                                Conserve Points
                            </p>
                            <p className="tnum mt-3 font-display text-3xl">
                                0 CP
                            </p>
                        </div>
                    </div>

                    <div className="mt-4 rounded-2xl border border-border p-5 surface-raised">
                        <p className="text-sm text-muted-foreground">
                            Organisations
                        </p>
                        {profile.organisations.length === 0 ? (
                            <p className="mt-3 text-sm">
                                You are not part of an organisation yet.
                            </p>
                        ) : (
                            <ul className="mt-3 space-y-2">
                                {profile.organisations.map((organisation) => (
                                    <li
                                        key={organisation.id}
                                        className="flex items-center justify-between gap-3 text-sm"
                                    >
                                        <span>{organisation.name}</span>
                                        <span className="text-muted-foreground">
                                            {organisation.role === "admin"
                                                ? "Administrator"
                                                : "Member"}
                                        </span>
                                    </li>
                                ))}
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

                    {error ? (
                        <p className="mt-4 text-sm text-destructive">{error}</p>
                    ) : null}
                </section>
            )}
        </main>
    )
}
