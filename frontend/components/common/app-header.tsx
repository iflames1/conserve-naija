"use client"

import Link from "next/link"
import { useEffect, useState, useSyncExternalStore } from "react"
import { Menu } from "lucide-react"

import { Brand } from "@/components/common/brand"
import { buttonVariants } from "@/components/ui/button"
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet"
import { apiFetch } from "@/lib/api"
import { cn } from "@/lib/utils"
import {
    useAuthActions,
    useAuthToken,
    useIsSignedIn,
    useProfile,
    type Profile,
} from "@/stores/auth"

const NAV_ITEMS = [
    { key: "sites", label: "Conserve Sites", href: "/collection-points" },
    { key: "activity", label: "Activity", href: "/activity" },
] as const

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
    const { setProfile } = useAuthActions()
    const token = useAuthToken()
    const [menuOpen, setMenuOpen] = useState(false)

    const signedIn = useIsSignedIn()

    // Roles live on the server, so a persisted profile goes stale: an account
    // granted admin, or added to an organisation, after signing in would
    // otherwise never see it.
    useEffect(() => {
        if (!token) return
        let active = true
        apiFetch<Profile>("/api/v1/auth/me", { token })
            .then((fresh) => {
                if (active) setProfile(fresh)
            })
            .catch(() => undefined)
        return () => {
            active = false
        }
    }, [token, setProfile])

    // A configured platform admin can always reach operations, even before
    // organisation membership has synced.
    const canOperate =
        Boolean(profile?.is_admin) || Boolean(profile?.organisations.length)

    const items = [
        ...NAV_ITEMS,
        ...(canOperate
            ? [
                  {
                      key: "organisation",
                      label: "Operations",
                      href: "/organisation",
                  },
              ]
            : []),
    ]

    return (
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
            <Brand />
            <nav className="hidden items-center gap-1 text-sm text-muted-foreground sm:flex">
                {items.map((item) => (
                    <Link
                        key={item.key}
                        href={item.href}
                        className={cn(
                            "rounded-lg px-3 py-1.5 hover:text-foreground",
                            active === item.key && "bg-muted text-foreground"
                        )}
                    >
                        {item.label}
                    </Link>
                ))}

                {hydrated && signedIn ? (
                    <Link
                        href="/profile"
                        className={cn(
                            "rounded-lg px-3 py-1.5 hover:text-foreground",
                            active === "profile" && "bg-muted text-foreground"
                        )}
                    >
                        {/* Sign out lives on the profile page. */}
                        Profile
                    </Link>
                ) : hydrated ? (
                    <>
                        <Link
                            href="/auth/login"
                            className={cn(
                                buttonVariants({ size: "sm" }),
                                "ml-1 rounded-lg"
                            )}
                        >
                            Sign in
                        </Link>
                        <Link
                            href="/auth/sign-up"
                            className={cn(
                                buttonVariants({
                                    variant: "ghost",
                                    size: "sm",
                                }),
                                "rounded-lg"
                            )}
                        >
                            Create account
                        </Link>
                    </>
                ) : (
                    <span className="ml-1 h-8 w-20 animate-pulse rounded-lg bg-muted" />
                )}
            </nav>

            {/* Small screens get a sheet so the nav never crowds the header. */}
            <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
                <SheetTrigger
                    aria-label="Open menu"
                    className={cn(
                        buttonVariants({ variant: "ghost", size: "icon-sm" }),
                        "rounded-lg sm:hidden"
                    )}
                >
                    <Menu className="size-5" />
                </SheetTrigger>
                <SheetContent side="right" className="w-72 sm:max-w-xs">
                    <SheetHeader>
                        <SheetTitle>Menu</SheetTitle>
                    </SheetHeader>
                    {/* Plain links, not close-triggers, so they keep real link
                        semantics for screen readers and open-in-new-tab. */}
                    <nav className="flex flex-col gap-1 px-3">
                        {items.map((item) => (
                            <Link
                                key={item.key}
                                href={item.href}
                                onClick={() => setMenuOpen(false)}
                                className={cn(
                                    "rounded-lg px-3 py-2.5 text-sm hover:bg-muted",
                                    active === item.key && "bg-muted"
                                )}
                            >
                                {item.label}
                            </Link>
                        ))}
                    </nav>
                    <div className="mt-auto flex flex-col gap-2 border-t border-border p-4">
                        {hydrated && signedIn ? (
                            <Link
                                href="/profile"
                                onClick={() => setMenuOpen(false)}
                                className={cn(
                                    buttonVariants({ variant: "outline" }),
                                    "w-full rounded-xl"
                                )}
                            >
                                Profile
                            </Link>
                        ) : hydrated ? (
                            <>
                                <Link
                                    href="/auth/login"
                                    onClick={() => setMenuOpen(false)}
                                    className={cn(
                                        buttonVariants(),
                                        "w-full rounded-xl"
                                    )}
                                >
                                    Sign in
                                </Link>
                                <Link
                                    href="/auth/sign-up"
                                    onClick={() => setMenuOpen(false)}
                                    className={cn(
                                        buttonVariants({ variant: "outline" }),
                                        "w-full rounded-xl"
                                    )}
                                >
                                    Create account
                                </Link>
                            </>
                        ) : null}
                    </div>
                </SheetContent>
            </Sheet>
        </header>
    )
}
