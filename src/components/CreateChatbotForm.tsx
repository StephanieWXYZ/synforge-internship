"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { chatbotTemplates, defaultSystemPrompt, type ChatbotTemplate } from "@/lib/chatbotTemplates";

type FormValues = {
  name: string;
  domain: string;
  description: string;
  systemPrompt: string;
};

type FieldErrors = Partial<Record<keyof FormValues, string>>;

const emptyFormValues: FormValues = {
  name: "",
  domain: "",
  description: "",
  systemPrompt: defaultSystemPrompt,
};

function templateToFormValues(template: ChatbotTemplate): FormValues {
  return {
    name: template.name,
    domain: template.domain,
    description: template.description,
    systemPrompt: template.systemPrompt,
  };
}

function validateForm(values: FormValues) {
  const errors: FieldErrors = {};

  if (!values.name.trim()) {
    errors.name = "Name is required.";
  }
  if (!values.domain.trim()) {
    errors.domain = "Domain/category is required.";
  }
  if (!values.description.trim()) {
    errors.description = "Description is required.";
  }
  if (!values.systemPrompt.trim()) {
    errors.systemPrompt = "System prompt/instructions are required.";
  }

  return errors;
}

export function CreateChatbotForm() {
  const router = useRouter();
  const [selectedTemplateId, setSelectedTemplateId] = useState("scratch");
  const [values, setValues] = useState<FormValues>(emptyFormValues);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  function selectTemplate(template: ChatbotTemplate) {
    setSelectedTemplateId(template.id);
    setValues(templateToFormValues(template));
    setFieldErrors({});
    setServerError("");
  }

  function selectFromScratch() {
    setSelectedTemplateId("scratch");
    setValues(emptyFormValues);
    setFieldErrors({});
    setServerError("");
  }

  function updateValue(field: keyof FormValues, value: string) {
    setValues((currentValues) => ({
      ...currentValues,
      [field]: value,
    }));
    setFieldErrors((currentErrors) => ({ ...currentErrors, [field]: undefined }));
    setServerError("");
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) {
      return;
    }

    const nextFieldErrors = validateForm(values);
    setFieldErrors(nextFieldErrors);
    setServerError("");

    if (Object.keys(nextFieldErrors).length > 0) {
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/chatbots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      const data = (await response.json()) as {
        chatbot?: { id: string };
        error?: string;
        fieldErrors?: FieldErrors;
      };

      if (!response.ok || !data.chatbot?.id) {
        setFieldErrors(data.fieldErrors ?? {});
        setServerError(data.error ?? "Chatbot creation failed.");
        return;
      }

      router.push(`/chatbots/${data.chatbot.id}`);
      router.refresh();
    } catch {
      setServerError("Chatbot creation failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-5 rounded-lg border border-slate-200 bg-white p-6">
      <fieldset disabled={isSubmitting}>
        <legend className="text-sm font-medium text-slate-700">Start from template</legend>
        <p className="mt-1 text-sm leading-6 text-slate-500">
          Switching templates replaces the current form values. You can edit every field before saving.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={selectFromScratch}
            aria-pressed={selectedTemplateId === "scratch"}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-blue-300 hover:text-blue-700 aria-pressed:border-blue-700 aria-pressed:bg-blue-50 aria-pressed:text-blue-700"
          >
            From scratch
          </button>
          {chatbotTemplates.map((template) => (
            <button
              key={template.id}
              type="button"
              onClick={() => selectTemplate(template)}
              aria-pressed={selectedTemplateId === template.id}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-blue-300 hover:text-blue-700 aria-pressed:border-blue-700 aria-pressed:bg-blue-50 aria-pressed:text-blue-700"
            >
              {template.name}
            </button>
          ))}
        </div>
      </fieldset>

      <div>
        <label className="block text-sm font-medium text-slate-700" htmlFor="name">
          Name
        </label>
        <input
          id="name"
          name="name"
          aria-invalid={Boolean(fieldErrors.name)}
          aria-describedby={fieldErrors.name ? "name-error" : undefined}
          value={values.name}
          onChange={(event) => updateValue("name", event.target.value)}
          placeholder="Real Estate Assistant"
          className="mt-2 min-h-11 w-full rounded-md border border-slate-300 px-3 text-sm aria-invalid:border-rose-400"
        />
        {fieldErrors.name ? (
          <p id="name-error" className="mt-2 text-sm text-rose-700">{fieldErrors.name}</p>
        ) : null}
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700" htmlFor="domain">
          Domain/category
        </label>
        <input
          id="domain"
          name="domain"
          aria-invalid={Boolean(fieldErrors.domain)}
          aria-describedby={fieldErrors.domain ? "domain-error" : undefined}
          value={values.domain}
          onChange={(event) => updateValue("domain", event.target.value)}
          placeholder="Real Estate"
          className="mt-2 min-h-11 w-full rounded-md border border-slate-300 px-3 text-sm aria-invalid:border-rose-400"
        />
        {fieldErrors.domain ? (
          <p id="domain-error" className="mt-2 text-sm text-rose-700">{fieldErrors.domain}</p>
        ) : null}
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700" htmlFor="description">
          Description
        </label>
        <textarea
          id="description"
          name="description"
          aria-invalid={Boolean(fieldErrors.description)}
          aria-describedby={fieldErrors.description ? "description-error" : undefined}
          rows={4}
          value={values.description}
          onChange={(event) => updateValue("description", event.target.value)}
          placeholder="Answers questions about uploaded property documents, leases, inspections, and disclosures."
          className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm leading-6 aria-invalid:border-rose-400"
        />
        {fieldErrors.description ? (
          <p id="description-error" className="mt-2 text-sm text-rose-700">
            {fieldErrors.description}
          </p>
        ) : null}
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700" htmlFor="systemPrompt">
          System prompt/instructions
        </label>
        <textarea
          id="systemPrompt"
          name="systemPrompt"
          aria-invalid={Boolean(fieldErrors.systemPrompt)}
          aria-describedby={fieldErrors.systemPrompt ? "systemPrompt-error" : undefined}
          rows={5}
          value={values.systemPrompt}
          onChange={(event) => updateValue("systemPrompt", event.target.value)}
          className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm leading-6 aria-invalid:border-rose-400"
        />
        {fieldErrors.systemPrompt ? (
          <p id="systemPrompt-error" className="mt-2 text-sm text-rose-700">
            {fieldErrors.systemPrompt}
          </p>
        ) : null}
      </div>
      {serverError ? (
        <div className="rounded-md border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {serverError}
        </div>
      ) : null}
      <button
        type="submit"
        disabled={isSubmitting}
        className="inline-flex min-h-11 items-center justify-center rounded-md bg-blue-700 px-4 text-sm font-semibold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-blue-300"
      >
        {isSubmitting ? "Creating chatbot..." : "Create chatbot"}
      </button>
    </form>
  );
}
