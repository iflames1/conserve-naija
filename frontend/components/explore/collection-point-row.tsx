import { Badge, buttonVariants } from "@/components/ui"
import type { CollectionPoint } from "@/lib/api/types"
import {
    cn,
    formatNaira,
    machineIsOpen,
    machineLocateHref,
    machineStatusLabel,
} from "@/lib/utils"

export function CollectionPointRow({
    point,
}: {
    point: CollectionPoint
}) {
    const open = machineIsOpen(point.status)
    const locateHref = machineLocateHref(point)
    const locateLabel =
        point.slug === "yaba" ? "Open the Yaba machine" : "Show on the map"
    const prices =
        point.materials
            .map((material) =>
                material.pricePerKgNaira != null
                    ? `${material.name} ${formatNaira(material.pricePerKgNaira)}/kg`
                    : material.name
            )
            .join(" · ") || "Prices on the machine"

    return (
        <li className="px-4 py-4 sm:px-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                    <h2 className="font-display text-lg">{point.name}</h2>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                        {point.address}
                    </p>
                </div>
                <Badge variant={open ? "success" : "outline"}>
                    {machineStatusLabel(point.status)}
                </Badge>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">{prices}</p>
                {locateHref ? (
                    <a
                        href={locateHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={locateLabel}
                        className={cn(
                            buttonVariants({ variant: "outline", size: "sm" })
                        )}
                    >
                        Locate
                    </a>
                ) : null}
            </div>
        </li>
    )
}
