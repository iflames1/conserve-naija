"use client"

import { ArrowUpRight, LoaderCircle, Recycle } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

import { Button } from "@/components/ui/button"
import { ApiError, apiFetch } from "@/lib/api"
import { useAuthToken } from "@/stores/auth"
import { useSessionActions, type MissionStatus } from "@/stores/session"

type SessionResponse = {
    id: string
    status: MissionStatus
    otp: string | null
    otp_expires_at: string | null
}

export function MissionStart() {
    const router = useRouter()
    const token = useAuthToken()
    const { setMission } = useSessionActions()
    const [isPending, startTransition] = useTransition()
    const [error, setError] = useState<string | null>(null)

    function startMission() {
        setError(null)
        if (!token) {
            router.push("/auth/login?next=/deposit")
            return
        }
        startTransition(async () => {
            try {
                const session = await apiFetch<SessionResponse>(
                    "/api/v1/recycling-sessions",
                    { method: "POST", body: {}, token }
                )
                setMission({
                    id: session.id,
                    status: session.status,
                    otp: session.otp ?? undefined,
                    otpExpiresAt: session.otp_expires_at ?? undefined,
                })
                router.push("/deposit")
            } catch (cause) {
                setError(
                    cause instanceof ApiError
                        ? cause.message
                        : "We could not start a mission."
                )
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
