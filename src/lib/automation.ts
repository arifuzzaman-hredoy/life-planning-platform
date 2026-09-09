import { randomUUID } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "./db";
import { todayInTimezone } from "./dates";
import { automationJobIds, automationSettingsSchema } from "./feature-validation";
import { ApiError } from "./errors";
export const automationJobs = [
  {
    id: "daily_study_reminder",
    title: "Daily study reminder",
    description: "A focus reminder drawn from your active learning and tasks.",
    cadence: "Daily",
  },
  {
    id: "night_review",
    title: "Night review",
    description: "Reflect on today and choose tomorrow’s priorities.",
    cadence: "Daily",
  },
  {
    id: "weekly_review",
    title: "Weekly review draft",
    description: "Create a review note using your workspace progress and proof counts.",
    cadence: "Weekly",
  },
  {
    id: "backup_report",
    title: "Backup readiness report",
    description: "Report your record and file counts before a backup.",
    cadence: "Daily at 23:00",
  },
  {
    id: "devops_health",
    title: "Application health check",
    description: "Verify that this application can read its database.",
    cadence: "Every 30 minutes",
  },
  {
    id: "ai_daily_planner",
    title: "Daily plan generator",
    description: "Create a practical plan from current priorities using built-in rules.",
    cadence: "Daily at 07:15",
  },
  {
    id: "certificate_classifier",
    title: "File organization review",
    description: "Find uploads that need a title, description or category.",
    cadence: "Every 2 hours",
  },
] as const;
export function dueAutomationJobs(raw: unknown, timezone: string, now = new Date()) {
  const settings = automationSettingsSchema.parse(raw);
  if (!settings.enabled) return [];
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(now);
  const date = todayInTimezone(timezone, now);
  const weekday = new Date(date + "T12:00:00Z").getUTCDay();
  const minutes = Number(parts.slice(0, 2)) * 60 + Number(parts.slice(3, 5));
  const times: Record<string, string> = {
    daily_study_reminder: settings.dailyReminderTime,
    night_review: settings.nightReviewTime,
    weekly_review: settings.weeklyReviewTime,
    backup_report: "23:00",
    ai_daily_planner: "07:15",
  };
  return settings.enabledJobs.flatMap<{ jobId: string; slot: string }>((jobId) => {
    if (jobId === "weekly_review" && weekday !== settings.weeklyReviewDay) return [];
    if (jobId === "devops_health" || jobId === "certificate_classifier") {
      const interval = jobId === "devops_health" ? 30 : 120;
      return [{ jobId, slot: date + "/" + Math.floor(minutes / interval) }];
    }
    return parts >= times[jobId] ? [{ jobId, slot: date }] : [];
  });
}
export async function runAutomation(
  userId: string,
  jobId: string,
  slot = "manual/" + randomUUID(),
) {
  if (!(automationJobIds as readonly string[]).includes(jobId))
    throw new ApiError(400, "Unknown automation");
  return db.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"automation:" + userId}))`;
      const old = await tx.automationRun.findUnique({
        where: { userId_jobId_slot: { userId, jobId, slot } },
      });
      if (old) return old;
      const owner = await tx.user.findUniqueOrThrow({
        where: { id: userId },
        select: { timezone: true },
      });
      const date = todayInTimezone(owner.timezone);
      const entries = await tx.entry.findMany({
        where: {
          userId,
          status: { in: ["planned", "active"] },
          kind: { in: ["goal", "task", "learning", "project"] },
        },
        orderBy: [{ pinned: "desc" }, { targetDate: "asc" }, { updatedAt: "desc" }],
        select: { title: true, kind: true, progress: true, priority: true },
        take: 30,
      });
      const priorities = [...entries]
        .sort(
          (a, b) =>
            (({ urgent: 0, high: 1, medium: 2, low: 3 })[a.priority as "high"] ?? 3) -
            ({ urgent: 0, high: 1, medium: 2, low: 3 }[b.priority as "high"] ?? 3),
        )
        .slice(0, 5);
      const focus =
        priorities
          .map((entry, index) => `${index + 1}. ${entry.title} (${entry.progress}%)`)
          .join("\n") || "Add a goal or learning item to personalize your next plan.";
      let summary = "",
        status = "success";
      let details: Prisma.InputJsonObject = {};
      if (jobId === "daily_study_reminder") summary = "আজকের focus / Today's focus\n" + focus;
      if (jobId === "night_review")
        summary =
          "আজ কী এগিয়েছে? কী শিখলেন? আগামীকালের তিনটি গুরুত্বপূর্ণ কাজ বেছে নিন।\nReview your progress, lessons and tomorrow's top three priorities.";
      if (jobId === "devops_health") {
        await tx.$queryRaw`SELECT 1`;
        summary = "Application and database connection are healthy.";
      }
      if (jobId === "backup_report") {
        const [records, files] = await Promise.all([
          tx.entry.count({ where: { userId } }),
          tx.vaultFile.count({ where: { userId } }),
        ]);
        summary = `Backup readiness: ${records} planning records and ${files} stored files. This report checks counts; it does not perform a backup. Use Backup & Restore for a personal export.`;
        details = { records, files };
      }
      if (jobId === "certificate_classifier") {
        const missing = await tx.vaultFile.findMany({
          where: {
            userId,
            OR: [
              { description: "" },
              { category: "" },
              { title: { contains: "untitled", mode: "insensitive" } },
            ],
          },
          select: { id: true, title: true },
          take: 50,
        });
        summary = missing.length
          ? `${missing.length} files need details:\n${missing.map((file) => "• " + file.title).join("\n")}`
          : "Your uploaded files have titles, categories and descriptions.";
        status = missing.length ? "warning" : "success";
        details = { fileIds: missing.map((file) => file.id) };
      }
      if (jobId === "weekly_review" || jobId === "ai_daily_planner") {
        const weekly = jobId === "weekly_review";
        const title = `${weekly ? "Weekly review draft" : "Daily plan"} — ${date}`;
        const content = weekly
          ? `Current priorities\n${focus}\n\nWhat improved?\nWhat did I complete?\nWhich proof is missing?\nWhat should I focus on next week?\nWhat distraction should I remove?`
          : `Today's priorities\n${focus}\n\nChoose one focused block for each priority. Keep time for rest, review and academic work.\n\nCreated from your saved priorities using rules; no AI API was called.`;
        const note = await tx.entry.create({
          data: {
            userId,
            kind: "note",
            title,
            notes: content,
            category: weekly ? "Review Templates" : "Routine",
            tags: ["automation"],
            period: weekly ? "weekly" : "daily",
          },
        });
        summary = `${title} is ready in Notes.`;
        details = { noteId: note.id };
      }
      const run = await tx.automationRun.create({
        data: { userId, jobId, slot, status, summary, details },
      });
      if (jobId !== "devops_health")
        await tx.notification.create({
          data: {
            userId,
            jobId,
            title: automationJobs.find((job) => job.id === jobId)!.title,
            message: summary,
          },
        });
      return run;
    },
    { timeout: 30000 },
  );
}
export async function runDueAutomations(now = new Date()) {
  const configured = await db.automationSettings.findMany({
    include: { user: { select: { timezone: true } } },
  });
  let count = 0;
  for (const row of configured)
    for (const due of dueAutomationJobs(row.settings, row.user.timezone, now)) {
      await runAutomation(row.userId, due.jobId, due.slot);
      count++;
    }
  return { checked: configured.length, scheduledSlots: count };
}
