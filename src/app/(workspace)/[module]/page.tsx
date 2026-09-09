import { notFound } from "next/navigation";
import { modules } from "@/lib/modules";
import { Dashboard } from "@/components/dashboard";
import { Collection } from "@/components/entry-collection";
import { Planner } from "@/components/planner";
import { Habits } from "@/components/habits";
import { Finance } from "@/components/finance";
import { Analytics } from "@/components/analytics";
import { Settings } from "@/components/settings";
import { AiChat } from "@/components/ai-chat";
import { Vault } from "@/components/vault";
import { AutomationHub } from "@/components/automation";
import { RoadmapHub, ProgressCenter, MonthlyReview, TargetDocument } from "@/components/roadmaps";
import { BackupRestore } from "@/components/backup";
import { roadmaps } from "@/lib/roadmaps";
export async function generateMetadata({ params }: { params: Promise<{ module: string }> }) {
  const { module } = await params;
  return {
    title:
      modules.find((item) => item.slug === module)?.label ??
      roadmaps.find((item) => item.slug === module)?.title ??
      (
        {
          certificates: "Certificates",
          "final-target-document": "Target Document",
          "admin-vault": "Document Vault",
          welcome: "Overview",
          security: "Security",
        } as Record<string, string>
      )[module] ??
      "Page not found",
  };
}
export default async function ModulePage({ params }: { params: Promise<{ module: string }> }) {
  const { module: slug } = await params;
  if (slug === "ai-assistant") return <AiChat />;
  if (["document-vault", "admin-vault"].includes(slug)) return <Vault />;
  if (slug === "automation") return <AutomationHub />;
  if (slug === "roadmaps" || roadmaps.some((item) => item.slug === slug))
    return <RoadmapHub slug={slug} />;
  if (slug === "progress" || slug === "certificates")
    return <ProgressCenter certificatesOnly={slug === "certificates"} />;
  if (slug === "monthly-review") return <MonthlyReview />;
  if (slug === "final-target-document") return <TargetDocument />;
  if (slug === "backup") return <BackupRestore />;
  if (slug === "welcome") return <Dashboard />;
  if (slug === "security") return <Settings />;
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
