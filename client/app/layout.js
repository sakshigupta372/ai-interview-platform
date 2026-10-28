import { Inter, Manrope, DM_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import ToastContainer from "@/components/Toast";
import OnboardingModal from "@/components/OnboardingModal";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope", weight: ["500", "600", "700", "800"] });
const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-dm-sans" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains", weight: ["400", "500"] });

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
  || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

export const metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "AI Mock Interview Practice for Placements | NEXUS.AI",
    template: "%s | NEXUS.AI",
  },
  description: "Practice technical, HR, system design, and coding interviews with an AI interviewer. Get scored answers, company-style questions, and a plan for what to fix next.",
  keywords: [
    "AI mock interview",
    "placement interview practice",
    "technical interview simulator",
    "system design interview practice",
    "DSA mock interview",
    "HR interview questions",
    "coding interview practice",
  ],
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: "/",
    siteName: "NEXUS.AI",
    title: "AI Mock Interview Practice for Placements | NEXUS.AI",
    description: "Practice technical, HR, system design, and coding interviews. Get scored feedback after every answer.",
  },
  twitter: {
    card: "summary_large_image",
    title: "AI Mock Interview Practice for Placements | NEXUS.AI",
    description: "Practice technical, HR, system design, and coding interviews with scored feedback.",
  },
  robots: { index: true, follow: true },
  alternates: { canonical: "/" },
};

export default function RootLayout({ children }) {
  return (
    <ClerkProvider>
      <html lang="en" className={`${inter.variable} ${manrope.variable} ${dmSans.variable} ${jetbrains.variable} h-full antialiased`}>
        <body className="min-h-full flex flex-col">
          {children}
          <ToastContainer />
          <OnboardingModal />
        </body>
      </html>
    </ClerkProvider>
  );
}

