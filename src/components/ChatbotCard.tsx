import Link from "next/link";
import { MessageSquareText } from "lucide-react";

type ChatbotCardProps = {
  chatbot: {
    id: string;
    name: string;
    domain: string;
    description: string;
    _count?: { documents: number };
  };
};

export function ChatbotCard({ chatbot }: ChatbotCardProps) {
  return (
    <Link
      href={`/chatbots/${chatbot.id}`}
      className="block rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-blue-700">{chatbot.domain}</p>
          <h2 className="mt-1 text-xl font-semibold text-slate-950">{chatbot.name}</h2>
        </div>
        <div className="rounded-md bg-blue-50 p-2 text-blue-700">
          <MessageSquareText size={20} aria-hidden="true" />
        </div>
      </div>
      <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600">
        {chatbot.description}
      </p>
      <p className="mt-5 text-sm font-medium text-slate-500">
        {chatbot._count?.documents ?? 0} documents
      </p>
    </Link>
  );
}
