import "server-only"

import type {
    AppUser,
    CollectionPoint,
    Deposit,
    Device,
    LedgerEntry,
    Material,
    OrganisationOverview,
    Pickup,
    RecyclingSession,
    RewardsSummary,
} from "@/lib/api/types"
import {
    LOCAL_INTERNAL_API_SECRET,
    apiUrl,
    env,
} from "@/lib/config"

function getApiBaseUrl() {
    return apiUrl()
}

function apiRequest(url: string, init?: RequestInit) {
    return fetch(url, init)
}

async function authHeaders(): Promise<HeadersInit> {
    const { getAccessToken } = await import("@/lib/auth/access-token")
    const token = await getAccessToken()
    return {
        "content-type": "application/json",
        Authorization: `Bearer ${token}`,
    }
}

async function parse<T>(response: Response, fallback: string): Promise<T> {
    if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
            error?: string
            code?: string
        } | null
        throw new Error(body?.error ?? `${fallback} (${response.status})`)
    }
    return (await response.json()) as T
}

export async function upsertUser(payload: {
    id: string
    email: string
    displayName?: string | null
    avatarUrl?: string | null
    emailVerified?: boolean | null
}): Promise<AppUser> {
    const response = await apiRequest(`${getApiBaseUrl()}/users`, {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify(payload),
    })
    return parse(response, "Failed to sync account")
}

export async function getMe(): Promise<AppUser> {
    const response = await apiRequest(`${getApiBaseUrl()}/me`, {
        headers: await authHeaders(),
        cache: "no-store",
    })
    return parse(response, "Failed to load profile")
}

export async function listCollectionPoints(): Promise<CollectionPoint[]> {
    const response = await apiRequest(`${getApiBaseUrl()}/collection-points`, {
        cache: "no-store",
    })
    return parse(response, "Failed to load collection points")
}

export async function getCollectionPoint(id: string): Promise<CollectionPoint> {
    const response = await apiRequest(`${getApiBaseUrl()}/collection-points/${id}`, {
        cache: "no-store",
    })
    return parse(response, "Failed to load collection point")
}

export async function startRecyclingSession(): Promise<RecyclingSession> {
    const response = await apiRequest(`${getApiBaseUrl()}/recycling-sessions`, {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({}),
    })
    return parse(response, "Couldn't start recycling")
}

export async function getActiveRecyclingSession(): Promise<RecyclingSession | null> {
    const response = await apiRequest(`${getApiBaseUrl()}/recycling-sessions/active`, {
        headers: await authHeaders(),
        cache: "no-store",
    })
    const data = await parse<RecyclingSession | null>(
        response,
        "Couldn't load your OTP"
    )
    return data
}

export async function getRecyclingSession(id: string): Promise<RecyclingSession> {
    const response = await apiRequest(`${getApiBaseUrl()}/recycling-sessions/${id}`, {
        headers: await authHeaders(),
        cache: "no-store",
    })
    return parse(response, "Couldn't load this drop")
}

export async function cancelRecyclingSession(id: string): Promise<RecyclingSession> {
    const response = await apiRequest(
        `${getApiBaseUrl()}/recycling-sessions/${id}/cancel`,
        {
            method: "POST",
            headers: await authHeaders(),
        }
    )
    return parse(response, "Couldn't cancel this")
}

export async function getDeposit(id: string): Promise<Deposit> {
    const response = await apiRequest(`${getApiBaseUrl()}/deposits/${id}`, {
        headers: await authHeaders(),
        cache: "no-store",
    })
    return parse(response, "Failed to load deposit")
}

export async function listMyDeposits(): Promise<Deposit[]> {
    const response = await apiRequest(`${getApiBaseUrl()}/me/deposits`, {
        headers: await authHeaders(),
        cache: "no-store",
    })
    return parse(response, "Failed to load deposits")
}

export async function getMyRewards(): Promise<RewardsSummary> {
    const response = await apiRequest(`${getApiBaseUrl()}/me/rewards`, {
        headers: await authHeaders(),
        cache: "no-store",
    })
    return parse(response, "Failed to load rewards")
}

export async function listMyTransactions(): Promise<LedgerEntry[]> {
    const response = await apiRequest(`${getApiBaseUrl()}/me/rewards/transactions`, {
        headers: await authHeaders(),
        cache: "no-store",
    })
    return parse(response, "Failed to load transactions")
}

export async function getOrganisationOverview(): Promise<OrganisationOverview> {
    const response = await apiRequest(`${getApiBaseUrl()}/organisation`, {
        headers: await authHeaders(),
        cache: "no-store",
    })
    return parse(response, "Failed to load organisation")
}

export async function listOrgCollectionPoints(): Promise<CollectionPoint[]> {
    const response = await apiRequest(
        `${getApiBaseUrl()}/organisation/collection-points`,
        { headers: await authHeaders(), cache: "no-store" }
    )
    return parse(response, "Failed to load organisation points")
}

export async function listOrgDevices(): Promise<Device[]> {
    const response = await apiRequest(`${getApiBaseUrl()}/organisation/devices`, {
        headers: await authHeaders(),
        cache: "no-store",
    })
    return parse(response, "Failed to load devices")
}

export async function registerDevice(input: {
    externalId: string
    deviceType?: string
    collectionPointId?: string
}): Promise<{ device: Device; apiKey: string }> {
    const response = await apiRequest(`${getApiBaseUrl()}/organisation/devices`, {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify(input),
    })
    return parse(response, "Failed to register device")
}

export async function associateDevice(input: {
    deviceId: string
    collectionPointId: string
}): Promise<void> {
    const response = await apiRequest(
        `${getApiBaseUrl()}/organisation/devices/associate`,
        {
            method: "POST",
            headers: await authHeaders(),
            body: JSON.stringify(input),
        }
    )
    await parse(response, "Failed to associate device")
}

export async function listOrgInventory() {
    const response = await apiRequest(`${getApiBaseUrl()}/organisation/inventory`, {
        headers: await authHeaders(),
        cache: "no-store",
    })
    return parse<import("@/lib/api/types").InventoryRow[]>(
        response,
        "Failed to load inventory"
    )
}

export async function listOrgPickups(): Promise<Pickup[]> {
    const response = await apiRequest(`${getApiBaseUrl()}/organisation/pickups`, {
        headers: await authHeaders(),
        cache: "no-store",
    })
    return parse(response, "Failed to load pickups")
}

export async function listOrgDeposits(): Promise<Deposit[]> {
    const response = await apiRequest(`${getApiBaseUrl()}/organisation/deposits`, {
        headers: await authHeaders(),
        cache: "no-store",
    })
    return parse(response, "Failed to load organisation activity")
}

export async function createCollectionPoint(input: {
    name: string
    address: string
    description?: string
    latitude?: number
    longitude?: number
    thresholdKg?: number
}): Promise<CollectionPoint> {
    const response = await apiRequest(
        `${getApiBaseUrl()}/organisation/collection-points`,
        {
            method: "POST",
            headers: await authHeaders(),
            body: JSON.stringify(input),
        }
    )
    return parse(response, "Failed to create collection point")
}

export async function deactivateDevice(id: string): Promise<void> {
    const response = await apiRequest(
        `${getApiBaseUrl()}/organisation/devices/${id}/deactivate`,
        {
            method: "POST",
            headers: await authHeaders(),
        }
    )
    await parse(response, "Failed to deactivate machine")
}

export async function listOrgMaterials(): Promise<Material[]> {
    const response = await apiRequest(`${getApiBaseUrl()}/organisation/materials`, {
        headers: await authHeaders(),
        cache: "no-store",
    })
    return parse(response, "Failed to load materials")
}

export async function setMaterialPrice(input: {
    materialId: string
    pricePerKgNaira: number
}): Promise<void> {
    const response = await apiRequest(
        `${getApiBaseUrl()}/organisation/material-prices`,
        {
            method: "POST",
            headers: await authHeaders(),
            body: JSON.stringify(input),
        }
    )
    await parse(response, "Failed to update price")
}

export async function acceptPickup(id: string): Promise<Pickup> {
    const response = await apiRequest(`${getApiBaseUrl()}/pickups/${id}/accept`, {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({}),
    })
    return parse(response, "Failed to accept pickup")
}

export async function completePickup(id: string): Promise<Pickup> {
    const response = await apiRequest(`${getApiBaseUrl()}/pickups/${id}/complete`, {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({}),
    })
    return parse(response, "Failed to complete pickup")
}

export async function addOrgMember(input: {
    organisationId: string
    email: string
}): Promise<void> {
    const response = await apiRequest(`${getApiBaseUrl()}/admin/members`, {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify(input),
    })
    await parse(response, "Failed to add member")
}

export function internalConfigured() {
    return Boolean(env("INTERNAL_API_SECRET", LOCAL_INTERNAL_API_SECRET))
}
