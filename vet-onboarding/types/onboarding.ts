export interface ClientFormData {
  practiceName: string;
  contactName: string;
  location: string;
  practiceType: string;
  numVets: string;
  services: string[];
  mainGoal: string;
  challenge: string;
  budget: string;
  timeline: string;
  presence: string;
  notes: string;
}

export interface OnboardingPlan {
  welcome: string;
  whyItMatters: string;
  stats: Array<{ num: string; label: string }>;
  serviceStrategy: string;
  roadmap: Array<{ phase: string; title: string; actions: string[] }>;
  quickWins: string[];
  nextSteps: string[];
}
