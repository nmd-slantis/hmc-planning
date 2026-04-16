import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HMC Capacity · /slantis",
  description: "Capacity coordination for HMC Architects — powered by /slantis",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
