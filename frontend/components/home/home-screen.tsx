"use client"

import {
    GuestLandingSkeleton,
    HomeScreenSkeleton,
} from "@/components/common/page-skeleton"
import { PageContainer } from "@/components/common/page-container"
import { CitizenHome } from "@/components/home/citizen-home"
import { GuestLanding } from "@/components/home/guest-landing"
import { Button, EmptyState } from "@/components/ui"
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

    if (loading) {
        return (
            <PageContainer width="wide">
                <HomeScreenSkeleton />
            </PageContainer>
        )
    }

    if (!user) {
        return (
            <PageContainer width="wide">
                <EmptyState
                    title="Your account is almost ready"
                    description="Give it another go. We'll pick up where you left off."
                    action={
                        <Button
                            variant="primary"
                            onClick={() => window.location.reload()}
                        >
                            Try again
                        </Button>
                    }
                />
            </PageContainer>
        )
    }

    return (
        <PageContainer width="wide">
            <CitizenHome />
        </PageContainer>
    )
}
