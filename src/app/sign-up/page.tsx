import Link from "next/link";
import { redirect } from "next/navigation";

import { signUpAction } from "@/app/actions";
import { getCurrentUser } from "@/lib/auth";

type SignUpPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function SignUpPage({ searchParams }: SignUpPageProps) {
  const user = await getCurrentUser();
  if (user) {
    redirect("/");
  }

  const { error } = await searchParams;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 py-10">
      <div>
        <h1 className="text-3xl font-semibold text-slate-950">Create account</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Create an account so your chatbots stay separate from other users.
        </p>
      </div>

      <form action={signUpAction} className="mt-8 space-y-5 rounded-lg border border-slate-200 bg-white p-6">
        {error ? (
          <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
        ) : null}
        <div>
          <label className="block text-sm font-medium text-slate-700" htmlFor="name">
            Name
          </label>
          <input
            id="name"
            name="name"
            required
            className="mt-2 min-h-11 w-full rounded-md border border-slate-300 px-3 text-sm"
          />
        </div>
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
            minLength={8}
            className="mt-2 min-h-11 w-full rounded-md border border-slate-300 px-3 text-sm"
          />
        </div>
        <button
          type="submit"
          className="inline-flex min-h-11 w-full items-center justify-center rounded-md bg-blue-700 px-4 text-sm font-semibold text-white transition hover:bg-blue-800"
        >
          Create account
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-slate-600">
        Already have an account?{" "}
        <Link href="/sign-in" className="font-semibold text-blue-700 hover:text-blue-800">
          Sign in
        </Link>
      </p>
    </main>
  );
}
