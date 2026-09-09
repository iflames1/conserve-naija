"use server"

import { actionResult } from "@/lib/action-result"
import {
    getDeposit,
    getMyRewards,
    listMyDeposits,
    listMyTransactions,
} from "@/lib/api/server"

export async function getDepositAction(id: string) {
    return actionResult(() => getDeposit(id))
}

export async function listMyDepositsAction() {
    return actionResult(() => listMyDeposits())
}

export async function getMyRewardsAction() {
    return actionResult(() => getMyRewards())
}

export async function listMyTransactionsAction() {
    return actionResult(() => listMyTransactions())
}
