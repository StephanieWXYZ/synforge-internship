import { describe, expect, it } from "vitest";

import {
  chatbotTemplates,
  getSuggestedQuestions,
  type ChatbotTemplate,
} from "@/lib/chatbotTemplates";

const requiredTemplateNames = [
  "Real Estate Assistant",
  "Insurance Policy Assistant",
  "Power Station Operations Assistant",
  "Legal Compliance Assistant",
  "Internship Training Assistant",
];

function assertCompleteTemplate(template: ChatbotTemplate) {
  expect(template.id.trim()).not.toBe("");
  expect(template.name.trim()).not.toBe("");
  expect(template.domain.trim()).not.toBe("");
  expect(template.description.trim()).not.toBe("");
  expect(template.systemPrompt.trim()).not.toBe("");
  expect(template.suggestedQuestions.length).toBeGreaterThan(0);
  expect(template.suggestedQuestions.every((question) => question.trim().length > 0)).toBe(true);
}

describe("chatbotTemplates", () => {
  it("includes every required template with complete values", () => {
    expect(chatbotTemplates.map((template) => template.name)).toEqual(requiredTemplateNames);
    chatbotTemplates.forEach(assertCompleteTemplate);
  });

  it("returns domain-relevant suggested questions from the shared template config", () => {
    expect(getSuggestedQuestions("Real Estate Assistant", "Real Estate")).toEqual(
      chatbotTemplates[0].suggestedQuestions,
    );
    expect(getSuggestedQuestions("My custom assistant", "Insurance")).toEqual(
      chatbotTemplates[1].suggestedQuestions,
    );
  });

  it("does not return unrelated suggestions for custom chatbots without a matching template", () => {
    expect(getSuggestedQuestions("Custom Research Assistant", "Market Research")).toEqual([]);
  });
});
