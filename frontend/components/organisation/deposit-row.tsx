import type { Deposit } from "@/lib/api/types"
import {
    cpAmount,
    formatDepositMaterials,
    formatPoints,
    formatRelativeTime,
    siteLabel,
} from "@/lib/utils"

export function OrgDepositRow({ deposit }: { deposit: Deposit }) {
    return (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/60 px-4 py-3">
            <div className="min-w-0">
                <p className="font-medium">{formatDepositMaterials(deposit)}</p>
                <p className="text-xs text-muted-foreground">
                    {siteLabel(deposit)} · +{formatPoints(cpAmount(deposit))} CP
                </p>
            </div>
            <p className="text-xs text-muted-foreground">
                {formatRelativeTime(deposit.confirmedAt ?? deposit.createdAt)}
            </p>
        </div>
    )
}
