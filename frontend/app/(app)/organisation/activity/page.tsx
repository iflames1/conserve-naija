"use client"

import * as React from "react"
import { useQuery } from "@tanstack/react-query"

import { listOrgDepositsAction } from "@/actions/organisation"
import { EmptyState } from "@/components/ui"
import { formatKg, formatPoints, formatRelativeTime } from "@/lib/utils"
import { useSessionUser } from "@/stores/session"

export default function OrgActivityPage() {
    const user = useSessionUser()
    const deposits = useQuery({
        queryKey: ["org-deposits", user?.id],
        enabled: Boolean(user),
        queryFn: async () => {
            const result = await listOrgDepositsAction()
            if (!result.ok) throw new Error(result.error)
            return result.data
        },
    })

    return (
        <div>
            <h1 className="text-4xl font-semibold tracking-tight">Activity</h1>
            <p className="mt-2 text-muted-foreground">
                Deposits across your machines. Same records people see in their
                activity.
            </p>
            <div className="mt-8 space-y-2">
                {deposits.data?.length ? (
                    deposits.data.map((deposit) => (
                        <div
                            key={deposit.id}
                            className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/60 px-4 py-3"
                        >
                            <div>
                                <p className="font-medium">
                                    +{formatKg(deposit.weightKg)} {deposit.materialName}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    {deposit.collectionPointName} · +
                                    {formatPoints(deposit.greenPoints)} GP
                                </p>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                {formatRelativeTime(deposit.confirmedAt ?? deposit.createdAt)}
                            </p>
                        </div>
                    ))
                ) : (
                    <EmptyState title="No deposits yet" />
                )}
            </div>
        </div>
    )
}
