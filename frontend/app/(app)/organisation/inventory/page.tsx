import type { Metadata } from "next"

import { OpsShell } from "@/components/organisation/ops-shell"
import { InventoryPanel } from "./_components/inventory-panel"

export const metadata: Metadata = {
    title: "Inventory",
    description:
        "Recyclable material currently held at each Conserve Site, by material and weight.",
}

export default function InventoryPage() {
    return (
        <OpsShell>
            <InventoryPanel />
        </OpsShell>
    )
}
