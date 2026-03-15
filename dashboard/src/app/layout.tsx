import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VaultAgent - Permission Control for AI Agents",
  description:
    "Secure, monitor, and control AI agent tool access with policy-driven permissions, real-time audit logging, and approval workflows.",
  keywords: [
    "AI agents",
    "permissions",
    "security",
    "audit",
    "policy engine",
    "MCP",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
