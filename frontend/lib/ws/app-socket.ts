import { wsUrl } from "@/lib/config"
import {
    isWsEnvelope,
    type ClientMessage,
    type WsEnvelope,
} from "./protocol"

export type ConnectionStatus = "idle" | "connecting" | "open" | "closed"

type MessageListener = (message: WsEnvelope) => void
type StatusListener = (status: ConnectionStatus) => void
type TokenProvider = () => Promise<string | null>

const MIN_BACKOFF_MS = 1_000
const MAX_BACKOFF_MS = 8_000
const HEARTBEAT_MS = 25_000
const MAX_AUTH_ATTEMPTS = 3
const AUTH_RETRY_MS = 15_000

/**
 * One multiplexed `/app` connection shared by the whole client.
 */
class AppSocket {
    private socket: WebSocket | null = null
    private status: ConnectionStatus = "idle"
    private intentionalClose = false
    private reconnectTimer: ReturnType<typeof setTimeout> | null = null
    private heartbeatTimer: ReturnType<typeof setInterval> | null = null
    private backoffMs = MIN_BACKOFF_MS
    private tokenProvider: TokenProvider | null = null
    private authenticated = false
    private authAttempts = 0
    private authInFlight = false
    private lastAuthAt = 0
    private readonly messageListeners = new Set<MessageListener>()
    private readonly statusListeners = new Set<StatusListener>()

    setTokenProvider(provider: TokenProvider | null) {
        this.tokenProvider = provider
    }

    getStatus(): ConnectionStatus {
        return this.status
    }

    isAuthenticated(): boolean {
        return this.authenticated
    }

    onMessage(listener: MessageListener): () => void {
        this.messageListeners.add(listener)
        return () => {
            this.messageListeners.delete(listener)
        }
    }

    onStatus(listener: StatusListener): () => void {
        this.statusListeners.add(listener)
        listener(this.status)
        return () => {
            this.statusListeners.delete(listener)
        }
    }

    connect(): void {
        if (typeof window === "undefined") return
        this.intentionalClose = false

        if (
            this.socket &&
            (this.socket.readyState === WebSocket.OPEN ||
                this.socket.readyState === WebSocket.CONNECTING)
        ) {
            return
        }

        this.clearReconnect()
        this.resetAuth()
        this.setStatus("connecting")

        const socket = new WebSocket(wsUrl())
        this.socket = socket
        const isCurrent = () => this.socket === socket

        socket.onopen = () => {
            if (!isCurrent()) return
            this.backoffMs = MIN_BACKOFF_MS
            this.setStatus("open")
            this.startHeartbeat()
            void this.authenticate()
        }

        socket.onmessage = (event) => {
            if (!isCurrent()) return
            if (typeof event.data !== "string") return
            let parsed: unknown
            try {
                parsed = JSON.parse(event.data)
            } catch {
                return
            }
            if (!isWsEnvelope(parsed)) return

            if (parsed.kind === "authenticated") {
                this.authenticated = true
                this.authAttempts = 0
            }
            if (parsed.kind === "error" && parsed.payload.code === "unauthorized") {
                this.authenticated = false
                if (Date.now() - this.lastAuthAt >= AUTH_RETRY_MS) {
                    void this.authenticate()
                }
            }

            for (const listener of this.messageListeners) {
                listener(parsed)
            }
        }

        socket.onerror = () => {}

        socket.onclose = () => {
            if (!isCurrent()) return
            this.socket = null
            this.authenticated = false
            this.stopHeartbeat()
            this.setStatus("closed")
            if (!this.intentionalClose) this.scheduleReconnect()
        }
    }

    disconnect(): void {
        this.intentionalClose = true
        this.clearReconnect()
        this.stopHeartbeat()
        if (this.socket) {
            this.socket.close()
            this.socket = null
        }
        this.authenticated = false
        this.setStatus("closed")
    }

    send(message: ClientMessage | WsEnvelope): boolean {
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return false
        this.socket.send(JSON.stringify(message))
        return true
    }

    refreshAuth(): void {
        this.resetAuth()
        void this.authenticate()
    }

    ping(): boolean {
        return this.send({ kind: "ping", payload: {} })
    }

    private resetAuth(): void {
        this.authenticated = false
        this.authAttempts = 0
        this.lastAuthAt = 0
    }

    private async authenticate(): Promise<void> {
        if (!this.tokenProvider) return
        if (this.authInFlight) return
        if (this.authAttempts >= MAX_AUTH_ATTEMPTS) return

        this.authInFlight = true
        this.authAttempts += 1
        this.lastAuthAt = Date.now()
        try {
            const token = await this.tokenProvider()
            if (!token) return
            this.send({ kind: "auth", payload: { token } })
        } catch {
            // Session may not be ready yet.
        } finally {
            this.authInFlight = false
        }
    }

    private setStatus(status: ConnectionStatus): void {
        this.status = status
        for (const listener of this.statusListeners) listener(status)
    }

    private startHeartbeat(): void {
        this.stopHeartbeat()
        this.heartbeatTimer = setInterval(() => {
            this.ping()
        }, HEARTBEAT_MS)
    }

    private stopHeartbeat(): void {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer)
            this.heartbeatTimer = null
        }
    }

    private scheduleReconnect(): void {
        this.clearReconnect()
        const wait = this.backoffMs
        this.backoffMs = Math.min(this.backoffMs * 2, MAX_BACKOFF_MS)
        this.reconnectTimer = setTimeout(() => this.connect(), wait)
    }

    private clearReconnect(): void {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer)
            this.reconnectTimer = null
        }
    }
}

export const appSocket = new AppSocket()
