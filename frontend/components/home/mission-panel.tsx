"use client"

import * as React from "react"

import { browserApi } from "@/lib/api/browser"
import { Badge, Button, LiveDot } from "@/components/ui"
import {
    formatKg,
    formatPoints,
    formatSessionCode,
} from "@/lib/utils"
import type { RecyclingSession } from "@/lib/api/types"
import { useLiveActions, useLiveSession } from "@/stores/live"
import { useNotificationActions } from "@/stores/notifications"

function statusCopy(session: RecyclingSession): {
    title: string
    body: string
    live: boolean
    phase: 0 | 1 | 2
} {
    switch (session.status) {
        case "waiting_for_machine":
            return {
                title: "Your code",
                body: "Type it on the keypad. You've got a couple of minutes.",
                live: true,
                phase: 0,
            }
        case "connected":
            return {
                title: "You're in",
                body: "Put the plastic on the scale.",
                live: true,
                phase: 1,
            }
        case "measuring":
            return {
                title: "On the scale",
                body: session.weightKg
                    ? `${formatKg(session.weightKg)} so far.`
                    : "Leave it on until the weight settles.",
                live: true,
                phase: 1,
            }
        case "processing":
            return {
                title: "Counting it up",
                body: "Hang on.",
                live: true,
                phase: 2,
            }
        case "completed":
            return {
                title: "That's in",
                body: "This code is done. Get another when you have more to turn in.",
                live: false,
                phase: 2,
            }
        case "expired":
            return {
                title: "Code timed out",
                body: "They only last a couple of minutes. Get a new one at the machine.",
                live: false,
                phase: 0,
            }
        case "cancelled":
            return {
                title: "Alright, later",
                body: "Nothing was turned in.",
                live: false,
                phase: 0,
            }
        case "failed":
            return {
                title: "This one didn't finish",
                body:
                    session.failureReason ??
                    "Get a new code and try that machine again.",
                live: false,
                phase: 0,
            }
        default:
            return {
                title: "Turn in plastic",
                body: "Follow the machine in front of you.",
                live: false,
                phase: 0,
            }
    }
}

function closedLabel(status: RecyclingSession["status"]): string {
    if (status === "completed") return "Paid"
    if (status === "expired") return "Timed out"
    if (status === "cancelled") return "Stopped"
    if (status === "failed") return "Didn't finish"
    return "Done"
}

const PHASES = ["Code", "Scale", "Paid"]

export function MissionPanel() {
    const session = useLiveSession()
    const { setSession, clearSession } = useLiveActions()
    const { push } = useNotificationActions()
    const [busy, setBusy] = React.useState(false)

    if (!session) return null

    const copy = statusCopy(session)
    const open =
        session.status === "waiting_for_machine" ||
        session.status === "connected" ||
        session.status === "measuring" ||
        session.status === "processing"
    const showCode = open

    return (
        <section className="relative isolate overflow-hidden rounded-2xl border border-primary/25 bg-primary/8 p-5 sm:p-7">
            <div aria-hidden className="absolute inset-0 -z-10 bg-grid opacity-40" />
            <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs font-medium tracking-[0.18em] text-primary uppercase">
                    At the machine
                </p>
                {copy.live ? (
                    <Badge variant="live">Live</Badge>
                ) : (
                    <Badge variant="outline">{closedLabel(session.status)}</Badge>
                )}
            </div>

            <h2 className="mt-4 font-display text-3xl sm:text-4xl">{copy.title}</h2>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">{copy.body}</p>

            {showCode ? (
                <p className="mt-6 font-mono text-5xl tracking-[0.22em] text-foreground sm:text-6xl">
                    {formatSessionCode(session.code)}
                </p>
            ) : null}

            {session.status === "connected" || session.status === "measuring" ? (
                <p className="mt-4 flex items-center gap-2 text-sm">
                    <LiveDot />
                    {session.deviceExternalId ?? "Conserve machine"}
                    {session.collectionPointName
                        ? ` · ${session.collectionPointName}`
                        : ""}
                </p>
            ) : null}

            {session.status === "completed" ? (
                <div className="mt-6">
                    <p className="text-sm text-muted-foreground">
                        {formatKg(session.weightKg)} {session.materialName ?? "plastic"}
                    </p>
                    <p className="tnum mt-1 font-display text-3xl text-primary">
                        +{formatPoints(session.greenPoints)} GP
                    </p>
                </div>
            ) : null}

            <ol className="mt-6 flex gap-6 text-xs text-muted-foreground">
                {PHASES.map((phase, index) => (
                    <li
                        key={phase}
                        className={
                            index <= copy.phase
                                ? "font-medium text-foreground"
                                : undefined
                        }
                    >
                        {phase}
                    </li>
                ))}
            </ol>

            <div className="mt-6 flex flex-wrap items-center gap-2">
                {open ? (
                    <Button
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground"
                        disabled={busy}
                        onClick={async () => {
                            setBusy(true)
                            try {
                                await browserApi(
                                    `/recycling-sessions/${session.id}/cancel`,
                                    {
                                        method: "POST",
                                        fallback: "Couldn't cancel this",
                                    }
                                )
                                clearSession()
                            } catch (error) {
                                push(
                                    error instanceof Error
                                        ? error.message
                                        : "Couldn't cancel this",
                                    "danger"
                                )
                            }
                            setBusy(false)
                        }}
                    >
                        {busy ? "Stopping…" : "Later"}
                    </Button>
                ) : (
                    <Button
                        variant="primary"
                        disabled={busy}
                        onClick={async () => {
                            setBusy(true)
                            try {
                                const next = await browserApi<RecyclingSession>(
                                    "/recycling-sessions",
                                    {
                                        method: "POST",
                                        body: JSON.stringify({}),
                                        fallback: "Couldn't get a code",
                                    }
                                )
                                setSession(next)
                            } catch (error) {
                                push(
                                    error instanceof Error
                                        ? error.message
                                        : "Couldn't get a code",
                                    "danger"
                                )
                            }
                            setBusy(false)
                        }}
                    >
                        {busy ? "Getting a code…" : "Get another code"}
                    </Button>
                )}
                {session.status === "completed" ? (
                    <Button variant="ghost" size="sm" onClick={() => clearSession()}>
                        Done
                    </Button>
                ) : null}
            </div>
        </section>
    )
}
