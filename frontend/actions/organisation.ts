"use server"

import { actionResult } from "@/lib/action-result"
import {
    acceptPickup,
    addOrgMember,
    associateDevice,
    completePickup,
    createCollectionPoint,
    deactivateDevice,
    getOrganisationOverview,
    listOrgCollectionPoints,
    listOrgDeposits,
    listOrgDevices,
    listOrgInventory,
    listOrgMaterials,
    listOrgPickups,
    registerDevice,
    setMaterialPrice,
} from "@/lib/api/server"

export async function getOrganisationOverviewAction() {
    return actionResult(() => getOrganisationOverview())
}

export async function listOrgCollectionPointsAction() {
    return actionResult(() => listOrgCollectionPoints())
}

export async function listOrgDevicesAction() {
    return actionResult(() => listOrgDevices())
}

export async function registerDeviceAction(input: {
    externalId: string
    deviceType?: string
    collectionPointId?: string
}) {
    return actionResult(() => registerDevice(input))
}

export async function associateDeviceAction(input: {
    deviceId: string
    collectionPointId: string
}) {
    return actionResult(() => associateDevice(input))
}

export async function deactivateDeviceAction(id: string) {
    return actionResult(() => deactivateDevice(id))
}

export async function createCollectionPointAction(input: {
    name: string
    address: string
    description?: string
    latitude?: number
    longitude?: number
    thresholdKg?: number
}) {
    return actionResult(() => createCollectionPoint(input))
}

export async function listOrgInventoryAction() {
    return actionResult(() => listOrgInventory())
}

export async function listOrgPickupsAction() {
    return actionResult(() => listOrgPickups())
}

export async function listOrgDepositsAction() {
    return actionResult(() => listOrgDeposits())
}

export async function listOrgMaterialsAction() {
    return actionResult(() => listOrgMaterials())
}

export async function setMaterialPriceAction(input: {
    materialId: string
    pricePerKgNaira: number
}) {
    return actionResult(() => setMaterialPrice(input))
}

export async function acceptPickupAction(id: string) {
    return actionResult(() => acceptPickup(id))
}

export async function completePickupAction(id: string) {
    return actionResult(() => completePickup(id))
}

export async function addOrgMemberAction(input: {
    organisationId: string
    email: string
}) {
    return actionResult(() => addOrgMember(input))
}
