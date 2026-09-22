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

import { buttonVariants } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { formatKilograms } from "@/lib/operations"
import { cn } from "@/lib/utils"
import {
    useMission,
    useSessionActions,
    type MissionStatus,
} from "@/stores/session"

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

/**
 * The recycling mission, as a modal.
 *
 * A mission is a short, focused task tied to where the citizen already is, so it
 * opens over the page instead of replacing it. Closing after a confirmed deposit
 * clears the mission so it does not reopen later.
 *
 * Session updates are applied by ``AppWsProvider`` at the app root, so they keep
 * arriving even while this dialog is closed.
 */
export function MissionDialog({
    open,
    onOpenChange,
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
}) {
    const mission = useMission()
    const { reset } = useSessionActions()
    const [copied, setCopied] = useState(false)

    const status = mission?.status
    const completed = Boolean(status === "completed" && mission?.result)
    const currentStage = stageIndex(status)

    function handleOpenChange(next: boolean) {
        // Once the result has been seen, drop the mission rather than leaving it
        // to reappear on the next visit.
        if (!next && completed) reset()
        onOpenChange(next)
    }

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent>
                {!mission ? (
                    <div aria-busy="true">
                        <DialogHeader>
                            <DialogTitle>Starting your mission</DialogTitle>
                            <DialogDescription>
                                Asking the machine to get ready.
                            </DialogDescription>
                        </DialogHeader>
                        <Skeleton className="mt-6 h-32 w-full rounded-2xl" />
                    </div>
                ) : completed ? (
                    <div>
                        <DialogHeader>
                            <div className="flex items-center gap-2 text-primary">
                                <CheckCircle2 className="size-5" />
                                <span className="text-xs font-medium tracking-[0.18em] uppercase">
                                    Mission complete
                                </span>
                            </div>
                            <DialogTitle className="mt-2">
                                That&apos;s in. Thank you.
                            </DialogTitle>
                            <DialogDescription>
                                Your deposit was measured by the machine and
                                valued by Conserve Naija.
                            </DialogDescription>
                        </DialogHeader>

                        <p className="tnum mt-6 font-display text-5xl text-primary">
                            {mission.result?.conservePoints.toLocaleString(
                                "en-NG"
                            )}{" "}
                            CP
                        </p>

                        <div className="mt-5 divide-y divide-border rounded-xl border border-border">
                            {(mission.result?.fractions ?? []).map(
                                (fraction) => (
                                    <div
                                        key={fraction.material}
                                        className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
                                    >
                                        <span className="capitalize">
                                            {fraction.material.replaceAll(
                                                "-",
                                                " "
                                            )}
                                        </span>
                                        <span className="tnum text-muted-foreground">
                                            {formatKilograms(
                                                fraction.weight_grams
                                            )}{" "}
                                            · {fraction.conserve_points} CP
                                        </span>
                                    </div>
                                )
                            )}
                        </div>

                        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
                            <Link
                                href="/activity"
                                onClick={() => handleOpenChange(false)}
                                className={cn(
                                    buttonVariants(),
                                    "w-full rounded-xl sm:w-auto"
                                )}
                            >
                                See your activity
                            </Link>
                            <button
                                type="button"
                                onClick={() => {
                                    reset()
                                    onOpenChange(false)
                                }}
                                className={cn(
                                    buttonVariants({ variant: "outline" }),
                                    "w-full rounded-xl sm:w-auto"
                                )}
                            >
                                Done
                            </button>
                        </div>
                    </div>
                ) : (
                    <div>
                        <DialogHeader>
                            <p className="flex items-center gap-2 text-xs text-muted-foreground">
                                <span className="size-2 animate-pulse rounded-full bg-live" />
                                {STAGES[currentStage].label}
                            </p>
                            <DialogTitle className="mt-1">
                                {status === "waiting_for_machine"
                                    ? "Your Conserve OTP is ready."
                                    : "Keep your materials moving."}
                            </DialogTitle>
                            <DialogDescription>
                                Enter this code on the machine at your Conserve
                                Site. This window updates on its own.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="mt-6 rounded-xl border border-border-strong bg-primary/5 p-5">
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                                <span className="flex items-center gap-2">
                                    <Smartphone className="size-4" /> Conserve
                                    OTP
                                </span>
                                <button
                                    type="button"
                                    className="flex items-center gap-1.5 rounded-lg px-2 py-1 hover:text-foreground"
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
                            <p className="tnum mt-4 font-mono text-4xl font-semibold tracking-[0.2em] text-primary sm:text-5xl">
                                {mission.otp ?? "------"}
                            </p>
                            <div className="mt-5 grid gap-2 border-t border-border pt-4 text-xs text-muted-foreground sm:grid-cols-2">
                                <span className="flex items-center gap-2">
                                    <Clock3 className="size-4" /> Expires in
                                    about 2 minutes
                                </span>
                                <span className="flex items-center gap-2">
                                    <MapPin className="size-4" /> Use any active
                                    machine
                                </span>
                            </div>
                        </div>

                        <ol className="mt-6 space-y-2.5">
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
                    </div>
                )}
            </DialogContent>
        </Dialog>
    )
}
