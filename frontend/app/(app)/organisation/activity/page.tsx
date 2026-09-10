"use client"

import { useQuery } from "@tanstack/react-query"

import { browserApi } from "@/lib/api/browser"
import { OrgDepositRow } from "@/components/organisation/deposit-row"
import { EmptyState } from "@/components/ui"
import type { Deposit } from "@/lib/api/types"
import { useSessionUser } from "@/stores/session"

export default function OrgActivityPage() {
    const user = useSessionUser()
    const deposits = useQuery({
        queryKey: ["org-deposits", user?.id],
        enabled: Boolean(user),
        queryFn: () =>
            browserApi<Deposit[]>("/organisation/deposits", {
                fallback: "Failed to load organisation activity",
            }),
    })

    return (
        <div>
            <h1 className="text-4xl font-semibold tracking-tight">Activity</h1>
            <p className="mt-2 text-muted-foreground">
                Deposits across your machines. Same records people see in their
                activity.
            </p>
            <div className="mt-8 space-y-2">
                {deposits.isPending && !deposits.data ? null : deposits.data?.length ? (
                    deposits.data.map((deposit) => (
                        <OrgDepositRow key={deposit.id} deposit={deposit} />
                    ))
                ) : (
                    <EmptyState title="No deposits yet" />
                )}
            </div>
        </div>
    )
}
