import type { Metadata } from "next"

import { OpsShell } from "@/components/organisation/ops-shell"
import { PickupsPanel } from "./_components/pickups-panel"

export const metadata: Metadata = {
    title: "Pickups",
    description:
        "Manage collection of accumulated recyclable material from your Conserve Sites.",
}

export default function PickupsPage() {
    return (
        <OpsShell>
            <PickupsPanel />
        </OpsShell>
    )
}
