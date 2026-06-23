export const suggestedQuestionsByDomain = {
  realEstate: [
    "What are the key obligations in this lease?",
    "Are there any termination clauses?",
    "What fees or penalties are mentioned?",
    "What dates or deadlines should I know?",
  ],
  insurance: [
    "What is covered under this policy?",
    "What exclusions are listed?",
    "What is the claim submission process?",
    "Are there any waiting periods?",
  ],
  powerStation: [
    "What safety warnings are mentioned?",
    "What are the maintenance steps?",
    "What operating limits are listed?",
    "What should be escalated to a supervisor?",
  ],
  legalCompliance: [
    "What compliance requirements are mentioned?",
    "Are there any reporting or approval deadlines?",
    "What risks or violations should I watch for?",
    "What records or documentation are required?",
  ],
  internshipTraining: [
    "What onboarding steps should I complete?",
    "What coding practices are recommended?",
    "What tools or workflows should I learn?",
    "What should I do if I get blocked?",
  ],
} satisfies Record<string, string[]>;

const domainMatchers: Array<{
  key: keyof typeof suggestedQuestionsByDomain;
  patterns: string[];
}> = [
  { key: "realEstate", patterns: ["real estate", "lease", "property"] },
  { key: "insurance", patterns: ["insurance", "policy", "claim", "coverage"] },
  { key: "powerStation", patterns: ["power station", "operations", "maintenance", "safety"] },
  { key: "legalCompliance", patterns: ["legal", "compliance", "audit"] },
  { key: "internshipTraining", patterns: ["internship", "training", "onboarding"] },
];

export function getSuggestedQuestions(chatbotName: string, chatbotDomain: string) {
  const searchableText = `${chatbotName} ${chatbotDomain}`.toLowerCase();
  const match = domainMatchers.find(({ patterns }) =>
    patterns.some((pattern) => searchableText.includes(pattern)),
  );

  return match ? suggestedQuestionsByDomain[match.key] : [];
}
