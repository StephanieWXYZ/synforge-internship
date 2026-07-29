import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { CreateChatbotForm } from "@/components/CreateChatbotForm";
import { requireUser } from "@/lib/auth";

export default async function NewChatbotPage() {
  await requireUser();

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-8 sm:px-8">
      <Link href="/" className="inline-flex items-center gap-2 text-sm font-medium text-slate-600">
        <ArrowLeft size={16} aria-hidden="true" />
        Back
      </Link>
      <div className="mt-6">
        <h1 className="text-3xl font-semibold text-slate-950">Create chatbot</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Define the domain boundary and answering instructions. Documents are added next.
        </p>
      </div>

      <CreateChatbotForm />
    </main>
  );
}
