import { z } from "zod";
import { MAX_ATTACHMENT_TEXT_CHARS } from "./chat-attachments";
export const featureText = z.string().trim().max(20000);
const short = z.string().trim().max(200);
export const vaultMetadataSchema = z
  .object({
    title: short.min(1),
    description: featureText.default(""),
    category: short.default(""),
    fileType: z.string().trim().min(1).max(80).default("document"),
    subjects: z.array(short.min(1)).max(30).default([]),
  })
  .strict();
export const vaultPatchSchema = z
  .object({
    title: short.min(1).optional(),
    description: featureText.optional(),
    category: short.optional(),
    fileType: z.string().trim().min(1).max(80).optional(),
    subjects: z.array(short.min(1)).max(30).optional(),
  })
  .strict();
export const aiModels = ["deepseek-v4-flash", "deepseek-v4-pro"] as const;
export const aiSettingsSchema = z
  .object({
    model: z.enum(aiModels),
    apiKey: z.string().trim().min(10).max(512).optional(),
    removeKey: z.boolean().optional(),
  })
  .strict();
export const contextModes = [
  "everything",
  "current_field",
  "all_files",
  "selected_files",
  "general",
] as const;
export const chatRequestSchema = z
  .object({
    threadId: z.string().min(1).max(100),
    message: z.string().trim().min(1).max(12000),
    contextMode: z.enum(contextModes).default("general"),
    category: short.default(""),
    selectedFileIds: z.array(z.string().min(1).max(100)).max(12).default([]),
    attachments: z
      .array(
        z
          .object({
            name: short,
            text: z.string().max(MAX_ATTACHMENT_TEXT_CHARS),
            sizeBytes: z.number().int().min(0).max(26214400),
          })
          .strict(),
      )
      .max(5)
      .default([]),
    autoExecute: z.boolean().default(false),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.contextMode === "general" && (data.selectedFileIds.length || data.attachments.length))
      ctx.addIssue({ code: "custom", message: "Choose a file context mode to share attachments" });
    if (data.contextMode === "current_field" && !data.category)
      ctx.addIssue({ code: "custom", message: "Choose a field for this context mode" });
  });
export const aiActionSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("create_note"),
      title: short.min(1),
      content: featureText.min(1),
      category: short.default(""),
      pinned: z.boolean().default(false),
    })
    .strict(),
  z
    .object({
      type: z.literal("update_file_metadata"),
      fileId: z.string().min(1).max(100),
      changes: vaultPatchSchema,
    })
    .strict(),
]);
export const aiReplySchema = z.object({
  reply: z.string().trim().min(1).max(24000),
  actions: z.array(aiActionSchema).max(5).default([]),
});
export const preferencesSchema = z
  .object({ language: z.enum(["en", "bn"]), theme: z.enum(["light", "dark"]) })
  .strict();

export const automationJobIds = [
  "daily_study_reminder",
  "night_review",
  "weekly_review",
  "backup_report",
  "devops_health",
  "ai_daily_planner",
  "certificate_classifier",
] as const;
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
export const automationSettingsSchema = z
  .object({
    enabled: z.boolean().default(false),
    dailyReminderTime: time.default("07:00"),
    nightReviewTime: time.default("22:00"),
    weeklyReviewDay: z.number().int().min(0).max(6).default(5),
    weeklyReviewTime: time.default("21:00"),
    enabledJobs: z
      .array(z.enum(automationJobIds))
      .max(7)
      .default([...automationJobIds]),
  })
  .strict();
