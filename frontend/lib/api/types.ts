export type AppUser = {
    id: string
    email: string
    displayName: string
    avatarUrl?: string | null
    emailVerified: boolean
    createdAt?: string
    greenPointsBalance: number
    conservePointsBalance?: number
    nairaValue: number
    depositCount: number
    recycledKg: number
    roles: string[]
    organisations: OrgMembership[]
}

export type OrgMembership = {
    id: string
    name: string
    slug: string
    memberRole: string
}

export type Material = {
    id: string
    name: string
    slug: string
    unit: string
    active: boolean
    pricePerKgNaira?: number | null
}

export type InventoryRow = {
    collectionPointId: string
    materialId: string
    materialName: string
    materialSlug: string
    weightKg: number
    pickupThresholdKg: number
    readyForPickup: boolean
}

export type CollectionPoint = {
    id: string
    organisationId: string
    organisationName: string
    name: string
    siteName?: string
    collectionPointName?: string
    slug: string
    address: string
    description?: string | null
    latitude?: number | null
    longitude?: number | null
    status: string
    defaultPickupThresholdKg: number
    materials: Material[]
    inventory: InventoryRow[]
}

export type Deposit = {
    id: string
    userId: string
    collectionPointId: string
    collectionPointName: string
    siteName?: string
    organisationId: string
    materialId: string
    materialName: string
    materialSlug: string
    status: string
    weightKg?: number | null
    pricePerKgNaira?: number | null
    greenPoints?: number | null
    conservePoints?: number | null
    estimatedGreenPoints?: number | null
    estimatedConservePoints?: number | null
    fractions?: DepositFraction[]
    createdAt: string
    measuredAt?: string | null
    confirmedAt?: string | null
}

export type DepositFraction = {
    materialId: string
    materialName: string
    materialSlug: string
    weightKg: number
    pricePerKgNaira: number
    greenPoints: number
    conservePoints?: number
}

export type LedgerEntry = {
    id: string
    amount: number
    entryType: string
    referenceType?: string | null
    referenceId?: string | null
    createdAt: string
}

export type DeviceBin = {
    materialId: string
    materialSlug: string
    materialName: string
    weightKg: number
    fillPercent?: number | null
    updatedAt: string
}

export type Device = {
    id: string
    organisationId: string
    collectionPointId?: string | null
    collectionPointName?: string | null
    siteName?: string | null
    externalId: string
    deviceType: string
    status: string
    health: string
    firmwareVersion?: string | null
    latitude?: number | null
    longitude?: number | null
    lastSeenAt?: string | null
    bins: DeviceBin[]
}

export type Pickup = {
    id: string
    organisationId: string
    collectionPointId: string
    collectionPointName: string
    siteName?: string
    materialId: string
    materialName: string
    materialSlug: string
    status: string
    thresholdKg: number
    inventoryKgAtReady: number
    collectedKg?: number | null
    acceptedBy?: string | null
    acceptedAt?: string | null
    completedAt?: string | null
    createdAt: string
}

export type OrganisationOverview = {
    organisationId: string
    name: string
    collectionPoints: number
    sites?: number
    devicesOnline: number
    devicesTotal: number
    materialCollectedKg: number
    readyForPickup: number
}

export type RewardsSummary = {
    greenPointsBalance: number
    conservePointsBalance?: number
    nairaValue: number
    conversion: string
}

export type RecyclingSession = {
    id: string
    code: string
    status:
        | "waiting_for_machine"
        | "connected"
        | "sorting"
        | "measuring"
        | "processing"
        | "completed"
        | "expired"
        | "cancelled"
        | "failed"
    deviceExternalId?: string | null
    collectionPointName?: string | null
    siteName?: string | null
    materialName?: string | null
    materialSlug?: string | null
    depositId?: string | null
    failureReason?: string | null
    expiresAt: string
    connectedAt?: string | null
    completedAt?: string | null
    createdAt: string
    weightKg?: number | null
    greenPoints?: number | null
    conservePoints?: number | null
    fractions?: DepositFraction[]
}

export type SessionStatus = RecyclingSession["status"]
