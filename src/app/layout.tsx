import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pick Analyzer",
  description: "Professional Sports Betting Analytics Platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col">
        {children}
      </body>
    </html>
  );
}