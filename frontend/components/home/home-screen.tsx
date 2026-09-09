"use client"

import {
    GuestLandingSkeleton,
    HomeScreenSkeleton,
} from "@/components/common/page-skeleton"
import { PageContainer } from "@/components/common/page-container"
import { CitizenHome } from "@/components/home/citizen-home"
import { GuestLanding } from "@/components/home/guest-landing"
import { authClient } from "@/lib/auth/client"
import { useSessionLoading, useSessionUser } from "@/stores/session"

export function HomeScreen() {
    const user = useSessionUser()
    const loading = useSessionLoading()
    const { data: session, isPending } = authClient.useSession()

    if (isPending) {
        return (
            <PageContainer width="wide">
                {user ? <HomeScreenSkeleton /> : <GuestLandingSkeleton />}
            </PageContainer>
        )
    }

    if (!session) {
        return (
            <PageContainer width="wide">
                <GuestLanding />
            </PageContainer>
        )
    }

    if (loading || !user) {
        return (
            <PageContainer width="wide">
                <HomeScreenSkeleton />
            </PageContainer>
        )
    }

    return (
        <PageContainer width="wide">
            <CitizenHome />
        </PageContainer>
    )
}
