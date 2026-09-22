import type { Metadata } from "next"

import { PointsPanel } from "./_components/points-panel"

export const metadata: Metadata = {
    title: "Conserve Points",
    description:
        "Your Conserve Points balance, valued at ₦1 each, earned from machine-measured deposits.",
}

export default function PointsPage() {
    return <PointsPanel />
}
