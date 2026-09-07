import { db } from "@/lib/db";
import { authenticated, success } from "@/lib/http";
import { publicUser, serializeRecord } from "@/lib/serialize";
export const GET = authenticated(async (_request, user) => {
  const where = { userId: user.id };
  const [entries, habitLogs, studySessions, transactions, budgets, savings, dailyPlans] =
    await db.$transaction([
      db.entry.findMany({ where, orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }] }),
      db.habitLog.findMany({ where, orderBy: { date: "desc" } }),
      db.studySession.findMany({ where, orderBy: { date: "desc" } }),
      db.transaction.findMany({ where, orderBy: { date: "desc" } }),
      db.budget.findMany({ where, orderBy: { month: "desc" } }),
      db.savingGoal.findMany({ where }),
      db.dailyPlan.findMany({ where, orderBy: { date: "desc" } }),
    ]);
  return success({
    user: publicUser(user),
    entries: entries.map(serializeRecord),
    habitLogs: habitLogs.map(serializeRecord),
    studySessions: studySessions.map(serializeRecord),
    transactions: transactions.map(serializeRecord),
    budgets: budgets.map(serializeRecord),
    savings: savings.map(serializeRecord),
    dailyPlans: dailyPlans.map(serializeRecord),
  });
});
