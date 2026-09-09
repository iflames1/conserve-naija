import { cn } from "@/lib/utils"

export function SectionHeader({
    title,
    description,
    action,
    className,
}: {
    title: React.ReactNode
    description?: React.ReactNode
    action?: React.ReactNode
    className?: string
}) {
    return (
        <div
            className={cn(
                "flex flex-wrap items-end justify-between gap-3",
                className
            )}
        >
            <div className="space-y-1">
                <h2 className="font-display text-xl sm:text-2xl">{title}</h2>
                {description ? (
                    <p className="text-sm text-muted-foreground">{description}</p>
                ) : null}
            </div>
            {action}
        </div>
    )
}
