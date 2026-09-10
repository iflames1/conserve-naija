import {
    RiLeafLine,
    RiScalesLine,
    RiWallet3Line,
} from "@remixicon/react"

import { Stat } from "@/components/ui"
import type { AppUser } from "@/lib/api/types"
import { formatKg, formatNaira, formatPoints, cpBalance } from "@/lib/utils"

export function ProfileStats({ user }: { user: AppUser }) {
    return (
        <div className="grid grid-cols-2 gap-5 rounded-2xl border border-border/70 p-5 surface-raised sm:grid-cols-3">
            <Stat
                icon={<RiLeafLine />}
                label="Drops"
                value={(user.depositCount ?? 0).toLocaleString("en-NG")}
            />
            <Stat
                icon={<RiScalesLine />}
                label="Recycled"
                value={formatKg(user.recycledKg ?? 0)}
            />
            <Stat
                icon={<RiWallet3Line />}
                label="Wallet"
                tone="success"
                value={`${formatPoints(cpBalance(user))} CP`}
                hint={`${formatNaira(user.nairaValue)} · 1 CP = ₦1`}
                className="col-span-2 sm:col-span-1"
            />
        </div>
    )
}
