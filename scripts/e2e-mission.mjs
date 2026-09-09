/**
 * Protocol-level mission demo against a running API.
 * Requires CN_TEST_AUTH=1 on the backend (enabled automatically in cargo tests).
 *
 * Usage (with API already running and test auth on):
 *   API_URL=http://127.0.0.1:8080 node scripts/e2e-mission.mjs
 */
const api = process.env.API_URL ?? "http://127.0.0.1:8080"
const deviceKey = process.env.DEVICE_API_KEY ?? "cn-dev-lekki-device-key"
const user = crypto.randomUUID()

async function json(res) {
    const text = await res.text()
    try {
        return JSON.parse(text)
    } catch {
        return { raw: text }
    }
}

async function asUser(path, init = {}) {
    const res = await fetch(`${api}${path}`, {
        ...init,
        headers: {
            "content-type": "application/json",
            Authorization: `Test ${user}`,
            ...(init.headers ?? {}),
        },
    })
    const body = await json(res)
    if (!res.ok) {
        throw new Error(`${path} ${res.status} ${JSON.stringify(body)}`)
    }
    return body
}

async function asDevice(path, body) {
    const res = await fetch(`${api}${path}`, {
        method: "POST",
        headers: {
            "content-type": "application/json",
            Authorization: `Device ${deviceKey}`,
        },
        body: JSON.stringify(body),
    })
    const payload = await json(res)
    if (!res.ok) {
        throw new Error(`${path} ${res.status} ${JSON.stringify(payload)}`)
    }
    return payload
}

await asUser("/users", {
    method: "POST",
    body: JSON.stringify({
        id: user,
        email: `mission-${user}@conserve.test`,
        displayName: "Mission Runner",
        emailVerified: true,
    }),
})

const started = await asUser("/recycling-sessions", {
    method: "POST",
    body: JSON.stringify({}),
})
if (started.status !== "waiting_for_machine") {
    throw new Error(`expected waiting_for_machine, got ${started.status}`)
}

const claimed = await asDevice("/iot/devices/me/sessions/claim", {
    code: started.code,
})
if (claimed.status !== "connected") {
    throw new Error(`expected connected, got ${claimed.status}`)
}

const measured = await asDevice(
    `/iot/devices/me/sessions/${started.id}/measurement`,
    { material: "plastic", weightKg: 2.5 }
)
if (measured.status !== "completed" || measured.greenPoints !== 250) {
    throw new Error(`unexpected measurement ${JSON.stringify(measured)}`)
}

const me = await asUser("/me")
if (me.greenPointsBalance < 250) {
    throw new Error(`balance ${me.greenPointsBalance}`)
}

console.log("mission e2e ok", {
    code: started.code,
    greenPoints: measured.greenPoints,
    balance: me.greenPointsBalance,
})
