import { Geist_Mono, Manrope } from "next/font/google"

import type { Metadata, Viewport } from "next"

import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { AppWsProvider } from "@/components/ws/app-ws-provider"
import {
    SITE_DESCRIPTION,
    SITE_NAME,
    SITE_TAGLINE,
    siteOrigin,
} from "@/lib/seo"
import { APP_BACKGROUND } from "@/lib/theme"
import { cn } from "@/lib/utils"

const HOME_TITLE = `${SITE_NAME} — ${SITE_TAGLINE}`

export const metadata: Metadata = {
    metadataBase: new URL(siteOrigin()),
    title: {
        default: HOME_TITLE,
        template: `%s | ${SITE_NAME}`,
    },
    description: SITE_DESCRIPTION,
    applicationName: SITE_NAME,
    icons: {
        icon: [
            { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
            { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
        ],
        apple: "/apple-touch-icon.png",
    },
    openGraph: {
        type: "website",
        siteName: SITE_NAME,
        title: HOME_TITLE,
        description: SITE_DESCRIPTION,
        url: siteOrigin(),
    },
    twitter: {
        card: "summary_large_image",
        title: HOME_TITLE,
        description: SITE_DESCRIPTION,
    },
}

export const viewport: Viewport = { themeColor: APP_BACKGROUND }

const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope" })

const fontMono = Geist_Mono({
    subsets: ["latin"],
    variable: "--font-mono",
})

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode
}>) {
    return (
        <html
            lang="en"
            suppressHydrationWarning
            className={cn(
                "antialiased",
                fontMono.variable,
                "font-sans",
                manrope.variable
            )}
        >
            <body>
                <ThemeProvider>
                    <AppWsProvider>{children}</AppWsProvider>
                </ThemeProvider>
            </body>
        </html>
    )
}
