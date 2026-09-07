export const entryKinds = [
  "goal",
  "task",
  "habit",
  "learning",
  "career",
  "project",
  "note",
  "event",
  "journal",
] as const;
export type EntryKind = (typeof entryKinds)[number];
export type EntryStatus = "planned" | "active" | "done" | "archived";
export type Priority = "low" | "medium" | "high" | "urgent";
export type Period = "daily" | "weekly" | "monthly" | "yearly" | "long_term";
export type EntryDetails = {
  frequency?: "daily" | "weekly";
  target?: number;
  recurrence?: "none" | "daily" | "weekly" | "monthly";
  time?: string;
  resourceType?: string;
  topic?: string;
  resourceLinks?: string[];
  company?: string;
  stage?: string;
  role?: string;
  skills?: string[];
  repositoryUrl?: string;
  liveUrl?: string;
  eventType?: string;
  achievements?: string;
  challenges?: string;
  lessons?: string;
  nextSteps?: string;
};
export interface Entry {
  id: string;
  kind: EntryKind;
  title: string;
  notes: string;
  category: string;
  tags: string[];
  status: EntryStatus;
  priority: Priority;
  progress: number;
  startDate: string | null;
  targetDate: string | null;
  period: Period;
  url: string;
  pinned: boolean;
  parentId: string | null;
  projectId: string | null;
  goalId: string | null;
  details: EntryDetails;
  createdAt: string;
  updatedAt: string;
}
export type EntryInput = Omit<Entry, "id" | "createdAt" | "updatedAt">;
export interface HabitLog {
  id: string;
  entryId: string;
  date: string;
  count: number;
}
export interface StudySession {
  id: string;
  entryId: string;
  date: string;
  minutes: number;
  notes: string;
}
export interface Transaction {
  id: string;
  title: string;
  type: "income" | "expense";
  amount: number;
  category: string;
  date: string;
  currency: string;
  notes: string;
}
export interface Budget {
  id: string;
  category: string;
  month: string;
  amount: number;
  currency: string;
}
export interface SavingGoal {
  id: string;
  title: string;
  targetAmount: number;
  savedAmount: number;
  targetDate: string | null;
  currency: string;
}
export interface DailyPlan {
  id: string;
  date: string;
  priorities: string[];
  schedule: string;
  notes: string;
  reflection: string;
}
export interface PublicUser {
  id: string;
  name: string;
  email: string;
  timezone: string;
  currency: string;
  mustChangePassword: boolean;
}
export interface Workspace {
  user: PublicUser;
  entries: Entry[];
  habitLogs: HabitLog[];
  studySessions: StudySession[];
  transactions: Transaction[];
  budgets: Budget[];
  savings: SavingGoal[];
  dailyPlans: DailyPlan[];
}
export type ApiResponse<T> = { data: T } | { error: string };
