import { cn } from "@/lib/utils"

export function PageContainer({
    children,
    className,
    width = "default",
}: {
    children: React.ReactNode
    className?: string
    width?: "default" | "wide" | "narrow"
}) {
    return (
        <div
            className={cn(
                "mx-auto w-full px-4 py-8 sm:px-6",
                width === "narrow" && "max-w-xl",
                width === "default" && "max-w-5xl",
                width === "wide" && "max-w-6xl",
                className
            )}
        >
            {children}
        </div>
    )
}
