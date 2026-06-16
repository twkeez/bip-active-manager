import type { ClientFormData } from "@/types/onboarding";

export function buildPrompt(data: ClientFormData): string {
  return `You are a senior marketing strategist at a veterinary marketing agency that works exclusively with veterinary practices in the USA.

A new client has completed their onboarding intake form. Based on their responses, create a personalized onboarding plan.

CLIENT DETAILS:
- Practice Name: ${data.practiceName}
- Contact Name: ${data.contactName}
- Location: ${data.location}
- Practice Type: ${data.practiceType}
- Number of Veterinarians: ${data.numVets}
- Services Interested In: ${data.services.join(", ")}
- Main Goal: ${data.mainGoal}
- Biggest Challenge: ${data.challenge}
- Monthly Marketing Budget: ${data.budget}
- Desired Timeline: ${data.timeline}
- Existing Digital Presence: ${data.presence}
- Additional Notes: ${data.notes || "None provided"}

Respond with STRICT JSON only — no markdown, no backticks, no commentary. Return raw JSON matching this exact structure:

{
  "welcome": "A warm, personalized welcome message addressing the contact by name and referencing their practice",
  "whyItMatters": "A paragraph explaining why digital marketing matters specifically for their type of practice and goals",
  "stats": [
    { "num": "XX%", "label": "Relevant industry stat label" },
    { "num": "XX%", "label": "Relevant industry stat label" },
    { "num": "XX%", "label": "Relevant industry stat label" }
  ],
  "serviceStrategy": "A paragraph explaining the recommended marketing strategy based on their selected services and goals",
  "roadmap": [
    { "phase": "30 Days", "title": "Phase title", "actions": ["Action 1", "Action 2", "Action 3"] },
    { "phase": "60 Days", "title": "Phase title", "actions": ["Action 1", "Action 2", "Action 3"] },
    { "phase": "90 Days", "title": "Phase title", "actions": ["Action 1", "Action 2", "Action 3"] }
  ],
  "quickWins": ["Quick win 1", "Quick win 2", "Quick win 3"],
  "nextSteps": ["Next step 1", "Next step 2", "Next step 3"]
}

Use realistic veterinary industry statistics. Tailor all content to this specific practice's location, type, services, budget, and goals.`;
}
