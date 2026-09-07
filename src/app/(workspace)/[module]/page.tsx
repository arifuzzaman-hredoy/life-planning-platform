import { notFound } from "next/navigation";
import { modules } from "@/lib/modules";
import { Dashboard } from "@/components/dashboard";
import { Collection } from "@/components/entry-collection";
import { Planner } from "@/components/planner";
import { Habits } from "@/components/habits";
import { Finance } from "@/components/finance";
import { Analytics } from "@/components/analytics";
import { Settings } from "@/components/settings";
export async function generateMetadata({ params }: { params: Promise<{ module: string }> }) {
  const { module } = await params;
  return { title: modules.find((item) => item.slug === module)?.label ?? "Page not found" };
}
export default async function ModulePage({ params }: { params: Promise<{ module: string }> }) {
  const { module: slug } = await params;
  const selected = modules.find((item) => item.slug === slug);
  if (!selected) notFound();
  if (slug === "dashboard") return <Dashboard />;
  if (slug === "planner") return <Planner />;
  if (slug === "habits") return <Habits />;
  if (slug === "finance") return <Finance />;
  if (slug === "analytics") return <Analytics />;
  if (slug === "settings") return <Settings />;
  if ("kind" in selected && selected.kind)
    return (
      <Collection kind={selected.kind} title={selected.label} description={selected.description} />
    );
  notFound();
}
