import type { Metadata } from "next";
import { DM_Sans, Playfair_Display } from "next/font/google";
import { QueryProvider } from "@/components/query-provider";
import "./globals.css";

const display = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-appbase-display",
  weight: ["600", "700"],
});

const sans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-appbase-sans",
});

export const metadata: Metadata = {
  title: "AppBase Dashboard",
  description: "Operator console for AppBase",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${display.variable} ${sans.variable}`}>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
