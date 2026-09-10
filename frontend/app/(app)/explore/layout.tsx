import type { ReactNode } from "react"
import type { Metadata } from "next"

import { pageMeta } from "@/lib/seo"

export const metadata: Metadata = pageMeta(
    "Conserve Sites",
    "Yaba is open. Walk up to the Conserve Site, get a Conserve OTP, and turn in mixed waste.",
    "/explore"
)

export default function ExploreLayout({ children }: { children: ReactNode }) {
    return children
}
