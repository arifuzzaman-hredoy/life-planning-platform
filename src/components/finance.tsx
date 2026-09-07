"use client";
import { useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Pencil, Plus, Save, Trash2, Wallet } from "lucide-react";
import type { Budget, SavingGoal, Transaction } from "@/lib/contracts";
import { dateLabel, money, today, words } from "@/lib/client";
import { useWorkspace } from "./workspace";
import { PageHeading } from "./entry-collection";
import { Stat } from "./dashboard";
import { Button, Empty, ErrorMessage, Field, Modal, Progress, Section } from "./ui";
type FinanceEditor =
  | { kind: "transactions"; item?: Transaction }
  | { kind: "budgets"; item?: Budget }
  | { kind: "savings"; item?: SavingGoal };

export function Finance() {
  const { data } = useWorkspace();
  const [month, setMonth] = useState(today(data.user.timezone).slice(0, 7));
  const [currency, setCurrency] = useState(data.user.currency);
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");
  const [editor, setEditor] = useState<FinanceEditor | null>(null);
  const currencies = Array.from(
    new Set([
      data.user.currency,
      ...data.transactions.map((item) => item.currency),
      ...data.budgets.map((item) => item.currency),
      ...data.savings.map((item) => item.currency),
    ]),
  );
  const transactions = data.transactions.filter(
    (item) => item.date.startsWith(month) && item.currency === currency,
  );
  const income = transactions
    .filter((item) => item.type === "income")
    .reduce((sum, item) => sum + item.amount, 0);
  const expenses = transactions
    .filter((item) => item.type === "expense")
    .reduce((sum, item) => sum + item.amount, 0);
  const filtered = transactions
    .filter(
      (item) =>
        (type === "all" || item.type === type) &&
        `${item.title} ${item.category} ${item.notes}`.toLowerCase().includes(query.toLowerCase()),
    )
    .sort((a, b) => b.date.localeCompare(a.date));
  const budgets = data.budgets.filter((item) => item.month === month && item.currency === currency);
  const savings = data.savings.filter((item) => item.currency === currency);
  return (
    <>
      <PageHeading
        eyebrow="A clearer picture"
        title="Finance"
        description="Track what comes in, what goes out, and what you are working toward."
        action={
          <Button onClick={() => setEditor({ kind: "transactions" })}>
            <Plus size={17} />
            New transaction
          </Button>
        }
      />
      <div className="finance-period">
        <Field label="Month">
          <input
            type="month"
            required
            value={month}
            onChange={(e) => {
              if (e.target.value) setMonth(e.target.value);
            }}
          />
        </Field>
        <Field label="Currency">
          <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
            {currencies.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </Field>
        <p className="muted">
          Amounts are shown in their recorded currency. No exchange conversion is applied.
        </p>
      </div>
      <div className="stats-grid finance-stats">
        <Stat
          label="Money in"
          value={money(income, currency)}
          hint="Income recorded this month"
          icon={ArrowDownLeft}
        />
        <Stat
          label="Money out"
          value={money(expenses, currency)}
          hint="Expenses recorded this month"
          icon={ArrowUpRight}
          tone="amber"
        />
        <Stat
          label="Monthly balance"
          value={money(income - expenses, currency)}
          hint="Recorded income minus expenses"
          icon={Wallet}
          tone="blue"
        />
      </div>
      <div className="finance-grid">
        <Section title="Transactions">
          <div className="finance-filters">
            <input
              aria-label="Search transactions"
              placeholder="Search transactions…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <select
              aria-label="Transaction type"
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              <option value="all">All types</option>
              <option value="income">Income</option>
              <option value="expense">Expenses</option>
            </select>
          </div>
          {filtered.length ? (
            <div className="transaction-list">
              {filtered.map((item) => (
                <button
                  key={item.id}
                  className="transaction-row"
                  onClick={() => setEditor({ kind: "transactions", item })}
                >
                  <span className={`transaction-symbol ${item.type}`}>
                    {item.type === "income" ? (
                      <ArrowDownLeft size={19} />
                    ) : (
                      <ArrowUpRight size={19} />
                    )}
                  </span>
                  <span className="transaction-description">
                    <strong>{item.title}</strong>
                    <small>
                      {item.category} · {dateLabel(item.date)}
                    </small>
                  </span>
                  <strong className={item.type === "income" ? "income-text" : ""}>
                    {item.type === "income" ? "+" : "−"}
                    {money(item.amount, currency)}
                  </strong>
                  <Pencil size={14} />
                </button>
              ))}
            </div>
          ) : (
            <Empty
              title="A fresh financial picture"
              onAdd={() => setEditor({ kind: "transactions" })}
              action="Add a transaction"
            >
              No transactions match this month and these filters. Record an income or expense to
              begin.
            </Empty>
          )}
        </Section>
        <div>
          <Section
            title="Category budgets"
            action={
              <button className="text-link" onClick={() => setEditor({ kind: "budgets" })}>
                <Plus size={15} />
                Add
              </button>
            }
          >
            {budgets.length ? (
              <div className="budget-list">
                {budgets.map((item) => {
                  const spent = transactions
                    .filter(
                      (t) =>
                        t.type === "expense" &&
                        t.category.toLowerCase() === item.category.toLowerCase(),
                    )
                    .reduce((sum, t) => sum + t.amount, 0);
                  return (
                    <button
                      className="budget-item"
                      key={item.id}
                      onClick={() => setEditor({ kind: "budgets", item })}
                    >
                      <div>
                        <strong>{item.category}</strong>
                        <Pencil size={14} />
                      </div>
                      <Progress
                        value={item.amount ? (spent / item.amount) * 100 : spent ? 100 : 0}
                        label={`${money(spent, currency)} / ${money(item.amount, currency)}`}
                      />
                      <small className={spent > item.amount ? "overdue" : "muted"}>
                        {spent > item.amount
                          ? `${money(spent - item.amount, currency)} over budget`
                          : `${money(item.amount - spent, currency)} remaining`}
                      </small>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="inline-empty">
                <p>
                  Set a monthly limit for a spending category. Use the same category in your
                  transactions.
                </p>
                <button className="text-link" onClick={() => setEditor({ kind: "budgets" })}>
                  Create a budget <Plus size={14} />
                </button>
              </div>
            )}
          </Section>
          <Section
            title="Saving for something"
            action={
              <button className="text-link" onClick={() => setEditor({ kind: "savings" })}>
                <Plus size={15} />
                Add
              </button>
            }
          >
            {savings.length ? (
              savings.map((item) => (
                <button
                  className="saving-item"
                  key={item.id}
                  onClick={() => setEditor({ kind: "savings", item })}
                >
                  <div>
                    <strong>{item.title}</strong>
                    <Pencil size={14} />
                  </div>
                  <Progress
                    value={(item.savedAmount / item.targetAmount) * 100}
                    label={`${money(item.savedAmount, currency)} / ${money(item.targetAmount, currency)}`}
                  />
                  <small>
                    {item.targetDate ? `Target ${dateLabel(item.targetDate)}` : "Set your own pace"}
                  </small>
                </button>
              ))
            ) : (
              <div className="inline-empty">
                <p>Start an emergency fund, plan a trip, or save for your next big step.</p>
                <button className="text-link" onClick={() => setEditor({ kind: "savings" })}>
                  Create a savings goal <Plus size={14} />
                </button>
              </div>
            )}
            <p className="section-footnote">
              Savings balances are recorded manually and do not change when you add transactions.
            </p>
          </Section>
        </div>
      </div>
      {editor && (
        <FinanceForm
          editor={editor}
          month={month}
          currency={currency}
          close={() => setEditor(null)}
        />
      )}
    </>
  );
}

function FinanceForm({
  editor,
  month,
  currency,
  close,
}: {
  editor: FinanceEditor;
  month: string;
  currency: string;
  close: () => void;
}) {
  const { data, mutate, notify } = useWorkspace();
  const item = editor.item;
  const kind = editor.kind;
  const transaction = editor.kind === "transactions" ? editor.item : undefined;
  const budget = editor.kind === "budgets" ? editor.item : undefined;
  const saving = editor.kind === "savings" ? editor.item : undefined;
  const [title, setTitle] = useState(transaction?.title ?? saving?.title ?? "");
  const [category, setCategory] = useState(transaction?.category ?? budget?.category ?? "");
  const [type, setType] = useState(transaction?.type ?? "expense");
  const [amount, setAmount] = useState(
    transaction?.amount?.toString() ?? budget?.amount?.toString() ?? "",
  );
  const [date, setDate] = useState(transaction?.date ?? today(data.user.timezone));
  const [selectedMonth, setMonth] = useState(budget?.month ?? month);
  const [selectedCurrency, setCurrency] = useState(item?.currency ?? currency);
  const [notes, setNotes] = useState(transaction?.notes ?? "");
  const [target, setTarget] = useState(saving?.targetAmount?.toString() ?? "");
  const [saved, setSaved] = useState(saving?.savedAmount?.toString() ?? "0");
  const [targetDate, setTargetDate] = useState(saving?.targetDate ?? "");
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const label =
    kind === "transactions" ? "transaction" : kind === "budgets" ? "budget" : "savings goal";
  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const payload =
      kind === "transactions"
        ? { title, type, amount: Number(amount), category, date, currency: selectedCurrency, notes }
        : kind === "budgets"
          ? { category, month: selectedMonth, amount: Number(amount), currency: selectedCurrency }
          : {
              title,
              targetAmount: Number(target),
              savedAmount: Number(saved),
              targetDate: targetDate || null,
              currency: selectedCurrency,
            };
    try {
      await mutate(`/api/${kind}${item ? `/${item.id}` : ""}`, item ? "PATCH" : "POST", payload);
      notify(`${words(label)} saved.`);
      close();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    setBusy(true);
    setError("");
    try {
      await mutate(`/api/${kind}/${item!.id}`, "DELETE");
      notify(`${words(label)} deleted.`);
      close();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title={`${item ? "Edit" : "New"} ${label}`} close={busy ? () => undefined : close}>
      <form onSubmit={save}>
        <div className="modal-body form-grid">
          {kind !== "budgets" && (
            <Field label="Title" wide>
              <input
                autoFocus
                required
                maxLength={200}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={
                  kind === "savings"
                    ? "Emergency fund, travel, a new laptop…"
                    : "What was this for?"
                }
              />
            </Field>
          )}
          {kind === "transactions" && (
            <Field label="Type">
              <select
                value={type}
                onChange={(e) => setType(e.target.value as "income" | "expense")}
              >
                <option value="expense">Expense</option>
                <option value="income">Income</option>
              </select>
            </Field>
          )}
          <Field label="Currency">
            <input
              required
              minLength={3}
              maxLength={3}
              value={selectedCurrency}
              onChange={(e) => setCurrency(e.target.value.toUpperCase())}
              placeholder="BDT"
              list="finance-currencies"
            />
            <datalist id="finance-currencies">
              {["BDT", "USD", "EUR", "GBP", "INR"].map((code) => (
                <option key={code}>{code}</option>
              ))}
            </datalist>
          </Field>
          {kind !== "savings" ? (
            <>
              <Field label="Category">
                <input
                  required
                  maxLength={200}
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="Food, transport, salary…"
                  list="finance-categories"
                />
                <datalist id="finance-categories">
                  {Array.from(
                    new Set([
                      ...data.transactions.map((t) => t.category),
                      ...data.budgets.map((b) => b.category),
                    ]),
                  ).map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </datalist>
              </Field>
              <Field label={kind === "budgets" ? "Monthly limit" : "Amount"}>
                <input
                  type="number"
                  required
                  min={kind === "budgets" ? 0 : 0.01}
                  max={999999999999.99}
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </Field>
              {kind === "budgets" ? (
                <Field label="Month">
                  <input
                    type="month"
                    required
                    value={selectedMonth}
                    onChange={(e) => setMonth(e.target.value)}
                  />
                </Field>
              ) : (
                <>
                  <Field label="Date">
                    <input
                      type="date"
                      required
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                    />
                  </Field>
                  <Field label="Notes" wide>
                    <textarea
                      rows={3}
                      maxLength={20000}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                    />
                  </Field>
                </>
              )}
            </>
          ) : (
            <>
              <Field label="Target amount">
                <input
                  type="number"
                  required
                  min={0.01}
                  max={999999999999.99}
                  step="0.01"
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                />
              </Field>
              <Field label="Saved so far" hint="Update this balance as your savings grow.">
                <input
                  type="number"
                  required
                  min={0}
                  max={999999999999.99}
                  step="0.01"
                  value={saved}
                  onChange={(e) => setSaved(e.target.value)}
                />
              </Field>
              <Field label="Target date (optional)">
                <input
                  type="date"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                />
              </Field>
            </>
          )}
          <div className="full">
            <ErrorMessage error={error} />
            {deleting && (
              <div className="delete-confirm">
                <p>Permanently delete this {label}?</p>
                <Button className="danger" busy={busy} onClick={remove}>
                  Delete permanently
                </Button>
                <Button className="ghost" onClick={() => setDeleting(false)}>
                  Keep it
                </Button>
              </div>
            )}
          </div>
        </div>
        <footer className="modal-footer">
          {item && (
            <Button className="ghost danger-text" onClick={() => setDeleting(true)}>
              <Trash2 size={16} />
              Delete
            </Button>
          )}
          <div className="spacer" />
          <Button className="secondary" disabled={busy} onClick={close}>
            Cancel
          </Button>
          <Button type="submit" busy={busy}>
            <Save size={16} />
            Save {label}
          </Button>
        </footer>
      </form>
    </Modal>
  );
}
