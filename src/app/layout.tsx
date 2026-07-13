import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";

import { signOutAction } from "@/app/actions";
import { getCurrentUser } from "@/lib/auth";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Domain Knowledge Chatbot MVP",
  description: "Create document-grounded chatbots for specific business domains.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getCurrentUser();

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex min-h-16 w-full max-w-6xl items-center justify-between px-5 sm:px-8">
            <Link href="/" className="font-semibold text-slate-950">
              TSF Chatbot MVP
            </Link>
            {user ? (
              <div className="flex items-center gap-3 text-sm">
                <span className="hidden text-slate-500 sm:inline">{user.email}</span>
                <form action={signOutAction}>
                  <button
                    type="submit"
                    className="rounded-md border border-slate-300 px-3 py-2 font-medium text-slate-700 transition hover:border-blue-300 hover:text-blue-700"
                  >
                    Sign out
                  </button>
                </form>
              </div>
            ) : (
              <nav className="flex items-center gap-2 text-sm">
                <Link
                  href="/sign-in"
                  className="rounded-md px-3 py-2 font-medium text-slate-700 transition hover:text-blue-700"
                >
                  Sign in
                </Link>
                <Link
                  href="/sign-up"
                  className="rounded-md bg-blue-700 px-3 py-2 font-semibold text-white transition hover:bg-blue-800"
                >
                  Sign up
                </Link>
              </nav>
            )}
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
