export const CLIENT_FOCUS_OPTIONS = [
  "More new clients",
  "Higher-margin services",
  "Both",
] as const;

export const BOOKING_AVAILABILITY_OPTIONS = [
  "Available within 48hrs",
  "1 week out",
  "2 weeks out",
  "3+ weeks out — near capacity",
] as const;

export const DIFFERENTIATOR_OPTIONS = [
  "Fear-Free certified",
  "Exotic animal specialist",
  "Holistic / integrative medicine",
  "Advanced surgery / orthopaedics",
  "Emergency & urgent care",
  "AAHA accredited",
  "Multilingual staff",
  "Friendliest neighbourhood clinic",
  "Other",
] as const;

export const AVG_TRANSACTION_VALUE_OPTIONS = [
  "Under $150",
  "$150–$300",
  "$300–$500",
  "$500+",
  "Unknown",
] as const;

export const CUSTOMER_LTV_OPTIONS = [
  "Under $500",
  "$500–$1,500",
  "$1,500–$3,000",
  "$3,000+",
  "Unknown",
] as const;

export const GOOGLE_RATING_OPTIONS = [
  "Under 3.5",
  "3.5–3.9",
  "4.0–4.4",
  "4.5–4.9",
  "5.0 / very few reviews",
] as const;

export const GOOGLE_REVIEW_COUNT_OPTIONS = [
  "Fewer than 25",
  "25–100",
  "100–500",
  "500+",
] as const;

export const REVIEW_RESPONSE_OPTIONS = [
  "Yes — always",
  "Sometimes",
  "Rarely",
  "Never",
] as const;

export const YES_NO_UNSURE_OPTIONS = ["Yes", "No", "Unsure"] as const;

export const ONLINE_BOOKING_OPTIONS = [
  "Yes — prominent",
  "Yes — but hard to find",
  "No — phone only",
] as const;

export const PRACTICE_SOFTWARE_OPTIONS = [
  "Vetstoria",
  "EasyVet",
  "Covetrus Pulse",
  "AVImark",
  "Cornerstone",
  "ImproMed",
  "Other",
  "None / Unknown",
] as const;

export const CLINIC_SETTING_OPTIONS = ["Urban", "Suburban", "Rural"] as const;

export const COMPETITOR_TYPE_OPTIONS = [
  "Corporate chain (VCA, Banfield, BluePearl)",
  "Other independent clinics",
  "Low-cost / high-volume clinic",
  "Emergency-only centre",
  "Mobile vet services",
] as const;

export const COMPETITORS_ADS_OPTIONS = ["Yes", "No", "Unsure"] as const;

export const COMPETITORS_SOCIAL_OPTIONS = [
  "Yes — actively",
  "Somewhat",
  "No",
] as const;

export const MARKET_GAP_OPTIONS = [
  "Better availability",
  "Fear-free / low-stress handling",
  "More transparent pricing",
  "Better online reviews",
  "Exotic/specialist services",
  "Stronger social presence",
  "Easier online booking",
] as const;

export const DISCOVERY_STEPS = [
  "Capacity & Practice DNA",
  "Reputation & Digital Audit",
  "Competitive Landscape",
] as const;

export const INITIAL_DISCOVERY_FORM = {
  clientFocus: "",
  bookingAvailability: "",
  differentiators: [] as string[],
  differentiatorOther: "",
  avgTransactionValue: "",
  customerLifetimeValue: "",
  googleRating: "",
  googleReviewCount: "",
  reviewResponseHabit: "",
  mobileFriendly: "",
  onlineBooking: "",
  practiceSoftware: "",
  clinicSetting: "",
  competitorTypes: [] as string[],
  competitorsRunningAds: "",
  competitorsSocialActive: "",
  marketGaps: [] as string[],
  competitorNames: "",
};
