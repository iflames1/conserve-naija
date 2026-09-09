"use client"

import * as React from "react"

import { RiRecycleLine } from "@remixicon/react"

import { ActivityRowsSkeleton } from "@/components/common/page-skeleton"
import { ButtonLink, EmptyState } from "@/components/ui"
import type { Deposit } from "@/lib/api/types"
import { cn, formatKg, formatPoints, formatRelativeTime } from "@/lib/utils"

export function ActivityHistory({
    deposits,
    loading,
    limit,
    empty,
}: {
    deposits: Deposit[]
    loading?: boolean
    limit?: number
    empty?: React.ReactNode
}) {
    if (loading) {
        return <ActivityRowsSkeleton rows={limit ?? 5} />
    }

    const rows = limit ? deposits.slice(0, limit) : deposits

    if (!rows.length) {
        if (empty) return <>{empty}</>
        return (
            <EmptyState
                icon={<RiRecycleLine />}
                title="Nothing here yet"
                description="First drop shows up after a machine weighs it."
                action={
                    <ButtonLink href="/" variant="primary" size="sm">
                        Get a code
                    </ButtonLink>
                }
            />
        )
    }

    return (
        <ul className="divide-y divide-border/60 overflow-hidden rounded-2xl border border-border/70 surface-raised">
            {rows.map((deposit) => (
                <li key={deposit.id}>
                    <div className="flex items-center gap-3 px-3 py-2.5">
                        <span className="tnum grid size-9 shrink-0 place-items-center rounded-lg bg-primary/15 font-display text-xs text-primary">
                            {(deposit.materialName ?? "?").slice(0, 1).toUpperCase()}
                        </span>
                        <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">
                                {formatKg(deposit.weightKg)} {deposit.materialName}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                                {deposit.collectionPointName}
                            </p>
                        </div>
                        <div className="shrink-0 text-right">
                            <p
                                className={cn(
                                    "tnum font-display text-sm",
                                    (deposit.greenPoints ?? 0) > 0
                                        ? "text-primary"
                                        : "text-muted-foreground"
                                )}
                            >
                                +{formatPoints(deposit.greenPoints)} GP
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                                {formatRelativeTime(
                                    deposit.confirmedAt ?? deposit.createdAt
                                )}
                            </p>
                        </div>
                    </div>
                </li>
            ))}
        </ul>
    )
}
