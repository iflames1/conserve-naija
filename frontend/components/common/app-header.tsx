"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useSyncExternalStore } from "react"

import { Brand } from "@/components/common/brand"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useAuthActions, useIsSignedIn, useProfile } from "@/stores/auth"

const subscribe = () => () => {}

/**
 * False while server rendering, true once mounted, so authentication-dependent
 * controls cannot cause a hydration mismatch.
 */
function useHydrated() {
    return useSyncExternalStore(
        subscribe,
        () => true,
        () => false
    )
}

export function AppHeader({ active }: { active?: string }) {
    const hydrated = useHydrated()
    const profile = useProfile()
    const { signOut } = useAuthActions()
    const router = useRouter()

    const signedIn = useIsSignedIn()

    function handleSignOut() {
        signOut()
        router.push("/")
    }

    return (
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
            <Brand />
            <nav className="flex items-center gap-1 text-sm text-muted-foreground">
                <Link
                    href="/collection-points"
                    className={cn(
                        "rounded-lg px-3 py-1.5 hover:text-foreground",
                        active === "sites" && "bg-muted text-foreground"
                    )}
                >
                    Sites
                </Link>
                <Link
                    href="/activity"
                    className={cn(
                        "rounded-lg px-3 py-1.5 hover:text-foreground",
                        active === "activity" && "bg-muted text-foreground"
                    )}
                >
                    Activity
                </Link>
                {hydrated && profile?.organisations.length ? (
                    <Link
                        href="/organisation"
                        className={cn(
                            "rounded-lg px-3 py-1.5 hover:text-foreground",
                            active === "organisation" &&
                                "bg-muted text-foreground"
                        )}
                    >
                        Operations
                    </Link>
                ) : null}

                {hydrated && signedIn ? (
                    <button
                        type="button"
                        onClick={handleSignOut}
                        className="ml-1 rounded-lg px-3 py-1.5 hover:text-foreground"
                    >
                        Sign out
                    </button>
                ) : hydrated ? (
                    <>
                        <Link
                            href="/profile"
                            className={cn(
                                buttonVariants({
                                    variant: "ghost",
                                    size: "sm",
                                }),
                                "rounded-lg"
                            )}
                        >
                            Profile
                        </Link>
                        <Link
                            href="/auth/login"
                            className={cn(
                                buttonVariants({ size: "sm" }),
                                "ml-1 rounded-lg"
                            )}
                        >
                            Sign in
                        </Link>
                    </>
                ) : (
                    <span className="ml-1 h-8 w-20 animate-pulse rounded-lg bg-muted" />
                )}
            </nav>
        </header>
    )
}
