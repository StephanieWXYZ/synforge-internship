import Link from "next/link";

import type { AccountLinkIssue } from "@/lib/auth";

type AccountLinkPageProps = { searchParams: Promise<{ status?: string }> };

const content: Record<AccountLinkIssue, { title: string; body: string; next: string }> = {
  legacy_link_required: {
    title: "Connect your existing Experts account",
    body: "An Experts account already uses this verified email. For safety, we will not merge it automatically.",
    next: "Sign in below with your existing Experts password. Then choose “Connect SyncForge account” in the header.",
  },
  link_email_mismatch: {
    title: "The account emails do not match",
    body: "The verified email on this SyncForge identity differs from the existing Experts account.",
    next: "Sign out of the SyncForge login session and retry with the identity that uses the same email as your Experts account.",
  },
  identity_already_linked: {
    title: "This identity is already connected",
    body: "The SyncForge identity is already assigned to another Experts account, so it cannot be linked again.",
    next: "Sign out of the SyncForge login session and retry with the correct identity. Contact support if you believe the existing connection is wrong.",
  },
  link_session_expired: {
    title: "Your linking session expired",
    body: "The legacy Experts session ended before the SyncForge callback completed.",
    next: "Sign in with your existing Experts password and start the connection again.",
  },
};

export default async function AccountLinkPage({ searchParams }: AccountLinkPageProps) {
  const value = (await searchParams).status;
  const status = value && value in content ? value as AccountLinkIssue : "legacy_link_required";
  const message = content[status];

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-5 py-10">
      <div className="rounded-lg border border-amber-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wide text-amber-700">Account protection</p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-950">{message.title}</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">{message.body}</p>
        <p className="mt-3 text-sm leading-6 text-slate-700">{message.next}</p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link href="/sign-in" className="inline-flex min-h-11 items-center justify-center rounded-md bg-blue-700 px-4 text-sm font-semibold text-white hover:bg-blue-800">
            Sign in to Experts
          </Link>
          <form action="/api/auth/signout-managed" method="post">
            <button type="submit" className="inline-flex min-h-11 w-full items-center justify-center rounded-md border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:border-blue-300 hover:text-blue-700">
              Sign out of SyncForge
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
