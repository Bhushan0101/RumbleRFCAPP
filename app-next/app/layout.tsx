import type { Metadata } from "next";
import { Barlow, Barlow_Condensed } from "next/font/google";
import "./globals.css";

const barlow = Barlow({
  variable: "--font-barlow",
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  display: "swap",
});

const barlowCondensed = Barlow_Condensed({
  variable: "--font-barlow-condensed",
  weight: ["500", "600", "700", "800", "900"],
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  ),
  title: {
    default: "W.U.C.O Ireland — The home of Irish combat sports",
    template: "%s · W.U.C.O Ireland",
  },
  description:
    "World United Combat Organisation Ireland. One federation. Official records. National rankings. Real opportunities.",
  openGraph: {
    title: "W.U.C.O Ireland — The home of Irish combat sports",
    description:
      "One federation. Official records. National rankings. Real opportunities.",
    siteName: "W.U.C.O Ireland",
    type: "website",
    locale: "en_IE",
  },
  twitter: {
    card: "summary_large_image",
    title: "W.U.C.O Ireland",
    description: "The home of Irish combat sports.",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${barlow.variable} ${barlowCondensed.variable} antialiased`}
    >
      <body className="min-h-screen flex flex-col bg-bg text-text">
        {children}
      </body>
    </html>
  );
}
