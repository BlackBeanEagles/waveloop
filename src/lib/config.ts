export const TARGET = 500;
export const CAMPAIGN_DAYS = 7;
export const BUDGET_INR = 2000;

export const WORKSHOP_TITLE = "Build Your First AI Project in 60 Minutes";

// Reward ladder: the ₹2,000 is spent here, not on ads.
export const REWARDS = [
  { refs: 1, label: "Priority seat + recording access" },
  { refs: 3, label: "Exclusive AI prompt pack + certificate badge" },
  { refs: 5, label: "1:1 project review with a NxtWave mentor" },
  { refs: 10, label: "Top-referrer prize pool (₹1,000 / ₹500 / ₹500)" },
];

export const CHANNELS = [
  "whatsapp_groups",
  "ambassador",
  "referral",
  "linkedin",
  "instagram",
  "email",
  "direct",
] as const;
export type Channel = (typeof CHANNELS)[number];

export const CHANNEL_LABEL: Record<string, string> = {
  whatsapp_groups: "WhatsApp groups",
  ambassador: "Campus ambassadors",
  referral: "Peer referrals",
  linkedin: "LinkedIn",
  instagram: "Instagram",
  email: "Email",
  direct: "Direct",
  whatsapp_bot: "WhatsApp bot",
};

// A/B test on the hero promise.
export const VARIANTS = {
  A: {
    headline: "Build your first AI project in 60 minutes.",
    sub: "Free live workshop for final-year engineers. Walk out with a working project for your resume.",
  },
  B: {
    headline: "Placements are coming. Does your resume have an AI project?",
    sub: "In 60 minutes you build one, live, for free, and add it to your resume the same day.",
  },
} as const;
export type Variant = keyof typeof VARIANTS;

export const BRANCHES = ["CSE", "IT", "ECE", "EEE", "Mechanical", "Civil", "AI/ML", "Data Science", "Other"];
export const YEARS = ["Final year (2027)", "Pre-final (2028)", "Graduated, job hunting"];

export const COLLEGES: { name: string; city: string; tier: number }[] = [
  { name: "JNTU Hyderabad", city: "Hyderabad", tier: 2 },
  { name: "CBIT Hyderabad", city: "Hyderabad", tier: 2 },
  { name: "VNR VJIET", city: "Hyderabad", tier: 2 },
  { name: "Vasavi College of Engineering", city: "Hyderabad", tier: 2 },
  { name: "MLR Institute of Technology", city: "Hyderabad", tier: 3 },
  { name: "Malla Reddy Engineering College", city: "Hyderabad", tier: 3 },
  { name: "GRIET", city: "Hyderabad", tier: 2 },
  { name: "Andhra University College of Engineering", city: "Visakhapatnam", tier: 2 },
  { name: "GITAM Visakhapatnam", city: "Visakhapatnam", tier: 2 },
  { name: "KL University", city: "Vijayawada", tier: 2 },
  { name: "VR Siddhartha Engineering College", city: "Vijayawada", tier: 2 },
  { name: "SRM Institute of Science and Technology", city: "Chennai", tier: 2 },
  { name: "Sathyabama Institute", city: "Chennai", tier: 3 },
  { name: "PSG College of Technology", city: "Coimbatore", tier: 2 },
  { name: "RV College of Engineering", city: "Bengaluru", tier: 2 },
  { name: "BMS College of Engineering", city: "Bengaluru", tier: 2 },
  { name: "Dayananda Sagar College", city: "Bengaluru", tier: 3 },
  { name: "PES University", city: "Bengaluru", tier: 2 },
  { name: "MIT Pune", city: "Pune", tier: 2 },
  { name: "Pune Institute of Computer Technology", city: "Pune", tier: 2 },
  { name: "Chandigarh University", city: "Mohali", tier: 3 },
  { name: "Lovely Professional University", city: "Phagwara", tier: 3 },
  { name: "KIIT Bhubaneswar", city: "Bhubaneswar", tier: 2 },
  { name: "Amity University Noida", city: "Noida", tier: 3 },
];

export function siteUrl() {
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;
  return (process.env.NEXT_PUBLIC_SITE_URL ?? (vercel ? `https://${vercel}` : "http://localhost:3000")).replace(/\/$/, "");
}

export const integrations = {
  claude: () => Boolean(process.env.ANTHROPIC_API_KEY),
  email: () => Boolean(process.env.RESEND_API_KEY),
  // Meta WhatsApp Cloud API: free, official; preferred over Twilio when both are set.
  metaWhatsApp: () => Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID),
  twilio: () => Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_WHATSAPP_FROM),
  hostedDb: () => Boolean(process.env.DATABASE_URL?.startsWith("libsql://")),
};
