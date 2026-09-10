"use client"

import { ButtonLink, Skeleton } from "@/components/ui"
import { cpBalance, formatPoints } from "@/lib/utils"
import { useSessionLoading, useSessionUser } from "@/stores/session"

export function GpPill() {
    const user = useSessionUser()
    const loading = useSessionLoading()

    if (loading && !user) {
        return <Skeleton className="h-9 w-24 rounded-full" />
    }
    if (!user) return null

    return (
        <ButtonLink
            href="/profile"
            variant="ghost"
            className="h-9 rounded-full border border-border/70 bg-card/60 px-3.5 text-sm hover:border-border-strong hover:bg-card/60"
        >
            <span className="tnum font-medium">
                {formatPoints(cpBalance(user))} CP
            </span>
        </ButtonLink>
    )
}
