import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "InterviewAI — AI-Powered Interview Coach",
  description:
    "Practice technical interviews with AI feedback powered by Claude. Get instant scoring, strengths analysis, and improvement suggestions tailored to your role and seniority level.",
  keywords: ["interview prep", "AI interview coach", "technical interview", "coding interview"],
  icons: {
    icon: "/logo.webp",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="antialiased min-h-screen">{children}</body>
    </html>
  );
}
