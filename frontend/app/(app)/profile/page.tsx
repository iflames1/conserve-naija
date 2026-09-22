import type { Metadata } from "next"

import { ProfilePanel } from "./_components/profile-panel"

export const metadata: Metadata = {
    title: "Profile",
    description:
        "Your Conserve Naija account, Conserve Points, and organisation access.",
}

export default function ProfilePage() {
    return <ProfilePanel />
}
