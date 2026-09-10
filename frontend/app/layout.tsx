import type { Metadata, Viewport } from "next"
import { Manrope } from "next/font/google"

import { Provider } from "@/app/provider"

import "./globals.css"

const manrope = Manrope({
    subsets: ["latin"],
    variable: "--font-manrope",
})

export const metadata: Metadata = {
    title: {
        default: "Conserve Naija",
        template: "%s · Conserve Naija",
    },
    description: "Walk up to Conserve Site — Yaba, turn in mixed waste, and get paid. 1 CP = ₦1.",
}

export const viewport: Viewport = {
    themeColor: "#163322",
    colorScheme: "dark",
}

export default function RootLayout({
    children,
}: Readonly<{ children: React.ReactNode }>) {
    return (
        <html lang="en" className={`${manrope.variable} ${manrope.className} dark`}>
            <body>
                <Provider>{children}</Provider>
            </body>
        </html>
    )
}
