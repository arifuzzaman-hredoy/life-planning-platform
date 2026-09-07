import {
  LayoutDashboard,
  Target,
  CheckSquare2,
  CalendarDays,
  Repeat2,
  BookOpen,
  BriefcaseBusiness,
  FolderKanban,
  Wallet,
  StickyNote,
  CalendarClock,
  NotebookPen,
  ChartNoAxesCombined,
  Settings,
} from "lucide-react";
import type { EntryKind } from "./contracts";

export const modules = [
  {
    slug: "dashboard",
    label: "Overview",
    icon: LayoutDashboard,
    group: "Your day",
    description: "A little clarity for everything that matters.",
  },
  {
    slug: "planner",
    label: "Daily planner",
    icon: CalendarDays,
    group: "Your day",
    description: "Make room for your priorities. Leave space for life.",
  },
  {
    slug: "tasks",
    label: "Tasks",
    kind: "task",
    icon: CheckSquare2,
    group: "Your day",
    description: "Turn your plans into small, achievable steps.",
  },
  {
    slug: "habits",
    label: "Habits",
    kind: "habit",
    icon: Repeat2,
    group: "Your day",
    description: "Small actions. Meaningful consistency.",
  },
  {
    slug: "goals",
    label: "Goals",
    kind: "goal",
    icon: Target,
    group: "Grow & build",
    description: "Give your ambitions a direction and a next step.",
  },
  {
    slug: "learning",
    label: "Learning",
    kind: "learning",
    icon: BookOpen,
    group: "Grow & build",
    description: "Organize what you learn and track time spent practicing.",
  },
  {
    slug: "career",
    label: "Career",
    kind: "career",
    icon: BriefcaseBusiness,
    group: "Grow & build",
    description: "Build skills, explore opportunities, and move forward.",
  },
  {
    slug: "projects",
    label: "Projects",
    kind: "project",
    icon: FolderKanban,
    group: "Grow & build",
    description: "Move your ideas from a first step to a finished project.",
  },
  {
    slug: "finance",
    label: "Finance",
    icon: Wallet,
    group: "Life & reflection",
    description: "Know where your money goes and what you are saving for.",
  },
  {
    slug: "notes",
    label: "Notes",
    kind: "note",
    icon: StickyNote,
    group: "Life & reflection",
    description: "A quiet home for your ideas, references, and reminders.",
  },
  {
    slug: "timeline",
    label: "Important dates",
    kind: "event",
    icon: CalendarClock,
    group: "Life & reflection",
    description: "Keep the moments and deadlines that matter in sight.",
  },
  {
    slug: "journal",
    label: "Journal",
    kind: "journal",
    icon: NotebookPen,
    group: "Life & reflection",
    description: "Notice your progress. Learn from the difficult days.",
  },
  {
    slug: "analytics",
    label: "Insights",
    icon: ChartNoAxesCombined,
    group: "Workspace",
    description: "Understand your patterns using the progress you record.",
  },
  {
    slug: "settings",
    label: "Settings",
    icon: Settings,
    group: "Workspace",
    description: "Make this workspace yours.",
  },
] satisfies {
  slug: string;
  label: string;
  kind?: EntryKind;
  icon: typeof Target;
  group: string;
  description: string;
}[];
export function kindLabel(kind: EntryKind) {
  return {
    goal: "goal",
    task: "task",
    habit: "habit",
    learning: "learning item",
    career: "career item",
    project: "project",
    note: "note",
    event: "important date",
    journal: "journal entry",
  }[kind];
}
