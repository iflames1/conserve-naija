"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "C", "0", "⏎"] as const

type Phase = "idle" | "code" | "in" | "weighing" | "done"

export function MachineKiosk() {
    const [phase, setPhase] = React.useState<Phase>("idle")
    const [digits, setDigits] = React.useState("")
    const [pressed, setPressed] = React.useState<string | null>(null)
    const [kg, setKg] = React.useState(1.2)

    React.useEffect(() => {
        if (phase !== "done") return
        const timer = window.setTimeout(() => {
            setPhase("idle")
            setDigits("")
        }, 2800)
        return () => window.clearTimeout(timer)
    }, [phase])

    React.useEffect(() => {
        if (phase !== "weighing") return
        const timer = window.setTimeout(() => setPhase("done"), 700)
        return () => window.clearTimeout(timer)
    }, [phase])

    function tap(key: string) {
        setPressed(key)
        window.setTimeout(() => setPressed((current) => (current === key ? null : current)), 140)

        if (key === "WEIGH") {
            if (phase === "in") setPhase("weighing")
            return
        }

        if (phase === "weighing" || phase === "done") return

        if (key === "C" || key === "*") {
            setDigits("")
            setPhase("idle")
            return
        }

        if (key === "⏎") {
            if (digits.length === 6) {
                setKg(1.2)
                setPhase("in")
            }
            return
        }

        if (!/^\d$/.test(key)) return
        if (phase === "in") return
        setDigits((current) => {
            if (current.length >= 6) return current
            const next = current + key
            setPhase("code")
            return next
        })
    }

    return (
        <div className="mx-auto w-full max-w-75 rounded-[1.6rem] border border-border/70 bg-card/90 p-4 shadow-2xl shadow-black/40 surface-raised">
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
                        <p className="text-foreground">
                            {`${digits.padEnd(6, "_").slice(0, 3)} ${digits.padEnd(6, "_").slice(3)}`}
                        </p>
                        <p className="text-foreground/80">C cancel</p>
                        <p className="text-foreground/80">⏎ enter</p>
                    </>
                ) : null}
                {phase === "in" ? (
                    <>
                        <p>YOU&apos;RE IN</p>
                        <p className="text-foreground">{kg.toFixed(2)} KG mixed</p>
                        <p className="text-foreground/80">Dump mixed waste</p>
                        <p className="text-foreground/80">Press WEIGH</p>
                    </>
                ) : null}
                {phase === "weighing" ? (
                    <>
                        <p>WEIGHING...</p>
                        <p className="text-foreground">{kg.toFixed(2)} KG</p>
                        <p className="text-foreground/80">Hold still</p>
                        <p>&nbsp;</p>
                    </>
                ) : null}
                {phase === "done" ? (
                    <>
                        <p>THAT&apos;S IN</p>
                        <p className="text-foreground">{kg.toFixed(2)} KG MIXED</p>
                        <p className="text-foreground">+{Math.round(kg * 100)} CP</p>
                        <p className="text-foreground/80">Conserve Site Yaba</p>
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
    return (
        <button
            type="button"
            aria-label={
                label === "⏎" ? "Enter" : label === "C" || label === "*" ? "Cancel" : label
            }
            onClick={onPress}
            className={cn(
                "grid h-9 place-items-center rounded-md border border-border/70 bg-muted/40 font-mono text-xs text-foreground transition-transform active:translate-y-px",
                active && "scale-95 border-primary/50 bg-primary/20 text-primary"
            )}
        >
            {label}
        </button>
    )
}
