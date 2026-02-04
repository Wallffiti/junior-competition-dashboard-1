import type React from "react";
import "./globals.css";
import { Inter } from "next/font/google";
import { GeistSans } from "geist/font/sans";
import { Toaster } from "@/components/ui/toaster";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "Hackathon - Bugcrusher® – Junior Hackathon",
  description: "Competition dashboard for bug crushers",
  icons: {
    icon: '/favicon.ico'
  }
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={GeistSans.variable}>
      <body className={inter.className}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}

import "./globals.css";
