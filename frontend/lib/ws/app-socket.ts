import { isWsEnvelope, type ClientMessage, type WsEnvelope } from "./protocol"

export type ConnectionStatus = "idle" | "connecting" | "open" | "closed"

type Listener = (message: WsEnvelope) => void

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080"

class AppSocket {
    private socket: WebSocket | null = null
    private reconnectTimer: ReturnType<typeof setTimeout> | null = null
    private heartbeatTimer: ReturnType<typeof setInterval> | null = null
    private backoff = 1000
    private token = ""
    private status: ConnectionStatus = "idle"
    private readonly listeners = new Set<Listener>()

    connect(token: string) {
        if (typeof window === "undefined") return
        this.token = token
        if (this.socket?.readyState === WebSocket.OPEN) return
        this.status = "connecting"
        const socket = new WebSocket(
            `${API_URL.replace(/^http/, "ws")}/api/v1/ws/app`
        )
        this.socket = socket
        socket.onopen = () => {
            this.status = "open"
            this.backoff = 1000
            socket.send(JSON.stringify({ kind: "auth", payload: { token } }))
            this.heartbeatTimer = setInterval(
                () => this.send({ kind: "ping", payload: {} }),
                25000
            )
        }
        socket.onmessage = (event) => {
            try {
                const message: unknown = JSON.parse(event.data)
                if (isWsEnvelope(message))
                    this.listeners.forEach((listener) => listener(message))
            } catch {
                // Ignore malformed frames from an unavailable or outdated peer.
            }
        }
        socket.onclose = () => {
            this.status = "closed"
            if (this.heartbeatTimer) clearInterval(this.heartbeatTimer)
            this.reconnectTimer = setTimeout(
                () => this.connect(this.token),
                this.backoff
            )
            this.backoff = Math.min(this.backoff * 2, 8000)
        }
    }

    send(message: ClientMessage) {
        if (this.socket?.readyState !== WebSocket.OPEN) return false
        this.socket.send(JSON.stringify(message))
        return true
    }

    subscribe(listener: Listener) {
        this.listeners.add(listener)
        return () => this.listeners.delete(listener)
    }
}

export const appSocket = new AppSocket()
