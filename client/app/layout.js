import { Inter } from "next/font/google";
import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata = {
  title: "NEXUS.AI — AI Interview Simulation Engine",
  description: "Voice-activated multi-agent technical interview simulator powered by Gemini AI.",
};

export default function RootLayout({ children }) {
  return (
    <ClerkProvider>
      <html lang="en" className={`${inter.variable} h-full antialiased bg-black`}>
        <body className="min-h-full flex flex-col bg-black">{children}</body>
      </html>
    </ClerkProvider>
  );
}

