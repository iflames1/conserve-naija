import type { Metadata } from "next"

import { OpsShell } from "@/components/organisation/ops-shell"
import { MembersPanel } from "./_components/members-panel"

export const metadata: Metadata = {
    title: "Organisation members",
    description: "Add and manage the people who operate your Conserve Sites.",
}

export default function MembersPage() {
    return (
        <OpsShell>
            <MembersPanel />
        </OpsShell>
    )
}
