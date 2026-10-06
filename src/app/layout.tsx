import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ChiCha Mobile — Management System",
  description: "Sistem Manajemen Operasional Internal Toko ChiCha Mobile",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body className="antialiased selection:bg-indigo-500 selection:text-white">
        {children}
      </body>
    </html>
  );
}
