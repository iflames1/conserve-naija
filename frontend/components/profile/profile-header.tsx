import { RiCalendarLine } from "@remixicon/react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui"
import type { AppUser } from "@/lib/api/types"
import { cn, cpBalance, formatDate, formatNaira, formatPoints } from "@/lib/utils"

export function ProfileHeader({ user }: { user: AppUser }) {
    return (
        <header className="relative isolate overflow-hidden rounded-2xl border border-border/70 surface-raised">
            <div aria-hidden className="absolute inset-0 -z-10 bg-grid" />
            <div
                aria-hidden
                className="absolute inset-0 -z-10 bg-linear-to-r from-primary/18 via-transparent to-warning/8"
            />
            <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-6 p-5 sm:p-6">
                <div className="flex min-w-0 items-center gap-4">
                    <Avatar size="xl" className="shrink-0">
                        {user.avatarUrl ? (
                            <AvatarImage src={user.avatarUrl} alt="" />
                        ) : null}
                        <AvatarFallback seed={user.displayName} />
                    </Avatar>
                    <div className="min-w-0">
                        <h1 className="truncate font-display text-3xl sm:text-4xl">
                            {user.displayName}
                        </h1>
                        <p className="truncate text-sm text-muted-foreground">
                            {user.email}
                        </p>
                        {user.createdAt ? (
                            <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                                <RiCalendarLine className="size-3.5" />
                                Joined {formatDate(user.createdAt)}
                            </p>
                        ) : null}
                    </div>
                </div>

                <dl className="flex flex-wrap items-end gap-x-8 gap-y-4">
                    <Headline
                        label="Conserve Points"
                        value={`${formatPoints(cpBalance(user))} CP`}
                        accent="text-primary"
                    />
                    <Headline label="Value" value={formatNaira(user.nairaValue)} />
                </dl>
            </div>
        </header>
    )
}

function Headline({
    label,
    value,
    accent,
}: {
    label: string
    value: string
    accent?: string
}) {
    return (
        <div className="space-y-1">
            <dt className="text-[11px] font-medium tracking-[0.16em] text-muted-foreground uppercase">
                {label}
            </dt>
            <dd className={cn("tnum font-display text-2xl leading-none", accent)}>
                {value}
            </dd>
        </div>
    )
}
