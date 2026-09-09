import { z } from "zod";
import { db } from "@/lib/db";
import { authenticated, readJson, success } from "@/lib/http";
import { automationJobIds, automationSettingsSchema } from "@/lib/feature-validation";
import { automationJobs, runAutomation } from "@/lib/automation";
export const GET = authenticated(async (_request, user) => {
  const [settings, runs, notifications] = await Promise.all([
    db.automationSettings.findUnique({ where: { userId: user.id } }),
    db.automationRun.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 60,
    }),
    db.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);
  return success({
    settings: automationSettingsSchema.parse(settings?.settings ?? {}),
    jobs: automationJobs,
    runs,
    notifications,
    schedulerConfigured: Boolean(process.env.APP_CRON_SECRET),
  });
});
export const PUT = authenticated(async (request, user) => {
  const settings = await readJson(request, automationSettingsSchema);
  await db.automationSettings.upsert({
    where: { userId: user.id },
    create: { userId: user.id, settings },
    update: { settings },
  });
  return success(settings);
});
export const POST = authenticated(async (request, user) => {
  const { jobId } = await readJson(
    request,
    z.object({ jobId: z.enum([...automationJobIds, "all", "test_notification"]) }).strict(),
  );
  if (jobId === "test_notification")
    return success(
      await db.notification.create({
        data: {
          userId: user.id,
          title: "Test notification",
          message: "Your in-app notifications are working.",
        },
      }),
    );
  const result = [];
  for (const id of jobId === "all" ? automationJobIds : [jobId])
    result.push(await runAutomation(user.id, id));
  return success(result);
});
