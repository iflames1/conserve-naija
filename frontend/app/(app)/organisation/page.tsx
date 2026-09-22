import type { Metadata } from "next"

import { OpsShell } from "@/components/organisation/ops-shell"
import { OverviewPanel } from "./_components/overview-panel"

export const metadata: Metadata = {
    title: "Organisation overview",
    description:
        "Monitor Conserve Sites, machines, inventory and collections across your network.",
}

export default function OrganisationPage() {
    return (
        <OpsShell>
            <OverviewPanel />
        </OpsShell>
    )
}
