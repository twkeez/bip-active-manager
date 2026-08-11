export type AwarenessDay = {
  name: string;
  month: number;
  day: number | null; // null = whole month or variable date
  description: string;
  contentAngle: string;
};

export const AWARENESS_DAYS: AwarenessDay[] = [
  // January
  { name: "National Train Your Dog Month", month: 1, day: null, description: "Whole month celebrating dog training", contentAngle: "Share a quick training tip or highlight the importance of regular obedience work" },
  { name: "National Bird Day", month: 1, day: 5, description: "Awareness day for pet birds and avian welfare", contentAngle: "Feature any avian patients or share care tips for bird owners" },
  { name: "National Walk Your Dog Week", month: 1, day: null, description: "First week of January — encourages daily dog walking", contentAngle: "Motivate clients to start the year with a walking routine and why it matters for pet health" },

  // February
  { name: "National Pet Dental Health Month", month: 2, day: null, description: "Whole month focused on pet oral health", contentAngle: "Share dental stats, before/after visuals (with permission), or a quick brushing demo video" },
  { name: "Valentine's Day Pet Safety", month: 2, day: 14, description: "Valentine's Day — chocolate and lilies are hazards for pets", contentAngle: "Warm love-themed post with a safety reminder about holiday hazards (chocolate, flowers)" },
  { name: "Spay/Neuter Awareness Month", month: 2, day: null, description: "Whole month promoting spay and neuter", contentAngle: "Share the health and population benefits of spay/neuter in an approachable way" },

  // March
  { name: "National Puppy Day", month: 3, day: 23, description: "Celebrates puppies and promotes adoption", contentAngle: "Feature a cute puppy patient or share new puppy tips — vaccines, socialization, first vet visit" },
  { name: "National Pet Poison Prevention Week", month: 3, day: null, description: "Third week of March — common household toxins", contentAngle: "Share a list of common household items that are toxic to pets — always high engagement" },
  { name: "St. Patrick's Day Pet Safety", month: 3, day: 17, description: "Holiday safety for pets", contentAngle: "Fun green-themed post with a gentle reminder about alcohol and onion/garlic dangers" },

  // April
  { name: "National Pet Day", month: 4, day: 11, description: "Celebrates the joy pets bring to our lives", contentAngle: "Ask followers to share a photo of their pet — great for comments and engagement" },
  { name: "World Veterinary Day", month: 4, day: null, description: "Last Saturday in April — honors veterinary professionals worldwide", contentAngle: "Celebrate the team! Group photo, individual spotlights, or thank-you post from the practice" },
  { name: "Prevention of Cruelty to Animals Month", month: 4, day: null, description: "ASPCA's awareness month", contentAngle: "Highlight the practice's commitment to animal welfare or partner with a local shelter" },

  // May
  { name: "National Pet Month", month: 5, day: null, description: "US celebration of the human-animal bond", contentAngle: "Feature heartwarming client stories or showcase the range of species the practice sees" },
  { name: "National Rescue Dog Day", month: 5, day: 20, description: "Celebrates dogs rescued from shelters", contentAngle: "Feature team members' rescue pets or share a rescue patient success story" },
  { name: "Chip Your Pet Month", month: 5, day: null, description: "Promotes microchipping for pet identification", contentAngle: "Reminder post on why microchipping matters with a simple call-to-action to book the service" },

  // June
  { name: "National Microchipping Month", month: 6, day: null, description: "Dedicated month for microchip awareness", contentAngle: "Share a reunited-with-owner story or explain how microchipping works in simple terms" },
  { name: "Adopt a Shelter Cat Month", month: 6, day: null, description: "Encourages cat adoption from shelters", contentAngle: "Feature feline patients, share cat care tips, or partner with a local rescue" },
  { name: "National Pet Preparedness Month", month: 6, day: null, description: "Disaster preparedness for pet owners", contentAngle: "Share a simple emergency kit checklist for pet owners — highly shareable practical content" },

  // July
  { name: "4th of July Pet Safety", month: 7, day: 4, description: "Fireworks are highly stressful and dangerous for pets", contentAngle: "Pre-holiday safety post: firework anxiety, ID tags, keeping pets indoors — always gets engagement" },
  { name: "National Dog Photography Month", month: 7, day: null, description: "Celebrates pet photography", contentAngle: "Share tips for getting a great photo of your dog at home — and ask clients to share their best shots" },
  { name: "National Lost Pet Prevention Month", month: 7, day: null, description: "Focuses on keeping pets safe and identified", contentAngle: "Microchip reminder, ID tag check, and tips for keeping pets safely contained during summer" },

  // August
  { name: "International Cat Day", month: 8, day: 8, description: "Global celebration of cats", contentAngle: "Feature feline patients or share surprising cat health facts — great engagement day" },
  { name: "National Check the Chip Day", month: 8, day: 15, description: "Encourages pet owners to verify microchip registration", contentAngle: "Reminder to check that microchip info is current — simple, actionable, easy to share" },
  { name: "National Dog Day", month: 8, day: 26, description: "Celebrates dogs and encourages adoption", contentAngle: "Feature dog patients, ask followers to tag their dogs, or highlight canine care tips" },

  // September
  { name: "National Responsible Dog Ownership Month", month: 9, day: null, description: "AKC month promoting responsible dog ownership", contentAngle: "Share the pillars of responsible ownership: vet visits, training, nutrition, socialization" },
  { name: "Happy Cat Month", month: 9, day: null, description: "CFA's month dedicated to feline health and happiness", contentAngle: "Environmental enrichment tips, indoor cat wellness, or feature a senior cat patient" },
  { name: "Animal Pain Awareness Month", month: 9, day: null, description: "IVAPM awareness month for animal pain recognition", contentAngle: "Educational post on subtle signs of pain in pets — a hugely valuable and shareable topic" },

  // October
  { name: "Adopt a Shelter Dog Month", month: 10, day: null, description: "ASPCA month encouraging dog adoption", contentAngle: "Feature adopted patients or share the joys and tips of welcoming a rescue dog" },
  { name: "Pet Obesity Awareness Day", month: 10, day: null, description: "Second Wednesday of October", contentAngle: "Share the risks of pet obesity and practical tips for healthy weight — pair with a body condition score visual" },
  { name: "Halloween Pet Safety", month: 10, day: 31, description: "Candy and costumes pose hazards to pets", contentAngle: "Pre-Halloween safety post: xylitol in candy, costume safety, keeping pets calm — always gets shares" },
  { name: "National Cat Day", month: 10, day: 29, description: "Celebrates cats and promotes adoption", contentAngle: "Feature feline patients, fun cat facts, or ask followers to share their cats" },

  // November
  { name: "Adopt a Senior Pet Month", month: 11, day: null, description: "ASPCA month dedicated to senior pet adoption", contentAngle: "Feature a senior patient or highlight the rewards of adopting an older pet — deeply emotional content" },
  { name: "National Animal Shelter Appreciation Week", month: 11, day: null, description: "First full week of November", contentAngle: "Thank local shelter staff or share how the practice supports the rescue community" },
  { name: "Thanksgiving Pet Safety", month: 11, day: null, description: "Thanksgiving food hazards for pets", contentAngle: "Pre-holiday post on foods to keep away from pets — turkey bones, grapes, onions, xylitol" },

  // December
  { name: "National Cat Lovers Month", month: 12, day: null, description: "Whole month celebrating cats", contentAngle: "Feature a feline patient each week or share a month-long series of cat care tips" },
  { name: "Holiday Pet Safety Month", month: 12, day: null, description: "Whole month — holiday hazards for pets", contentAngle: "Decorations (tinsel, poinsettias), holiday food risks, travel tips — spread across multiple posts" },
  { name: "New Year's Eve Pet Safety", month: 12, day: 31, description: "Fireworks and celebrations can be stressful for pets", contentAngle: "End-of-year post on helping pets through fireworks — links naturally to a January fresh-start post" },
];

export function getAwarenessDaysForMonth(month: number): AwarenessDay[] {
  return AWARENESS_DAYS.filter((d) => d.month === month);
}
