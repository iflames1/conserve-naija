"use client"

import * as React from "react"

import { browserApi } from "@/lib/api/browser"
import { Badge, Button, LiveDot } from "@/components/ui"
import {
    cpAmount,
    formatKg,
    formatPoints,
    formatSessionCode,
    siteLabel,
} from "@/lib/utils"
import type { RecyclingSession } from "@/lib/api/types"
import { useLiveActions, useLiveSession } from "@/stores/live"
import { useNotificationActions } from "@/stores/notifications"

function phaseFor(status: RecyclingSession["status"]): 0 | 1 | 2 {
    switch (status) {
        case "waiting_for_machine":
            return 0
        case "connected":
        case "sorting":
        case "measuring":
            return 1
        case "processing":
        case "completed":
            return 2
        default:
            return 0
    }
}

function statusCopy(session: RecyclingSession): {
    title: string
    body: string
    live: boolean
    phase: 0 | 1 | 2
} {
    const site = siteLabel(session)
    const phase = phaseFor(session.status)
    switch (session.status) {
        case "waiting_for_machine":
            return {
                title: "Your Conserve OTP",
                body: "Type it on the keypad. You've got a couple of minutes.",
                live: true,
                phase,
            }
        case "connected":
            return {
                title: site ? `You're connected to ${site}` : "You're in",
                body: "Dump what you've got. The machine sorts it from there.",
                live: true,
                phase,
            }
        case "sorting":
            return {
                title: "Sorting",
                body: "Mixed waste is splitting into material fractions.",
                live: true,
                phase,
            }
        case "measuring":
            return {
                title: "On the scale",
                body: session.weightKg
                    ? `${formatKg(session.weightKg)} so far.`
                    : "Fractions are being weighed.",
                live: true,
                phase,
            }
        case "processing":
            return {
                title: "Counting it up",
                body: "Hang on. Conserve Points land in a moment.",
                live: true,
                phase,
            }
        case "completed":
            return {
                title: "That's in",
                body: "This OTP is done. Start recycling again when you have more.",
                live: false,
                phase,
            }
        case "expired":
            return {
                title: "OTP timed out",
                body: "They only last a couple of minutes. Start recycling again when you're at the site.",
                live: false,
                phase,
            }
        case "cancelled":
            return {
                title: "Alright, later",
                body: "Nothing was turned in.",
                live: false,
                phase,
            }
        case "failed":
            return {
                title: "This one didn't finish",
                body:
                    session.failureReason ??
                    "Start recycling again at that site.",
                live: false,
                phase,
            }
        default:
            return {
                title: "Start recycling",
                body: "Follow the machine in front of you.",
                live: false,
                phase,
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

const PHASES = ["Enter OTP", "Recycle Waste", "Earn Conserve Point"]

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
        session.status === "sorting" ||
        session.status === "measuring" ||
        session.status === "processing"
    const showCode = open
    const atSite =
        session.status === "connected" ||
        session.status === "sorting" ||
        session.status === "measuring"
    const fractions = session.fractions ?? []
    const points = cpAmount(session)

    return (
        <section className="relative isolate overflow-hidden rounded-2xl border border-primary/25 bg-primary/8 p-5 sm:p-7">
            <div aria-hidden className="absolute inset-0 -z-10 bg-grid opacity-40" />
            <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs font-medium tracking-[0.18em] text-primary uppercase">
                    In the Conserve Site
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

            {atSite ? (
                <p className="mt-4 flex items-center gap-2 text-sm">
                    <LiveDot />
                    {session.deviceExternalId ?? "Conserve machine"}
                    {siteLabel(session) ? ` · ${siteLabel(session)}` : ""}
                </p>
            ) : null}

            {session.status === "completed" ? (
                <div className="mt-6 space-y-3">
                    {fractions.length > 1 ? (
                        <ul className="space-y-1 text-sm text-muted-foreground">
                            {fractions.map((line) => (
                                <li key={line.materialSlug}>
                                    {formatKg(line.weightKg)} {line.materialName}
                                    {" · "}
                                    +{formatPoints(cpAmount(line))} CP
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-sm text-muted-foreground">
                            {formatKg(session.weightKg)}{" "}
                            {session.materialName ?? "recyclables"}
                        </p>
                    )}
                    <p className="tnum mt-1 font-display text-3xl text-primary">
                        +{formatPoints(points)} CP
                    </p>
                </div>
            ) : null}

            <ol className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted-foreground">
                {PHASES.map((phase, index) => (
                    <li
                        key={phase}
                        className={
                            index <= copy.phase
                                ? "whitespace-nowrap font-medium text-foreground"
                                : "whitespace-nowrap"
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
                                        fallback: "Couldn't start recycling",
                                    }
                                )
                                setSession(next)
                            } catch (error) {
                                push(
                                    error instanceof Error
                                        ? error.message
                                        : "Couldn't start recycling",
                                    "danger"
                                )
                            }
                            setBusy(false)
                        }}
                    >
                        {busy ? "Starting…" : "Start recycling"}
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
