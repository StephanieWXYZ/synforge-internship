"use client";

import { useFormStatus } from "react-dom";

export function CreateChatbotButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex min-h-11 items-center justify-center rounded-md bg-blue-700 px-4 text-sm font-semibold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-blue-300"
    >
      {pending ? "Creating..." : "Create chatbot"}
    </button>
  );
}
