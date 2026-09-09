"use server"

import { actionResult } from "@/lib/action-result"
import {
    cancelRecyclingSession,
    getActiveRecyclingSession,
    getRecyclingSession,
    startRecyclingSession,
} from "@/lib/api/server"

export async function startRecyclingSessionAction() {
    return actionResult(() => startRecyclingSession())
}

export async function getActiveRecyclingSessionAction() {
    return actionResult(() => getActiveRecyclingSession())
}

export async function getRecyclingSessionAction(id: string) {
    return actionResult(() => getRecyclingSession(id))
}

export async function cancelRecyclingSessionAction(id: string) {
    return actionResult(() => cancelRecyclingSession(id))
}
