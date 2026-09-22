import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
    return (
        <main className="mx-auto flex min-h-svh w-full max-w-6xl flex-col gap-8 px-5 py-10 sm:px-8 lg:px-12">
            <div className="flex items-center justify-between">
                <Skeleton className="h-8 w-40" />
                <Skeleton className="h-8 w-28 rounded-full" />
            </div>
            <div className="space-y-4">
                <Skeleton className="h-12 w-full max-w-xl" />
                <Skeleton className="h-12 w-full max-w-md" />
            </div>
            <div className="grid gap-4 md:grid-cols-3">
                <Skeleton className="h-32 rounded-2xl" />
                <Skeleton className="h-32 rounded-2xl" />
                <Skeleton className="h-32 rounded-2xl" />
            </div>
        </main>
    )
}
