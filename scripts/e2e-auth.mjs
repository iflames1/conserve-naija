const app = process.env.APP_URL ?? "http://localhost:3000"
const email = `e2e-${Date.now()}@conserve.test`
const password = "circulate-8"
const name = "E2E Citizen"

async function json(res) {
    const text = await res.text()
    try {
        return JSON.parse(text)
    } catch {
        return { raw: text }
    }
}

const headers = {
    "content-type": "application/json",
    origin: app,
}

const signUp = await fetch(`${app}/api/auth/sign-up/email`, {
    method: "POST",
    headers,
    body: JSON.stringify({ email, password, name }),
})
if (!signUp.ok) {
    console.error("signup failed", signUp.status, await json(signUp))
    process.exit(1)
}

const signIn = await fetch(`${app}/api/auth/sign-in/email`, {
    method: "POST",
    headers,
    body: JSON.stringify({ email, password }),
})
if (!signIn.ok) {
    console.error("signin failed", signIn.status, await json(signIn))
    process.exit(1)
}

const cookies = signIn.headers.getSetCookie?.() ?? []
const session = await fetch(`${app}/api/auth/get-session`, {
    headers: { cookie: cookies.map((c) => c.split(";")[0]).join("; ") },
})
const body = await json(session)
if (!session.ok || !body?.user?.email) {
    console.error("session failed", session.status, body)
    process.exit(1)
}

console.log("auth e2e ok", body.user.email)
