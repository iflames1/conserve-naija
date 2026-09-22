"use client"

import Link from "next/link"
import {
    CheckCircle2,
    Clock3,
    Copy,
    LoaderCircle,
    MapPin,
    Recycle,
    Smartphone,
} from "lucide-react"
import { useState } from "react"

import { AppHeader } from "@/components/common/app-header"
import { buttonVariants } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { formatKilograms } from "@/lib/operations"
import { cn } from "@/lib/utils"
import { useMissionSocket } from "@/lib/ws/use-mission-socket"
import { useMission, type MissionStatus } from "@/stores/session"

const STAGES: { status: MissionStatus; label: string }[] = [
    { status: "waiting_for_machine", label: "Waiting for machine" },
    { status: "connected", label: "Machine connected" },
    { status: "sorting", label: "Sorting materials" },
    { status: "processing", label: "Confirming deposit" },
    { status: "completed", label: "Deposit confirmed" },
]

function stageIndex(status: MissionStatus | undefined) {
    const index = STAGES.findIndex((stage) => stage.status === status)
    return index === -1 ? 0 : index
}

export function MissionPanel() {
    useMissionSocket()
    const mission = useMission()
    const [copied, setCopied] = useState(false)

    const status = mission?.status
    const completed = status === "completed" && mission?.result
    const currentStage = stageIndex(status)

    return (
        <main className="mx-auto flex min-h-svh w-full max-w-2xl flex-col px-5 pt-6 pb-12 sm:px-8">
            <AppHeader active="deposit" />

            {!mission ? (
                <section className="py-16" aria-busy="true">
                    <p className="text-sm font-medium tracking-[0.18em] text-primary uppercase">
                        Recycling mission
                    </p>
                    <Skeleton className="mt-4 h-12 w-full max-w-md" />
                    <Skeleton className="mt-8 h-48 w-full rounded-2xl" />
                    <p className="mt-6 text-sm text-muted-foreground">
                        No mission is running.{" "}
                        <Link href="/" className="text-primary hover:underline">
                            Start recycling
                        </Link>
                    </p>
                </section>
            ) : completed ? (
                <section className="py-12">
                    <div className="flex items-center gap-3 text-primary">
                        <CheckCircle2 className="size-6" />
                        <p className="text-sm font-medium tracking-[0.18em] uppercase">
                            Mission complete
                        </p>
                    </div>
                    <h1 className="mt-5 font-display text-4xl leading-tight tracking-tight sm:text-5xl">
                        That&apos;s in. Thank you.
                    </h1>
                    <p className="tnum mt-8 font-display text-6xl text-primary sm:text-7xl">
                        {mission.result?.conservePoints.toLocaleString("en-NG")}{" "}
                        CP
                    </p>
                    <p className="mt-3 text-muted-foreground">
                        Your deposit was measured by the machine and valued by
                        Conserve Naija.
                    </p>

                    <div className="mt-8 divide-y divide-border rounded-2xl border border-border surface-raised">
                        {(mission.result?.fractions ?? []).map((fraction) => (
                            <div
                                key={fraction.material}
                                className="flex flex-wrap items-center justify-between gap-3 p-5"
                            >
                                <span className="capitalize">
                                    {fraction.material.replaceAll("-", " ")}
                                </span>
                                <span className="tnum text-sm text-muted-foreground">
                                    {formatKilograms(fraction.weight_grams)} ·{" "}
                                    {fraction.conserve_points} CP
                                </span>
                            </div>
                        ))}
                    </div>

                    <div className="mt-8 flex flex-wrap gap-3">
                        <Link
                            href="/activity"
                            className={cn(
                                buttonVariants({ size: "lg" }),
                                "rounded-xl"
                            )}
                        >
                            See your activity
                        </Link>
                        <Link
                            href="/"
                            className={cn(
                                buttonVariants({
                                    variant: "outline",
                                    size: "lg",
                                }),
                                "rounded-xl"
                            )}
                        >
                            Start another mission
                        </Link>
                    </div>
                </section>
            ) : (
                <section className="py-12">
                    <p className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
                        <span className="size-2 animate-pulse rounded-full bg-live" />
                        {STAGES[currentStage].label}
                    </p>
                    <h1 className="font-display text-4xl leading-tight tracking-tight text-balance sm:text-5xl">
                        {status === "waiting_for_machine"
                            ? "Your Conserve OTP is ready."
                            : "Keep your materials moving."}
                    </h1>
                    <p className="mt-4 max-w-lg text-base leading-7 text-muted-foreground">
                        Enter this code on the machine at your Conserve Site.
                        Your phone updates on its own as the mission progresses.
                    </p>

                    <div className="mt-8 rounded-2xl border border-border-strong p-6 surface-raised sm:p-8">
                        <div className="flex items-center justify-between text-sm text-muted-foreground">
                            <span className="flex items-center gap-2">
                                <Smartphone className="size-4" /> Conserve OTP
                            </span>
                            <button
                                type="button"
                                className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs hover:text-foreground"
                                onClick={() => {
                                    if (!mission.otp) return
                                    void navigator.clipboard
                                        ?.writeText(mission.otp)
                                        .then(() => setCopied(true))
                                }}
                            >
                                <Copy className="size-4" />
                                {copied ? "Copied" : "Copy"}
                            </button>
                        </div>
                        <p className="tnum mt-5 font-mono text-5xl font-semibold tracking-[0.22em] text-primary sm:text-6xl">
                            {mission.otp ?? "------"}
                        </p>
                        <div className="mt-7 grid gap-3 border-t border-border pt-5 text-sm text-muted-foreground sm:grid-cols-2">
                            <span className="flex items-center gap-2">
                                <Clock3 className="size-4" /> Expires in about 2
                                minutes
                            </span>
                            <span className="flex items-center gap-2">
                                <MapPin className="size-4" /> Use any active
                                machine
                            </span>
                        </div>
                    </div>

                    <ol className="mt-10 space-y-3">
                        {STAGES.map((stage, index) => {
                            const done = index < currentStage
                            const active = index === currentStage
                            return (
                                <li
                                    key={stage.status}
                                    className={cn(
                                        "flex items-center gap-3 text-sm",
                                        active && "text-foreground",
                                        done && "text-primary",
                                        !done &&
                                            !active &&
                                            "text-muted-foreground"
                                    )}
                                >
                                    {done ? (
                                        <CheckCircle2 className="size-4" />
                                    ) : active ? (
                                        <LoaderCircle className="size-4 animate-spin" />
                                    ) : (
                                        <Recycle className="size-4 opacity-40" />
                                    )}
                                    {stage.label}
                                </li>
                            )
                        })}
                    </ol>
                </section>
            )}
        </main>
    )
}
