import type { Metadata } from "next"

import { MissionPanel } from "@/components/home/mission-panel"

export const metadata: Metadata = {
    title: "Your recycling mission",
    description: "Connect your Conserve OTP to a machine at a Conserve Site.",
}

export default function DepositPage() {
    return <MissionPanel />
}
