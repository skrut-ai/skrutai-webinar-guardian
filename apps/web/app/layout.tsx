import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "skrutai-web",
  description: "Web chatbot demo with controllable failure flags and tracing."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
