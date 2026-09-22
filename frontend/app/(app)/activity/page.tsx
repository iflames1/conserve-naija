import type { Metadata } from "next"

import { ActivityPanel } from "./_components/activity-panel"

export const metadata: Metadata = {
    title: "Activity",
    description:
        "Your recycling deposits, the weight you returned, and your Conserve Points balance.",
}

export default function ActivityPage() {
    return <ActivityPanel />
}
