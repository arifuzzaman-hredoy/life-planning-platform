export const roadmaps = [
  { slug: "academic", title: "Academic", categories: ["Academic", "Academic CGPA"] },
  {
    slug: "ielts-sat",
    title: "English / IELTS & SAT",
    categories: ["English / IELTS", "IELTS / English", "SAT Optional"],
  },
  { slug: "cloud-devops", title: "Cloud / DevOps", categories: ["Cloud / DevOps"] },
  { slug: "ai-automation", title: "AI Automation", categories: ["AI Automation"] },
  {
    slug: "portfolio-projects",
    title: "Portfolio / Projects",
    categories: ["Portfolio / Projects"],
  },
  { slug: "debate", title: "Debate", categories: ["Debate"] },
  {
    slug: "rover-scout",
    title: "Rover Scout",
    categories: ["Rover Scout", "Rover Scout / Volunteering"],
  },
  { slug: "olympiad-contest", title: "Olympiad / Contest", categories: ["Olympiad / Contest"] },
  { slug: "personal-skills", title: "Personal Skills", categories: ["Personal Skills"] },
  { slug: "country-strategy", title: "Country Strategy", categories: ["Country Strategy"] },
  { slug: "weekly-routine", title: "Weekly Routine", categories: ["Routine", "Weekly Routine"] },
  {
    slug: "final-identity",
    title: "My Identity & Rules",
    categories: ["Personal Direction", "Career Direction"],
  },
  { slug: "remove-from-life", title: "Remove From Life", categories: ["Personal Direction"] },
] as const;
export const progressStages = [
  "Not Started",
  "Planned",
  "Learning",
  "In Progress",
  "Running",
  "Building",
  "Testing",
  "Need Review",
  "Paused",
  "Completed",
  "Verified",
  "Case Study Done",
  "Archived",
  "Skipped",
  "Idea",
  "Planning",
  "Deployed",
];
export function stageStatus(stage: string): "planned" | "active" | "done" | "archived" {
  return ["Completed", "Verified", "Case Study Done", "Deployed"].includes(stage)
    ? "done"
    : ["Archived", "Skipped"].includes(stage)
      ? "archived"
      : ["Not Started", "Planned", "Idea", "Planning"].includes(stage)
        ? "planned"
        : "active";
}
export const stageProgress: Record<string, number> = {
  "Not Started": 0,
  Planned: 8,
  Learning: 22,
  "In Progress": 45,
  Running: 55,
  Building: 58,
  Testing: 74,
  "Need Review": 82,
  Paused: 35,
  Completed: 100,
  Verified: 100,
  "Case Study Done": 100,
  Archived: 100,
  Skipped: 0,
  Idea: 0,
  Planning: 8,
  Deployed: 100,
};
export function translateLabel(label: string, language = "en") {
  if (language !== "bn") return label;
  return (
    (
      {
        Overview: "এক নজরে",
        "Daily planner": "দৈনিক পরিকল্পনা",
        Tasks: "কাজ",
        Habits: "অভ্যাস",
        Goals: "লক্ষ্য",
        Learning: "শেখা",
        Career: "ক্যারিয়ার",
        Projects: "প্রজেক্ট",
        Finance: "অর্থ ব্যবস্থাপনা",
        Notes: "নোট",
        "Important dates": "গুরুত্বপূর্ণ সময়",
        Journal: "ডায়েরি",
        Insights: "বিশ্লেষণ",
        Settings: "সেটিংস",
        "AI Assistant": "AI সহকারী",
        "Document Vault": "ডকুমেন্ট ভল্ট",
        "Automation Hub": "অটোমেশন",
        "My Roadmaps": "আমার রোডম্যাপ",
        "Progress Center": "অগ্রগতি",
        "Monthly Review": "মাসিক পর্যালোচনা",
        "Backup & Restore": "ব্যাকআপ ও রিস্টোর",
        "Target Document": "লক্ষ্যের ডকুমেন্ট",
        Academic: "পড়াশোনা",
        "Personal Skills": "ব্যক্তিগত দক্ষতা",
        "Country Strategy": "দেশভিত্তিক পরিকল্পনা",
        "Weekly Routine": "সাপ্তাহিক রুটিন",
        "My Identity & Rules": "আমার পরিচয় ও নিয়ম",
        "Remove From Life": "জীবন থেকে বাদ দিতে চাই",
      } as Record<string, string>
    )[label] ?? label
  );
}
