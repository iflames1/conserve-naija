"use client"

import * as React from "react"
import { useQuery } from "@tanstack/react-query"

import { browserApi } from "@/lib/api/browser"
import type { Deposit, RecyclingSession } from "@/lib/api/types"
import { SectionHeader } from "@/components/common/section"
import { MissionPanel } from "@/components/home/mission-panel"
import { ActivityHistory } from "@/components/profile/activity-history"
import { Button, ButtonLink } from "@/components/ui"
import {
    firstName,
    formatKg,
    formatNaira,
    formatPoints,
    greetingForNow,
} from "@/lib/utils"
import { useLiveActions, useLiveSession } from "@/stores/live"
import { useNotificationActions } from "@/stores/notifications"
import { useSessionUser } from "@/stores/session"

export function CitizenHome() {
    const user = useSessionUser()
    const session = useLiveSession()
    const { setSession } = useLiveActions()
    const { push } = useNotificationActions()
    const [starting, setStarting] = React.useState(false)
    const [greeting, setGreeting] = React.useState("Hello")

    React.useEffect(() => {
        setGreeting(greetingForNow())
    }, [])

    const deposits = useQuery({
        queryKey: ["my-deposits", user?.id],
        enabled: Boolean(user),
        queryFn: async () => {
            const rows = await browserApi<Deposit[]>("/me/deposits", {
                fallback: "Failed to load deposits",
            })
            return rows.filter((row) => row.status === "confirmed")
        },
    })

    React.useEffect(() => {
        if (session?.status === "completed") {
            void deposits.refetch()
        }
    }, [session?.status, deposits])

    if (!user) return null

    const recent = deposits.data ?? []

    return (
        <div className="space-y-8">
            <header className="relative isolate overflow-hidden rounded-2xl border border-border/70 surface-raised">
                <div aria-hidden className="absolute inset-0 -z-10 bg-grid" />
                <div
                    aria-hidden
                    className="absolute inset-0 -z-10 bg-linear-to-r from-primary/14 via-transparent to-transparent"
                />
                <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-6 p-5 sm:p-6">
                    <div>
                        <p className="text-sm text-muted-foreground">
                            {greeting}, {firstName(user.displayName)}
                        </p>
                        <h1 className="mt-2 font-display text-4xl sm:text-5xl">
                            {formatPoints(user.greenPointsBalance)} GP
                        </h1>
                        <p className="mt-1 text-sm text-muted-foreground">
                            {formatNaira(user.nairaValue)} in your wallet
                        </p>
                    </div>
                    <dl className="flex flex-wrap gap-x-8 gap-y-3">
                        <div>
                            <dt className="text-[11px] font-medium tracking-[0.16em] text-muted-foreground uppercase">
                                Drops
                            </dt>
                            <dd className="tnum mt-1 font-display text-xl">
                                {(user.depositCount ?? 0).toLocaleString("en-NG")}
                            </dd>
                        </div>
                        <div>
                            <dt className="text-[11px] font-medium tracking-[0.16em] text-muted-foreground uppercase">
                                Recycled
                            </dt>
                            <dd className="tnum mt-1 font-display text-xl">
                                {formatKg(user.recycledKg ?? 0)}
                            </dd>
                        </div>
                    </dl>
                </div>
            </header>

            {session ? (
                <MissionPanel />
            ) : (
                <section className="relative isolate overflow-hidden rounded-2xl border border-primary/25 bg-primary/8 p-5 sm:p-7">
                    <div aria-hidden className="absolute inset-0 -z-10 bg-grid opacity-50" />
                    <p className="text-xs font-medium tracking-[0.18em] text-primary uppercase">
                        At a machine
                    </p>
                    <h2 className="mt-3 font-display text-3xl sm:text-4xl">
                        Turn in your plastic
                    </h2>
                    <p className="mt-3 max-w-md text-sm text-muted-foreground">
                        You&apos;ll get a code for the keypad.
                    </p>
                    <Button
                        className="mt-6"
                        size="lg"
                        variant="primary"
                        disabled={starting}
                        onClick={async () => {
                            setStarting(true)
                            try {
                                const session = await browserApi<RecyclingSession>(
                                    "/recycling-sessions",
                                    {
                                        method: "POST",
                                        body: JSON.stringify({}),
                                        fallback: "Couldn't get a code",
                                    }
                                )
                                setSession(session)
                            } catch (error) {
                                push(
                                    error instanceof Error
                                        ? error.message
                                        : "Couldn't get a code",
                                    "danger"
                                )
                            }
                            setStarting(false)
                        }}
                    >
                        {starting ? "Getting it…" : "Get a code"}
                    </Button>
                </section>
            )}

            <section className="space-y-4">
                <SectionHeader
                    title="Latest drops"
                    action={
                        recent.length ? (
                            <ButtonLink href="/profile#activity" variant="ghost" size="sm">
                                See all
                            </ButtonLink>
                        ) : null
                    }
                />
                <ActivityHistory
                    deposits={recent}
                    loading={deposits.isPending && !deposits.data}
                    limit={4}
                    empty={
                        <p className="text-sm text-muted-foreground">
                            Your first drop will land here.
                        </p>
                    }
                />
            </section>
        </div>
    )
}
