import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

export function formatKg(value: number | null | undefined): string {
    if (value == null || Number.isNaN(value)) return "—"
    return `${value.toLocaleString("en-NG", {
        maximumFractionDigits: 2,
    })} kg`
}

export function depositFractions(deposit: {
    fractions?: { materialName: string; weightKg: number }[] | null
    materialName?: string | null
    weightKg?: number | null
}): { materialName: string; weightKg: number }[] {
    const lines = (deposit.fractions ?? []).filter((line) => line.weightKg > 0)
    if (lines.length) return lines
    return [
        {
            materialName: deposit.materialName || "recyclables",
            weightKg: deposit.weightKg ?? 0,
        },
    ]
}

export function formatDepositMaterials(deposit: {
    fractions?: { materialName: string; weightKg: number }[] | null
    materialName?: string | null
    weightKg?: number | null
}): string {
    return depositFractions(deposit)
        .map((line) => `${formatKg(line.weightKg)} ${line.materialName}`)
        .join(" · ")
}

export function formatPoints(value: number | null | undefined): string {
    if (value == null || Number.isNaN(value)) return "0"
    return value.toLocaleString("en-NG")
}

export function cpBalance(user: {
    conservePointsBalance?: number | null
    greenPointsBalance: number
}): number {
    return user.conservePointsBalance ?? user.greenPointsBalance
}

export function cpAmount(row: {
    conservePoints?: number | null
    greenPoints?: number | null
}): number {
    return row.conservePoints ?? row.greenPoints ?? 0
}

export function siteLabel(row: {
    siteName?: string | null
    collectionPointName?: string | null
    name?: string | null
}): string {
    return (row.siteName || row.collectionPointName || row.name || "").trim()
}

export function formatNaira(value: number | null | undefined): string {
    if (value == null || Number.isNaN(value)) return "₦0"
    return `₦${value.toLocaleString("en-NG")}`
}

export function formatSessionCode(code: string): string {
    const digits = code.replace(/\D/g, "").padStart(6, "0").slice(0, 6)
    return `${digits.slice(0, 3)} ${digits.slice(3)}`
}

export function greetingForNow(date = new Date()): string {
    const hour = date.getHours()
    if (hour < 12) return "Good morning"
    if (hour < 17) return "Good afternoon"
    return "Good evening"
}

export function formatRelativeTime(value: string | Date): string {
    const then = typeof value === "string" ? new Date(value) : value
    const seconds = Math.round((Date.now() - then.getTime()) / 1000)
    if (Number.isNaN(seconds)) return ""
    if (seconds < 10) return "just now"
    if (seconds < 60) return `${seconds}s ago`
    const minutes = Math.round(seconds / 60)
    if (minutes < 60) return `${minutes} min ago`
    const hours = Math.round(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    return then.toLocaleDateString("en-NG", {
        day: "numeric",
        month: "short",
    })
}

export function firstName(displayName: string | null | undefined): string {
    const name = displayName?.trim()
    if (!name) return "there"
    return name.split(/\s+/)[0] ?? name
}

export function formatDate(value: string | Date): string {
    const date = typeof value === "string" ? new Date(value) : value
    if (Number.isNaN(date.getTime())) return ""
    return date.toLocaleDateString("en-NG", {
        month: "short",
        year: "numeric",
    })
}

export function machineIsOpen(status: string): boolean {
    return status === "active"
}

export function machineStatusLabel(status: string): string {
    if (status === "active") return "Open"
    if (status === "maintenance") return "Off for now"
    return "Closed"
}

export function demoMachine<T extends { slug: string }>(points: T[]): T | undefined {
    return points.find((point) => point.slug === "yaba") ?? points[0]
}

export const PUBLIC_MACHINE_SIM_URL =
    "https://wokwi.com/experimental/viewer?diagram=https://raw.githubusercontent.com/iflames1/conserve-naija-wokwi/main/diagram.json&firmware=https://raw.githubusercontent.com/iflames1/conserve-naija-wokwi/main/firmware.bin"

export function machineLocateHref(point: {
    slug: string
    address?: string | null
    latitude?: number | null
    longitude?: number | null
}): string | null {
    if (point.slug === "yaba") return PUBLIC_MACHINE_SIM_URL
    if (point.latitude != null && point.longitude != null) {
        return `https://www.google.com/maps/search/?api=1&query=${point.latitude},${point.longitude}`
    }
    const address = point.address?.trim()
    if (address) {
        return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
    }
    return null
}
