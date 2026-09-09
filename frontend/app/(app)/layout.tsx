import { AppHeader, CitizenDock } from "@/components/shell/app-header"
import { Brand } from "@/components/shell/brand"

export default function AppLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex min-h-svh flex-col">
            <AppHeader brand={<Brand />} />
            <main className="flex-1 pb-20 md:pb-0">{children}</main>
            <CitizenDock />
        </div>
    )
}
