import { readFile } from "node:fs/promises"
import { join } from "node:path"

import { ImageResponse } from "next/og"

import { SITE_NAME, SITE_TAGLINE } from "@/lib/seo"
import { APP_BACKGROUND, APP_FOREGROUND, APP_PRIMARY } from "@/lib/theme"

export const alt = `${SITE_NAME} — ${SITE_TAGLINE}`
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
            <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
                <img
                    src={src}
                    width={104}
                    height={104}
                    alt=""
                    style={{ borderRadius: 20 }}
                />
                <div style={{ display: "flex", flexDirection: "column" }}>
                    <div
                        style={{
                            fontFamily: "Manrope",
                            fontSize: 64,
                            fontWeight: 600,
                            letterSpacing: -1,
                        }}
                    >
                        {SITE_NAME}
                    </div>
                    <div
                        style={{
                            marginTop: 10,
                            fontSize: 30,
                            color: "rgba(245,242,231,0.68)",
                        }}
                    >
                        {SITE_TAGLINE}
                    </div>
                </div>
            </div>
            <div
                style={{
                    marginTop: 52,
                    height: 4,
                    width: 168,
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
