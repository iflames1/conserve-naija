"use client"

import Link from "next/link"
import { useEffect, useState, type FormEvent } from "react"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { ApiError, apiFetch } from "@/lib/api"
import { useAuthHydrated, useAuthToken } from "@/stores/auth"

type Member = {
    user_id: string
    email: string
    display_name: string
    role: string
}

type Organisation = {
    id: string
    name: string
    slug: string
    role: string
}

const FIELD_CLASS =
    "h-11 rounded-xl border border-border bg-card px-3.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40"

export function MembersPanel() {
    const token = useAuthToken()
    const hydrated = useAuthHydrated()
    const [organisations, setOrganisations] = useState<Organisation[] | null>(
        null
    )
    const [organisationId, setOrganisationId] = useState<string | null>(null)
    const [members, setMembers] = useState<Member[] | null>(null)
    const [email, setEmail] = useState("")
    const [role, setRole] = useState("member")
    const [notice, setNotice] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [busy, setBusy] = useState(false)

    useEffect(() => {
        if (!token) return
        let active = true
        apiFetch<Organisation[]>("/api/v1/organisations", { token })
            .then((items) => {
                if (!active) return
                setOrganisations(items)
                setOrganisationId(items[0]?.id ?? null)
            })
            .catch((cause: unknown) => {
                if (!active) return
                setError(
                    cause instanceof ApiError
                        ? cause.message
                        : "We could not load your organisations."
                )
            })
        return () => {
            active = false
        }
    }, [token])

    useEffect(() => {
        if (!organisationId || !token) return
        let active = true
        apiFetch<Member[]>(`/api/v1/organisations/${organisationId}/members`, {
            token,
        })
            .then((rows) => {
                if (active) setMembers(rows)
            })
            .catch((cause: unknown) => {
                if (active) {
                    setError(
                        cause instanceof ApiError
                            ? cause.message
                            : "We could not load the members."
                    )
                }
            })
        return () => {
            active = false
        }
    }, [organisationId, token])

    async function addMember(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        if (!organisationId) return
        setBusy(true)
        setError(null)
        setNotice(null)
        try {
            const added = await apiFetch<Member>(
                `/api/v1/organisations/${organisationId}/members`,
                { method: "POST", body: { email, role }, token }
            )
            setMembers((current) => (current ? [...current, added] : [added]))
            setNotice(`${added.display_name || added.email} now has access.`)
            setEmail("")
        } catch (cause) {
            setError(
                cause instanceof ApiError
                    ? cause.message
                    : "We could not add that person."
            )
        } finally {
            setBusy(false)
        }
    }

    async function removeMember(member: Member) {
        if (!organisationId) return
        setError(null)
        setNotice(null)
        try {
            await apiFetch<void>(
                `/api/v1/organisations/${organisationId}/members/${member.user_id}`,
                { method: "DELETE", token }
            )
            setMembers((current) =>
                current
                    ? current.filter((row) => row.user_id !== member.user_id)
                    : current
            )
            setNotice(`${member.display_name || member.email} was removed.`)
        } catch (cause) {
            setError(
                cause instanceof ApiError
                    ? cause.message
                    : "We could not remove that person."
            )
        }
    }

    if (hydrated && !token) {
        return (
            <section className="py-10">
                <h1 className="font-display text-4xl tracking-tight">
                    Organisation members
                </h1>
                <p className="mt-3 text-muted-foreground">
                    Sign in as an organisation administrator to manage who has
                    access.
                </p>
                <Link
                    href="/auth/login?next=/organisation/members"
                    className="mt-6 inline-flex h-11 items-center rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground"
                >
                    Sign in
                </Link>
            </section>
        )
    }

    return (
        <section className="py-10">
            <h1 className="font-display text-4xl tracking-tight">
                Organisation members
            </h1>
            <p className="mt-3 text-muted-foreground">
                Add the people who operate your Conserve Sites. They must
                already have a Conserve Naija account.
            </p>

            {organisations === null ? (
                <div className="mt-8 space-y-3">
                    <Skeleton className="h-24 rounded-2xl" />
                    <Skeleton className="h-16 rounded-2xl" />
                    <Skeleton className="h-16 rounded-2xl" />
                </div>
            ) : organisations.length === 0 ? (
                <div className="mt-8 rounded-2xl border border-border p-6">
                    <h2 className="font-display text-xl">
                        No organisation yet
                    </h2>
                    <p className="mt-2 text-muted-foreground">
                        This account is not part of an organisation. Ask a
                        platform administrator to add it.
                    </p>
                </div>
            ) : (
                <>
                    <form
                        onSubmit={addMember}
                        className="mt-8 grid gap-3 rounded-2xl border border-border p-5 sm:grid-cols-[1fr_auto_auto]"
                    >
                        <label className="text-sm">
                            <span className="sr-only">Email</span>
                            <input
                                className={`${FIELD_CLASS} w-full`}
                                type="email"
                                required
                                placeholder="person@example.com"
                                value={email}
                                onChange={(event) =>
                                    setEmail(event.target.value)
                                }
                            />
                        </label>
                        <select
                            className={FIELD_CLASS}
                            value={role}
                            onChange={(event) => setRole(event.target.value)}
                        >
                            <option value="member">Member</option>
                            <option value="admin">Administrator</option>
                        </select>
                        <Button
                            className="h-11 rounded-xl"
                            type="submit"
                            disabled={busy}
                        >
                            {busy ? "Adding…" : "Add member"}
                        </Button>
                    </form>

                    {notice ? (
                        <p className="mt-4 text-sm text-success">{notice}</p>
                    ) : null}
                    {error ? (
                        <p className="mt-4 text-sm text-destructive">{error}</p>
                    ) : null}

                    <div className="mt-6 divide-y divide-border rounded-2xl border border-border">
                        {members === null ? (
                            <>
                                <Skeleton className="h-16 rounded-none" />
                                <Skeleton className="h-16 rounded-none" />
                            </>
                        ) : members.length === 0 ? (
                            <p className="p-5 text-sm text-muted-foreground">
                                Nobody has been added to this organisation yet.
                            </p>
                        ) : (
                            members.map((member) => (
                                <div
                                    key={member.user_id}
                                    className="flex flex-wrap items-center justify-between gap-3 p-5"
                                >
                                    <div className="min-w-0">
                                        <p className="truncate font-medium">
                                            {member.display_name ||
                                                member.email}
                                        </p>
                                        <p className="truncate text-sm text-muted-foreground">
                                            {member.email}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="rounded-full border border-border px-3 py-1 text-xs text-primary">
                                            {member.role === "admin"
                                                ? "Administrator"
                                                : "Member"}
                                        </span>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="rounded-lg"
                                            onClick={() =>
                                                void removeMember(member)
                                            }
                                        >
                                            Remove
                                        </Button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </>
            )}
        </section>
    )
}
