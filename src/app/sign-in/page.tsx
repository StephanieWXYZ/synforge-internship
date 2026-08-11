import Link from "next/link";
import { redirect } from "next/navigation";

import { signInAction } from "@/app/actions";
import { getCurrentUser } from "@/lib/auth";

type SignInPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const user = await getCurrentUser();
  if (user) {
    redirect("/");
  }

  const { error } = await searchParams;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 py-10">
      <div>
        <h1 className="text-3xl font-semibold text-slate-950">Sign in</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Use one SyncForge account across Forge, Experts, Wuxia, and Marketing.
        </p>
      </div>

      <a
        href="/api/auth/signin"
        className="mt-8 inline-flex min-h-11 w-full items-center justify-center rounded-md bg-blue-700 px-4 text-sm font-semibold text-white transition hover:bg-blue-800"
      >
        Continue with SyncForge
      </a>

      <div className="my-5 flex items-center gap-3 text-xs uppercase tracking-wide text-slate-400">
        <span className="h-px flex-1 bg-slate-200" />
        Legacy account migration
        <span className="h-px flex-1 bg-slate-200" />
      </div>

      <form action={signInAction} className="space-y-5 rounded-lg border border-slate-200 bg-white p-6">
        {error ? (
          <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
        ) : null}
        <div>
          <label className="block text-sm font-medium text-slate-700" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            className="mt-2 min-h-11 w-full rounded-md border border-slate-300 px-3 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            className="mt-2 min-h-11 w-full rounded-md border border-slate-300 px-3 text-sm"
          />
        </div>
        <button
          type="submit"
          className="inline-flex min-h-11 w-full items-center justify-center rounded-md bg-blue-700 px-4 text-sm font-semibold text-white transition hover:bg-blue-800"
        >
          Sign in
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-slate-600">
        New users should continue with SyncForge. Need a temporary legacy account?{" "}
        <Link href="/sign-up" className="font-semibold text-blue-700 hover:text-blue-800">
          Sign up
        </Link>
      </p>
    </main>
  );
}
