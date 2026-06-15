"use client";

import { useState } from "react";

import { CreateChatbotButton } from "@/components/CreateChatbotButton";
import { chatbotTemplates, defaultSystemPrompt, type ChatbotTemplate } from "@/lib/chatbotTemplates";

type CreateChatbotFormProps = {
  action: (formData: FormData) => void | Promise<void>;
};

type FormValues = {
  name: string;
  domain: string;
  description: string;
  systemPrompt: string;
};

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

export function CreateChatbotForm({ action }: CreateChatbotFormProps) {
  const [selectedTemplateId, setSelectedTemplateId] = useState("scratch");
  const [values, setValues] = useState<FormValues>(emptyFormValues);

  function selectTemplate(template: ChatbotTemplate) {
    setSelectedTemplateId(template.id);
    setValues(templateToFormValues(template));
  }

  function selectFromScratch() {
    setSelectedTemplateId("scratch");
    setValues(emptyFormValues);
  }

  function updateValue(field: keyof FormValues, value: string) {
    setValues((currentValues) => ({
      ...currentValues,
      [field]: value,
    }));
  }

  return (
    <form action={action} className="mt-8 space-y-5 rounded-lg border border-slate-200 bg-white p-6">
      <fieldset>
        <legend className="text-sm font-medium text-slate-700">Start from template</legend>
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
          required
          value={values.name}
          onChange={(event) => updateValue("name", event.target.value)}
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
          value={values.domain}
          onChange={(event) => updateValue("domain", event.target.value)}
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
          value={values.description}
          onChange={(event) => updateValue("description", event.target.value)}
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
          value={values.systemPrompt}
          onChange={(event) => updateValue("systemPrompt", event.target.value)}
          className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm leading-6"
        />
      </div>
      <CreateChatbotButton />
    </form>
  );
}
