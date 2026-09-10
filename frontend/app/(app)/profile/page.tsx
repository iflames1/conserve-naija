"use client"

import Link from "next/link"
import { RiLogoutBoxRLine } from "@remixicon/react"

import { PageContainer } from "@/components/common/page-container"
import { ProfilePageSkeleton } from "@/components/common/page-skeleton"
import { SectionHeader } from "@/components/common/section"
import { ActivityHistory } from "@/components/profile/activity-history"
import { ProfileHeader } from "@/components/profile/profile-header"
import { ProfileStats } from "@/components/profile/profile-stats"
import { Button, ButtonLink, EmptyState } from "@/components/ui"
import { authClient } from "@/lib/auth/client"
import { useActivityDeposits, useActivityLoading } from "@/stores/activity"
import { useSessionActions, useSessionLoading, useSessionUser } from "@/stores/session"

export default function ProfilePage() {
    const user = useSessionUser()
    const loading = useSessionLoading()
    const { setUser } = useSessionActions()

    const deposits = useActivityDeposits()
    const depositsLoading = useActivityLoading()

    if (!user) {
        if (loading) {
            return (
                <PageContainer width="wide">
                    <ProfilePageSkeleton />
                </PageContainer>
            )
        }
        return (
            <PageContainer>
                <EmptyState
                    title="Sign in to see your profile"
                    action={
                        <ButtonLink href="/auth/login" variant="primary">
                            Sign in
                        </ButtonLink>
                    }
                />
            </PageContainer>
        )
    }

    const org = user.organisations?.[0]
    const dropCount = user.depositCount ?? deposits.length

    return (
        <PageContainer width="wide" className="space-y-8">
            <ProfileHeader user={user} />
            <ProfileStats user={user} />

            <section id="activity" className="space-y-4">
                <SectionHeader
                    title="Activity"
                    description={
                        dropCount
                            ? `${dropCount} completed drop${dropCount === 1 ? "" : "s"}`
                            : "Drops that made it onto a machine"
                    }
                />
                <ActivityHistory
                    deposits={deposits}
                    loading={depositsLoading && deposits.length === 0}
                />
            </section>

            <section className="flex flex-wrap items-center justify-end gap-3 border-t border-border/60 pt-6">
                {org ? (
                    <p className="mr-auto text-sm text-muted-foreground">
                        You run{" "}
                        <Link
                            href="/organisation"
                            className="text-foreground underline-offset-4 hover:underline"
                        >
                            {org.name}
                        </Link>
                        .
                    </p>
                ) : null}
                <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground"
                    onClick={async () => {
                        await authClient.signOut()
                        setUser(null)
                    }}
                >
                    <RiLogoutBoxRLine />
                    Sign out
                </Button>
            </section>
        </PageContainer>
    )
}
