"use client"

import { useRouter } from "next/navigation"
import {
    RiBuildingLine,
    RiLogoutBoxRLine,
    RiUser3Line,
} from "@remixicon/react"

import {
    Avatar,
    AvatarFallback,
    AvatarImage,
    ButtonLink,
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
    Skeleton,
} from "@/components/ui"
import { authClient } from "@/lib/auth/client"
import { useSessionActions, useSessionLoading, useSessionUser } from "@/stores/session"

export function UserMenu() {
    const router = useRouter()
    const user = useSessionUser()
    const loading = useSessionLoading()
    const { setUser } = useSessionActions()

    if (loading && !user) {
        return <Skeleton className="size-8 rounded-full" />
    }

    if (!user) {
        return (
            <div className="flex items-center gap-2">
                <ButtonLink href="/auth/login" variant="ghost" size="sm">
                    Sign in
                </ButtonLink>
                <ButtonLink href="/auth/sign-up" variant="primary" size="sm">
                    Join
                </ButtonLink>
            </div>
        )
    }

    async function signOut() {
        await authClient.signOut()
        setUser(null)
        router.push("/")
        router.refresh()
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger
                render={
                    <button
                        type="button"
                        aria-label="Account"
                        className="rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                    />
                }
            >
                <Avatar size="sm">
                    {user.avatarUrl ? (
                        <AvatarImage src={user.avatarUrl} alt="" />
                    ) : null}
                    <AvatarFallback seed={user.displayName} />
                </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
                <DropdownMenuItem onClick={() => router.push("/profile")}>
                    <RiUser3Line />
                    Profile
                </DropdownMenuItem>
                {user.organisations?.length ? (
                    <DropdownMenuItem onClick={() => router.push("/organisation")}>
                        <RiBuildingLine />
                        Organisation
                    </DropdownMenuItem>
                ) : null}
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onClick={signOut}>
                    <RiLogoutBoxRLine />
                    Sign out
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
