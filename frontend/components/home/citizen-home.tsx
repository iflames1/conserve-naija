"use client"

import * as React from "react"

import { browserApi } from "@/lib/api/browser"
import type { RecyclingSession } from "@/lib/api/types"
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
    cpBalance,
} from "@/lib/utils"
import { useActivityDeposits, useActivityLoading } from "@/stores/activity"
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

    const deposits = useActivityDeposits()
    const depositsLoading = useActivityLoading()

    if (!user) return null

    const recent = deposits

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
                            {formatPoints(cpBalance(user))} CP
                        </h1>
                        <p className="mt-1 text-sm text-muted-foreground">
                            {formatNaira(user.nairaValue)} in your wallet · 1 CP = ₦1
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
                        In the Conserve Site
                    </p>
                    <h2 className="mt-3 font-display text-3xl sm:text-4xl">
                        Start recycling
                    </h2>
                    <p className="mt-3 max-w-md text-sm text-muted-foreground">
                        You&apos;ll get a Conserve OTP for the keypad. The site
                        comes from the machine in front of you.
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
                                        fallback: "Couldn't start recycling",
                                    }
                                )
                                setSession(session)
                            } catch (error) {
                                push(
                                    error instanceof Error
                                        ? error.message
                                        : "Couldn't start recycling",
                                    "danger"
                                )
                            }
                            setStarting(false)
                        }}
                    >
                        {starting ? "Starting…" : "Start recycling"}
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
                    loading={depositsLoading && recent.length === 0}
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
