import type { Metadata } from "next";
import "./globals.css";
import { RunProvider } from "@/contexts/RunContext";

const defaultUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(defaultUrl),
  title: "OpenRun — Run your game",
  description: "Basketball run management and scorekeeping",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <RunProvider>{children}</RunProvider>
      </body>
    </html>
  );
}
