import type { Metadata, Viewport } from "next"
import { Manrope } from "next/font/google"

import { Provider } from "@/app/provider"
import { JsonLd } from "@/components/seo/json-ld"
import {
    organizationJsonLd,
    SITE_DESCRIPTION,
    SITE_KEYWORDS,
    SITE_NAME,
    siteOgImages,
    siteOrigin,
    siteTwitterImages,
} from "@/lib/seo"
import { APP_BACKGROUND } from "@/lib/theme"

import "./globals.css"

const manrope = Manrope({
    subsets: ["latin"],
    variable: "--font-manrope",
})

const appOrigin = siteOrigin()

export const metadata: Metadata = {
    metadataBase: new URL(appOrigin),
    title: {
        default: SITE_NAME,
        template: `%s · ${SITE_NAME}`,
    },
    description: SITE_DESCRIPTION,
    keywords: SITE_KEYWORDS,
    applicationName: SITE_NAME,
    authors: [{ name: SITE_NAME }],
    creator: SITE_NAME,
    category: "recycling",
    icons: {
        icon: [
            { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
            { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
            {
                url: "/android-chrome-192x192.png",
                sizes: "192x192",
                type: "image/png",
            },
            {
                url: "/android-chrome-512x512.png",
                sizes: "512x512",
                type: "image/png",
            },
        ],
        apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
        shortcut: ["/favicon-32x32.png"],
    },
    appleWebApp: {
        capable: true,
        title: SITE_NAME,
        statusBarStyle: "black-translucent",
    },
    openGraph: {
        type: "website",
        siteName: SITE_NAME,
        title: SITE_NAME,
        description: SITE_DESCRIPTION,
        url: appOrigin,
        locale: "en_NG",
        images: siteOgImages(),
    },
    twitter: {
        card: "summary_large_image",
        title: SITE_NAME,
        description: SITE_DESCRIPTION,
        images: siteTwitterImages(),
    },
    robots: {
        index: true,
        follow: true,
    },
}

export const viewport: Viewport = {
    themeColor: APP_BACKGROUND,
    colorScheme: "dark",
}

export default function RootLayout({
    children,
}: Readonly<{ children: React.ReactNode }>) {
    return (
        <html lang="en" className={`${manrope.variable} ${manrope.className} dark`}>
            <body>
                <JsonLd data={organizationJsonLd()} />
                <Provider>{children}</Provider>
            </body>
        </html>
    )
}
