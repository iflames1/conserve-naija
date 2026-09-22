import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
    return (
        <main className="mx-auto min-h-svh max-w-7xl px-5 py-10 sm:px-8 lg:px-12">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="mt-10 h-12 w-72" />
            <div className="mt-8 grid gap-4 md:grid-cols-3">
                <Skeleton className="h-32" />
                <Skeleton className="h-32" />
                <Skeleton className="h-32" />
            </div>
        </main>
    )
}
