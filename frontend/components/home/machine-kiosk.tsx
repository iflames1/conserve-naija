"use client"

import { useEffect, useState } from "react"

import { cn } from "@/lib/utils"

const KEYS = [
    "1",
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "8",
    "9",
    "C",
    "0",
    "⏎",
] as const

type Phase = "idle" | "code" | "in" | "weighing" | "done"

/** Illustrative deposit weight for the idle animation, not a real measurement. */
const DEMO_WEIGHT_KG = 1.2

const RESET_AFTER_MS = 2800
const WEIGH_MS = 700
const KEY_FLASH_MS = 140

/**
 * A preview of the machine at a Conserve Site.
 *
 * Purely presentational: it performs no network calls and never produces a
 * Conserve Points figure. The machine reports a measurement; the app shows the
 * reward.
 */
export function MachineKiosk() {
    const [phase, setPhase] = useState<Phase>("idle")
    const [digits, setDigits] = useState("")
    const [pressed, setPressed] = useState<string | null>(null)

    useEffect(() => {
        if (phase !== "done") return
        const timer = window.setTimeout(() => {
            setPhase("idle")
            setDigits("")
        }, RESET_AFTER_MS)
        return () => window.clearTimeout(timer)
    }, [phase])

    useEffect(() => {
        if (phase !== "weighing") return
        const timer = window.setTimeout(() => setPhase("done"), WEIGH_MS)
        return () => window.clearTimeout(timer)
    }, [phase])

    function tap(key: string) {
        setPressed(key)
        window.setTimeout(
            () => setPressed((current) => (current === key ? null : current)),
            KEY_FLASH_MS
        )

        if (key === "WEIGH") {
            if (phase === "in") setPhase("weighing")
            return
        }
        if (phase === "weighing" || phase === "done") return

        if (key === "C") {
            setDigits("")
            setPhase("idle")
            return
        }

        if (key === "⏎") {
            if (digits.length === 6) setPhase("in")
            return
        }

        if (!/^\d$/.test(key) || phase === "in") return
        setDigits((current) => {
            if (current.length >= 6) return current
            setPhase("code")
            return current + key
        })
    }

    return (
        <div className="w-full max-w-xs rounded-[1.6rem] border border-border p-4 shadow-2xl shadow-black/40 surface-raised">
            <p className="mb-3 text-center text-[11px] font-medium tracking-[0.18em] text-muted-foreground uppercase">
                On the machine
            </p>

            <div
                aria-live="polite"
                className="rounded-lg border border-primary/30 bg-primary/10 px-4 py-4 font-mono text-[13px] leading-6 tracking-wide text-primary"
            >
                {phase === "idle" ? (
                    <>
                        <p>Welcome to</p>
                        <p>Conserve Site Yaba</p>
                        <p className="text-foreground/80">CN-MACHINE-001</p>
                        <p className="text-foreground/80">Input Conserve OTP</p>
                    </>
                ) : null}

                {phase === "code" ? (
                    <>
                        <p>YOUR OTP</p>
                        <p className="tnum text-foreground">
                            {`${digits.padEnd(6, "_").slice(0, 3)} ${digits
                                .padEnd(6, "_")
                                .slice(3)}`}
                        </p>
                        <p className="text-foreground/80">C cancel</p>
                        <p className="text-foreground/80">⏎ enter</p>
                    </>
                ) : null}

                {phase === "in" ? (
                    <>
                        <p>YOU&apos;RE IN</p>
                        <p className="tnum text-foreground">
                            {DEMO_WEIGHT_KG.toFixed(2)} KG mixed
                        </p>
                        <p className="text-foreground/80">Dump mixed waste</p>
                        <p className="text-foreground/80">Press WEIGH</p>
                    </>
                ) : null}

                {phase === "weighing" ? (
                    <>
                        <p>WEIGHING...</p>
                        <p className="tnum text-foreground">
                            {DEMO_WEIGHT_KG.toFixed(2)} KG
                        </p>
                        <p className="text-foreground/80">Hold still</p>
                        <p>&nbsp;</p>
                    </>
                ) : null}

                {phase === "done" ? (
                    <>
                        <p>THAT&apos;S IN</p>
                        <p className="tnum text-foreground">
                            {DEMO_WEIGHT_KG.toFixed(2)} KG MIXED
                        </p>
                        <p className="text-foreground">Deposit confirmed</p>
                        <p className="text-foreground/80">Check your phone</p>
                    </>
                ) : null}
            </div>

            <div className="mt-4 grid grid-cols-3 gap-1.5">
                {KEYS.map((key) => (
                    <Key
                        key={key}
                        label={key}
                        active={pressed === key}
                        onPress={() => tap(key)}
                    />
                ))}
                <button
                    type="button"
                    aria-label="Weigh"
                    onClick={() => tap("WEIGH")}
                    className={cn(
                        "col-span-3 grid h-10 w-full place-items-center rounded-md text-xs font-medium tracking-[0.14em] uppercase transition-transform",
                        phase === "in"
                            ? "bg-primary text-primary-foreground shadow-md shadow-primary/25 active:translate-y-px"
                            : "bg-primary/40 text-primary-foreground/80",
                        pressed === "WEIGH" && "scale-95"
                    )}
                >
                    Weigh
                </button>
            </div>
        </div>
    )
}

function Key({
    label,
    active,
    onPress,
}: {
    label: string
    active: boolean
    onPress: () => void
}) {
    const ariaLabel = label === "⏎" ? "Enter" : label === "C" ? "Cancel" : label

    return (
        <button
            type="button"
            aria-label={ariaLabel}
            onClick={onPress}
            className={cn(
                "grid h-9 place-items-center rounded-md border border-border bg-muted/40 font-mono text-xs text-foreground transition-transform active:translate-y-px",
                active &&
                    "scale-95 border-primary/50 bg-primary/20 text-primary"
            )}
        >
            {label}
        </button>
    )
}
