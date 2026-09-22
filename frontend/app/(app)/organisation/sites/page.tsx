import type { Metadata } from "next"

import { OpsShell } from "@/components/organisation/ops-shell"
import { SitesPanel } from "./_components/sites-panel"

export const metadata: Metadata = {
    title: "Conserve Sites",
    description:
        "Locations, equipment, and accepted recyclable materials across your network.",
}

export default function SitesPage() {
    return (
        <OpsShell>
            <SitesPanel />
        </OpsShell>
    )
}
