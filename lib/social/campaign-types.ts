export type CampaignTypeDef = {
  key: string;
  label: string;
  color: string; // tailwind bg class for light theme
  description: string;
};

export const CAMPAIGN_TYPES: CampaignTypeDef[] = [
  { key: "pet_of_month", label: "Pet of the Month", color: "bg-pink-100 text-pink-800", description: "Feature a patient or client-submitted pet" },
  { key: "team_spotlight", label: "Team Spotlight", color: "bg-blue-100 text-blue-800", description: "Highlight a team member or staff pet" },
  { key: "educational", label: "Educational / Health Tip", color: "bg-green-100 text-green-800", description: "Teach something useful about pet health" },
  { key: "resident_pet", label: "Resident / Mascot Pet", color: "bg-purple-100 text-purple-800", description: "Feature the practice's own pet or mascot" },
  { key: "client_testimonial", label: "Client Testimonial", color: "bg-yellow-100 text-yellow-800", description: "Pair a review with a pet photo" },
  { key: "behind_scenes", label: "Behind the Scenes", color: "bg-orange-100 text-orange-800", description: "Show the human side of the practice" },
  { key: "awareness_day", label: "Awareness Day", color: "bg-teal-100 text-teal-800", description: "Tie content to a national pet awareness day" },
  { key: "seasonal", label: "Seasonal / Holiday Safety", color: "bg-red-100 text-red-800", description: "Timely safety or seasonal tips" },
  { key: "promotion", label: "Promotion / Announcement", color: "bg-indigo-100 text-indigo-800", description: "New service, offer, or practice update" },
  { key: "before_after", label: "Before & After", color: "bg-cyan-100 text-cyan-800", description: "Dental, weight loss, or recovery transformation" },
  { key: "fun_fact", label: "Fun Fact", color: "bg-lime-100 text-lime-800", description: "Surprising or heartwarming animal fact" },
  { key: "series", label: "Content Series", color: "bg-violet-100 text-violet-800", description: "Ongoing recurring series (breed spotlight, etc.)" },
];

export function getCampaignType(key: string): CampaignTypeDef | undefined {
  return CAMPAIGN_TYPES.find((c) => c.key === key);
}

export const CAMPAIGN_TYPE_KEYS = CAMPAIGN_TYPES.map((c) => c.key);
