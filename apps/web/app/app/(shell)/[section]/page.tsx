import { notFound } from "next/navigation";
import { SECTIONS } from "@/lib/menu";

export default async function SectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  const label = SECTIONS[section];
  if (!label) notFound();
  return (
    <>
      <h1 className="font-display text-[32px] leading-9 font-extrabold uppercase">{label}</h1>
      <p className="mt-2 text-ink-muted">Em construção.</p>
    </>
  );
}
