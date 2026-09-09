"use server"

import { actionResult } from "@/lib/action-result"
import { getMe, upsertUser } from "@/lib/api/server"
import type { AppUser } from "@/lib/api/types"

export async function syncAuthUser(input: {
    id: string
    email: string
    name?: string | null
    image?: string | null
    emailVerified?: boolean | null
}): Promise<AppUser> {
    return upsertUser({
        id: input.id,
        email: input.email,
        displayName: input.name,
        avatarUrl: input.image,
        emailVerified: input.emailVerified,
    })
}

export async function getMeAction() {
    return actionResult(() => getMe())
}
