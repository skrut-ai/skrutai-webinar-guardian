import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "skrutai-monitoring",
  description: "Standalone monitoring UI for GitHub gates, deploy routing, and tracing alerts."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
