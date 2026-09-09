import { z } from "zod";
import { entryKinds } from "./contracts";
import { isDateOnly } from "./dates";

export const dateOnly = z.string().refine(isDateOnly, "Use a valid date in YYYY-MM-DD format");
const text = z.string().trim().max(20000);
const title = z.string().trim().min(1, "Title is required").max(200);
const short = z.string().trim().max(200);
const url = z.union([
  z.literal(""),
  z
    .url()
    .max(2048)
    .refine((v) => /^https?:\/\//i.test(v), "Only HTTP and HTTPS links are allowed"),
]);
const time = z.union([z.literal(""), z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM")]);
const relation = z.string().min(1).max(100).nullable().default(null);
export const currencySchema = z
  .string()
  .regex(/^[A-Z]{3}$/, "Use a three-letter currency code")
  .refine((v) => {
    try {
      return Intl.supportedValuesOf("currency").includes(v);
    } catch {
      return ["BDT", "USD", "EUR", "GBP", "INR"].includes(v);
    }
  }, "Unsupported currency");
const amount = z
  .number()
  .finite()
  .min(0)
  .max(999999999999.99)
  .refine((n) => Math.abs(Math.round(n * 100) - n * 100) < 0.001, "Use at most two decimal places");
export const detailsSchema = z
  .object({
    frequency: z.enum(["daily", "weekly"]).optional(),
    target: z.number().int().min(1).max(1000).optional(),
    recurrence: z.enum(["none", "daily", "weekly", "monthly"]).optional(),
    time: time.optional(),
    resourceType: short.optional(),
    topic: short.optional(),
    resourceLinks: z.array(url).max(30).optional(),
    company: short.optional(),
    stage: short.optional(),
    role: short.optional(),
    skills: z.array(short).max(50).optional(),
    repositoryUrl: url.optional(),
    liveUrl: url.optional(),
    eventType: short.optional(),
    achievements: text.optional(),
    challenges: text.optional(),
    lessons: text.optional(),
    nextSteps: text.optional(),
    progressStage: short.optional(),
    stack: short.optional(),
    demoUrl: url.optional(),
    problem: text.optional(),
    solution: text.optional(),
    impact: text.optional(),
    provider: short.optional(),
    cost: short.optional(),
    validity: short.optional(),
    targetYear: short.optional(),
    proofType: short.optional(),
    difficulty: short.optional(),
    currentLevel: short.optional(),
    nextAction: text.optional(),
    habitTarget: short.optional(),
    reviewScore: z.number().int().min(1).max(10).optional(),
    improved: text.optional(),
    ignored: text.optional(),
    removeNext: text.optional(),
  })
  .strict();
const allowedDetails: Record<string, string[]> = {
  goal: [],
  task: ["recurrence", "time"],
  habit: ["frequency", "target"],
  learning: [
    "resourceType",
    "topic",
    "resourceLinks",
    "progressStage",
    "provider",
    "cost",
    "validity",
    "targetYear",
    "proofType",
    "currentLevel",
    "nextAction",
    "habitTarget",
  ],
  career: ["company", "stage", "role", "skills", "resourceLinks"],
  project: [
    "repositoryUrl",
    "liveUrl",
    "resourceLinks",
    "progressStage",
    "stack",
    "demoUrl",
    "problem",
    "solution",
    "impact",
    "targetYear",
    "difficulty",
  ],
  note: [],
  event: ["time", "eventType"],
  journal: [
    "achievements",
    "challenges",
    "lessons",
    "nextSteps",
    "reviewScore",
    "improved",
    "ignored",
    "removeNext",
  ],
};
export const entrySchema = z
  .object({
    kind: z.enum(entryKinds),
    title,
    notes: text.default(""),
    category: short.default(""),
    tags: z.array(z.string().trim().min(1).max(50)).max(30).default([]),
    status: z.enum(["planned", "active", "done", "archived"]).default("planned"),
    priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
    progress: z.number().int().min(0).max(100).default(0),
    startDate: dateOnly.nullable().default(null),
    targetDate: dateOnly.nullable().default(null),
    period: z.enum(["daily", "weekly", "monthly", "yearly", "long_term"]).default("long_term"),
    url: url.default(""),
    pinned: z.boolean().default(false),
    parentId: relation,
    projectId: relation,
    goalId: relation,
    details: detailsSchema.default({}),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.startDate && value.targetDate && value.targetDate < value.startDate)
      ctx.addIssue({
        code: "custom",
        path: ["targetDate"],
        message: "Target date must not precede start date",
      });
    for (const key of Object.keys(value.details))
      if (!allowedDetails[value.kind].includes(key))
        ctx.addIssue({
          code: "custom",
          path: ["details", key],
          message: `This field does not apply to ${value.kind}`,
        });
  });
export const entryPatchSchema = z
  .object({
    kind: z.enum(entryKinds).optional(),
    title: title.optional(),
    notes: text.optional(),
    category: short.optional(),
    tags: z.array(z.string().trim().min(1).max(50)).max(30).optional(),
    status: z.enum(["planned", "active", "done", "archived"]).optional(),
    priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
    progress: z.number().int().min(0).max(100).optional(),
    startDate: dateOnly.nullable().optional(),
    targetDate: dateOnly.nullable().optional(),
    period: z.enum(["daily", "weekly", "monthly", "yearly", "long_term"]).optional(),
    url: url.optional(),
    pinned: z.boolean().optional(),
    parentId: relation.removeDefault().optional(),
    projectId: relation.removeDefault().optional(),
    goalId: relation.removeDefault().optional(),
    details: detailsSchema.optional(),
  })
  .strict();
export const habitLogSchema = z
  .object({
    entryId: z.string().min(1).max(100),
    date: dateOnly,
    count: z.number().int().min(0).max(1000),
  })
  .strict();
export const studySessionSchema = z
  .object({
    entryId: z.string().min(1).max(100),
    date: dateOnly,
    minutes: z.number().int().min(1).max(1440),
    notes: text.default(""),
  })
  .strict();
export const transactionSchema = z
  .object({
    title,
    type: z.enum(["income", "expense"]),
    amount: amount.refine((n) => n > 0, "Amount must be positive"),
    category: title,
    date: dateOnly,
    currency: currencySchema.default("BDT"),
    notes: text.default(""),
  })
  .strict();
export const budgetSchema = z
  .object({
    category: title,
    month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
    amount,
    currency: currencySchema.default("BDT"),
  })
  .strict();
export const savingSchema = z
  .object({
    title,
    targetAmount: amount.refine((n) => n > 0, "Target must be positive"),
    savedAmount: amount.default(0),
    targetDate: dateOnly.nullable().default(null),
    currency: currencySchema.default("BDT"),
  })
  .strict();
// Optional PATCH fields must not retain creation defaults: in Zod 4, a default
// inside an optional field is still applied and can erase unrelated saved data.
export const transactionPatchSchema = z
  .object({
    title: title.optional(),
    type: transactionSchema.shape.type.optional(),
    amount: transactionSchema.shape.amount.optional(),
    category: title.optional(),
    date: dateOnly.optional(),
    currency: currencySchema.optional(),
    notes: text.optional(),
  })
  .strict();
export const budgetPatchSchema = z
  .object({
    category: title.optional(),
    month: budgetSchema.shape.month.optional(),
    amount: amount.optional(),
    currency: currencySchema.optional(),
  })
  .strict();
export const savingPatchSchema = z
  .object({
    title: title.optional(),
    targetAmount: savingSchema.shape.targetAmount.optional(),
    savedAmount: amount.optional(),
    targetDate: dateOnly.nullable().optional(),
    currency: currencySchema.optional(),
  })
  .strict();
export const dailyPlanSchema = z
  .object({
    date: dateOnly,
    priorities: z.array(z.string().trim().min(1).max(300)).max(10).default([]),
    schedule: text.default(""),
    notes: text.default(""),
    reflection: text.default(""),
  })
  .strict();
export const loginSchema = z
  .object({
    email: z
      .email()
      .max(254)
      .transform((v) => v.toLowerCase().trim()),
    password: z.string().min(1).max(256),
  })
  .strict();
export const passwordSchema = z
  .object({
    currentPassword: z.string().min(1).max(256),
    newPassword: z
      .string()
      .min(12, "Use at least 12 characters")
      .max(256)
      .refine(
        (v) => /[A-Za-z]/.test(v) && /[^A-Za-z]/.test(v),
        "Include letters and a number or symbol",
      ),
  })
  .strict();
export const profileSchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    timezone: z
      .string()
      .max(100)
      .refine((v) => {
        try {
          new Intl.DateTimeFormat("en", { timeZone: v });
          return true;
        } catch {
          return false;
        }
      }, "Unknown timezone")
      .optional(),
    currency: currencySchema.optional(),
  })
  .strict();
