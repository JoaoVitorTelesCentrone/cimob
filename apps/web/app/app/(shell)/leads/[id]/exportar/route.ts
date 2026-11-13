import { NextResponse } from "next/server";
import { z } from "zod";
import { exportFileName } from "@/lib/leads/lgpd";
import { createClient } from "@/lib/supabase/server";

const Exported = z.object({ lead: z.object({ name: z.string().nullable() }) }).loose();

/**
 * Exportação LGPD: o arquivo JSON com tudo o que guardamos do lead. Quem decide se pode é o
 * banco (`export_lead_data`: só o gestor da imobiliária do lead), que também registra no histórico.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) return new NextResponse("Lead não encontrado", { status: 404 });

  const supabase = await createClient();
  const result = await supabase.rpc("export_lead_data", { lead: id.data });
  const data = Exported.safeParse(result.data);
  if (result.error || !data.success) {
    return new NextResponse("Lead não encontrado ou sem permissão", { status: 404 });
  }
  return new NextResponse(JSON.stringify(result.data, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="${exportFileName(data.data.lead.name, new Date())}"`,
      "cache-control": "no-store",
    },
  });
}
