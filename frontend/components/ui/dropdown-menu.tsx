"use client"

import { Menu as MenuPrimitive } from "@base-ui/react/menu"

import { cn } from "@/lib/utils"

function DropdownMenu(props: MenuPrimitive.Root.Props) {
    return <MenuPrimitive.Root data-slot="dropdown-menu" {...props} />
}

function DropdownMenuTrigger({
    ...props
}: Omit<MenuPrimitive.Trigger.Props, "className"> & {
    className?: string
}) {
    return (
        <MenuPrimitive.Trigger data-slot="dropdown-menu-trigger" {...props} />
    )
}

function DropdownMenuContent({
    className,
    side = "bottom",
    align = "end",
    sideOffset = 8,
    ...props
}: Omit<MenuPrimitive.Popup.Props, "className"> & {
    className?: string
    side?: MenuPrimitive.Positioner.Props["side"]
    align?: MenuPrimitive.Positioner.Props["align"]
    sideOffset?: MenuPrimitive.Positioner.Props["sideOffset"]
}) {
    return (
        <MenuPrimitive.Portal data-slot="dropdown-menu-portal">
            <MenuPrimitive.Positioner
                data-slot="dropdown-menu-positioner"
                className="z-50 outline-none"
                side={side}
                align={align}
                sideOffset={sideOffset}
            >
                <MenuPrimitive.Popup
                    data-slot="dropdown-menu-content"
                    className={cn(
                        "min-w-44 origin-(--transform-origin) overflow-hidden rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-xl shadow-black/40 duration-150 outline-none data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95",
                        className
                    )}
                    {...props}
                />
            </MenuPrimitive.Positioner>
        </MenuPrimitive.Portal>
    )
}

function DropdownMenuItem({
    className,
    variant = "default",
    ...props
}: Omit<MenuPrimitive.Item.Props, "className"> & {
    className?: string
    variant?: "default" | "destructive"
}) {
    return (
        <MenuPrimitive.Item
            data-slot="dropdown-menu-item"
            data-variant={variant}
            className={cn(
                "relative flex cursor-default items-center gap-2 rounded-lg px-2.5 py-2 text-sm outline-none select-none data-disabled:pointer-events-none data-disabled:opacity-50 data-highlighted:bg-accent data-highlighted:text-accent-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
                variant === "destructive" &&
                    "text-destructive data-highlighted:bg-destructive/15 data-highlighted:text-destructive",
                className
            )}
            {...props}
        />
    )
}

function DropdownMenuSeparator({
    className,
    ...props
}: Omit<MenuPrimitive.Separator.Props, "className"> & {
    className?: string
}) {
    return (
        <MenuPrimitive.Separator
            data-slot="dropdown-menu-separator"
            className={cn("-mx-1 my-1 h-px bg-border", className)}
            {...props}
        />
    )
}

export {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
}
