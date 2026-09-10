import { readFile } from "node:fs/promises"
import { join } from "node:path"

import { ImageResponse } from "next/og"

import { APP_BACKGROUND, APP_FOREGROUND, APP_PRIMARY } from "@/lib/theme"

export const alt = "Conserve Naija"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

export default async function OpenGraphImage() {
    const [logo, manrope] = await Promise.all([
        readFile(join(process.cwd(), "public/logo.png")),
        readFile(join(process.cwd(), "app/fonts/Manrope-SemiBold.ttf")),
    ])
    const src = `data:image/png;base64,${logo.toString("base64")}`

    return new ImageResponse(
        <div
            style={{
                width: "100%",
                height: "100%",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                padding: 80,
                backgroundColor: APP_BACKGROUND,
                color: APP_FOREGROUND,
            }}
        >
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 28,
                }}
            >
                <img
                    src={src}
                    width={96}
                    height={96}
                    alt=""
                    style={{ borderRadius: 18 }}
                />
                <div style={{ display: "flex", flexDirection: "column" }}>
                    <div
                        style={{
                            fontFamily: "Manrope",
                            fontSize: 64,
                            fontWeight: 600,
                            letterSpacing: 1,
                        }}
                    >
                        Conserve Naija
                    </div>
                    <div
                        style={{
                            marginTop: 8,
                            fontSize: 28,
                            color: "rgba(243,240,230,0.68)",
                        }}
                    >
                        Turn in mixed waste. Get paid for it.
                    </div>
                </div>
            </div>
            <div
                style={{
                    marginTop: 48,
                    height: 4,
                    width: 160,
                    backgroundColor: APP_PRIMARY,
                }}
            />
        </div>,
        {
            ...size,
            fonts: [
                {
                    name: "Manrope",
                    data: manrope,
                    style: "normal",
                    weight: 600,
                },
            ],
        }
    )
}
