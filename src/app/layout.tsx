import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import { Providers } from "@/components/app/Providers";

export const metadata: Metadata = {
  applicationName: "PaperMint",
  title: {
    default: "PaperMint · Simple Australian invoicing",
    template: "%s · PaperMint"
  },
  description: "Simple AUD invoicing, quotes, ABN, GST and Australian financial-year reporting for small business.",
  icons: {
    icon: "/papermint-mark.svg",
    apple: "/papermint-mark.svg"
  },
  manifest: "/manifest.webmanifest"
};

export const viewport: Viewport = {
  themeColor: "#17211b"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html data-scroll-behavior="smooth" lang="en">
      <body>
        <Providers>{children}</Providers>
        <Analytics />
      </body>
    </html>
  );
}
