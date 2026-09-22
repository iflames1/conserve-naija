export type WsEnvelope = {
    kind: string
    payload: Record<string, unknown>
}

export type ClientMessage =
    | { kind: "auth"; payload: { token: string } }
    | { kind: "ping"; payload: Record<string, never> }
    | { kind: "subscribe"; payload: { topic: string } }
    | { kind: "unsubscribe"; payload: { topic: string } }

export function isWsEnvelope(value: unknown): value is WsEnvelope {
    if (!value || typeof value !== "object") return false
    const record = value as Record<string, unknown>
    return typeof record.kind === "string" && typeof record.payload === "object"
}
