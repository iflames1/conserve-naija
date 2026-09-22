"use client"

import { ArrowUpRight, LoaderCircle, Recycle } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

import { Button } from "@/components/ui/button"
import { useSessionActions } from "@/stores/session"

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080"

export function MissionStart() {
    const router = useRouter()
    const { setMission } = useSessionActions()
    const [isPending, startTransition] = useTransition()
    const [error, setError] = useState<string | null>(null)

    function startMission() {
        setError(null)
        if (!window.localStorage.getItem("conserve-naija-token")) {
            router.push("/auth/login?next=/deposit")
            return
        }
        startTransition(async () => {
            try {
                const response = await fetch(
                    `${API_URL}/api/v1/recycling-sessions`,
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            Authorization: `Bearer ${window.localStorage.getItem("conserve-naija-token")}`,
                        },
                        body: "{}",
                    }
                )
                if (!response.ok)
                    throw new Error("We could not start a mission.")
                const session = await response.json()
                setMission({
                    id: session.id,
                    status: session.status,
                    otp: session.otp,
                    otpExpiresAt: session.otp_expires_at,
                })
                router.push("/deposit")
            } catch (cause) {
                setError(cause instanceof Error ? cause.message : "Try again.")
            }
        })
    }

    return (
        <div className="space-y-4">
            <Button
                size="lg"
                className="h-14 w-full justify-between rounded-xl bg-primary px-5 text-base font-semibold text-primary-foreground shadow-[0_10px_30px_oklch(0.78_0.15_145_/_0.18)] hover:bg-primary/90"
                onClick={startMission}
                disabled={isPending}
            >
                <span className="flex items-center gap-3">
                    {isPending ? (
                        <LoaderCircle className="size-5 animate-spin" />
                    ) : (
                        <Recycle className="size-5" />
                    )}
                    Start recycling
                </span>
                <ArrowUpRight className="size-5" />
            </Button>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
    )
}
