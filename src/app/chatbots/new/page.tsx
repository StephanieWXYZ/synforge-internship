import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { createChatbotAction } from "@/app/actions";

export default function NewChatbotPage() {
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

      <form action={createChatbotAction} className="mt-8 space-y-5 rounded-lg border border-slate-200 bg-white p-6">
        <div>
          <label className="block text-sm font-medium text-slate-700" htmlFor="name">
            Name
          </label>
          <input
            id="name"
            name="name"
            required
            placeholder="Real Estate Assistant"
            className="mt-2 min-h-11 w-full rounded-md border border-slate-300 px-3 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700" htmlFor="domain">
            Domain/category
          </label>
          <input
            id="domain"
            name="domain"
            required
            placeholder="Real Estate"
            className="mt-2 min-h-11 w-full rounded-md border border-slate-300 px-3 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700" htmlFor="description">
            Description
          </label>
          <textarea
            id="description"
            name="description"
            required
            rows={4}
            placeholder="Answers questions about uploaded property documents, leases, inspections, and disclosures."
            className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm leading-6"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700" htmlFor="systemPrompt">
            System prompt/instructions
          </label>
          <textarea
            id="systemPrompt"
            name="systemPrompt"
            required
            rows={5}
            defaultValue="Answer only from uploaded documents for this chatbot. If the uploaded files do not contain enough information, say you do not know based on the provided files. Keep answers concise and include practical next steps when supported by the documents."
            className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm leading-6"
          />
        </div>
        <button
          type="submit"
          className="inline-flex min-h-11 items-center justify-center rounded-md bg-blue-700 px-4 text-sm font-semibold text-white transition hover:bg-blue-800"
        >
          Create chatbot
        </button>
      </form>
    </main>
  );
}
