import { Channel, Topic } from "./engine.types";

const RULES: [Topic, string[]][] = [
  [
    "Crash",
    [
      "crash",
      "closes",
      "closing",
      "force close",
      "stopped working",
      "not opening",
      "won't open",
      "doesn't open",
      "freez",
      "hang",
      "bug",
      "glitch",
      "error",
      "not working",
      "doesn't work",
    ],
  ],
  [
    "Login",
    [
      "login",
      "log in",
      "sign in",
      "signin",
      "otp",
      "password",
      "verification code",
      "account locked",
      "can't access my account",
    ],
  ],
  [
    "Payment",
    [
      "payment",
      "refund",
      "charged",
      "subscription",
      "billing",
      "money",
      "deducted",
      "premium",
      "purchase",
      "paid",
    ],
  ],
  [
    "Sync",
    [
      "sync",
      "backup",
      "restore",
      "cloud",
      "lost my data",
      "data lost",
      "lost data",
    ],
  ],
  [
    "Performance",
    [
      "slow",
      "lag",
      "loading",
      "battery",
      "heavy",
      "takes forever",
      "speed",
      "hangs",
    ],
  ],
  ["Ads", [" ads", "ads ", "advert", "advertisement", "too many ad"]],
  [
    "Feature request",
    [
      "please add",
      "add a ",
      "add an ",
      "wish",
      "would love",
      "feature",
      "option to",
      "dark mode",
      "should have",
      "missing",
      "request",
    ],
  ],
  [
    "Support",
    [
      "support",
      "customer care",
      "customer service",
      "no response",
      "no reply",
      "contact",
    ],
  ],
];

const BUSINESS_RULES: [Topic, string[]][] = [
  ["Wait time", ["wait", "waited", "queue", "late", "delay", "slow service"]],
  [
    "Staff",
    [
      "staff",
      "rude",
      "behaviour",
      "behavior",
      "doctor",
      "receptionist",
      "waiter",
      "manager",
    ],
  ],
  [
    "Price",
    ["price", "expensive", "overcharg", "costly", "cheap", "fees", "bill"],
  ],
  ["Cleanliness", ["clean", "dirty", "hygien", "smell", "washroom", "toilet"]],
  ["Booking", ["appointment", "booking", "book ", "reservation", "slot"]],
  [
    "Location",
    ["parking", "location", "address", "hard to find", "directions"],
  ],
  ["Quality", ["quality", "taste", "food", "treatment", "result", "product"]],
  ["Support", ["no response", "no reply", "call back", "phone", "not picking"]],
  ["Service", ["service", "experience", "helpful", "staff were"]],
];

export function keywordTopic(
  text: string,
  stars: number,
  channel: Channel = "google_play",
): Topic {
  const t = ` ${text.toLowerCase()} `;
  for (const [topic, words] of channel === "google_business"
    ? BUSINESS_RULES
    : RULES)
    if (words.some((w) => t.includes(w))) return topic;
  return stars >= 4 ? "Praise" : "Other";
}
