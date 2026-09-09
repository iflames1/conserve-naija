"use server"

import { actionResult } from "@/lib/action-result"
import { getCollectionPoint, listCollectionPoints } from "@/lib/api/server"

export async function listCollectionPointsAction() {
    return actionResult(() => listCollectionPoints())
}

export async function getCollectionPointAction(id: string) {
    return actionResult(() => getCollectionPoint(id))
}
