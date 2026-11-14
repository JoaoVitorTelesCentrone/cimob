import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type Role = "org_admin" | "agent";

/**
 * Imobiliária descartável para um cenário E2E. Tudo é criado com a chave secreta (fora do app)
 * e marcado como demonstração (`is_demo`); `cleanup` apaga a organização (cascata) e os usuários.
 */
export class TestOrg {
  readonly id = randomUUID();
  readonly people = new Map<string, { userId: string; email: string }>();
  readonly leads = new Map<string, string>();
  readonly units = new Map<string, string>();
  private readonly admin: SupabaseClient;
  private developmentId: string | null = null;
  /** Imobiliárias criadas pela tela da agência durante o cenário (apagadas no fim). */
  private readonly createdSlugs: string[] = [];
  private readonly platformAdmins: string[] = [];

  constructor() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SECRET_KEY;
    if (!url || !key) throw new Error("Chaves do Supabase ausentes (veja e2e/support/env.ts).");
    this.admin = createClient(url, key, { auth: { persistSession: false } });
  }

  /** Desembrulha a resposta do Supabase: erro ou dado vazio viram exceção (o cenário para ali). */
  private async must<T>(
    p: PromiseLike<{ data: T | null; error: { message: string } | null }>,
  ): Promise<T> {
    const { data, error } = await p;
    if (error) throw new Error(error.message);
    if (data === null) throw new Error("resposta vazia do Supabase");
    return data;
  }

  /** Para escritas sem retorno (insert, update, delete): só o erro importa. */
  private async ok(p: PromiseLike<{ error: { message: string } | null }>): Promise<void> {
    const { error } = await p;
    if (error) throw new Error(error.message);
  }

  async create(): Promise<void> {
    const suffix = this.id.slice(0, 8);
    await this.ok(
      this.admin.from("organizations").insert({
        id: this.id,
        name: `E2E ${suffix}`,
        slug: `e2e-${suffix}`,
        is_demo: true,
      }),
    );
  }

  async person(name: string, role: Role): Promise<void> {
    const email = `e2e-${name.toLowerCase()}-${randomUUID().slice(0, 8)}@test.local`;
    const created = await this.admin.auth.admin.createUser({ email, email_confirm: true });
    if (!created.data.user) throw new Error(created.error?.message ?? "usuário não criado");
    const userId = created.data.user.id;
    this.people.set(name, { userId, email });
    await this.ok(
      this.admin.from("memberships").insert({
        organization_id: this.id,
        user_id: userId,
        role,
        display_name: name,
      }),
    );
  }

  /** Outra imobiliária (apagada no fim) com a pessoa como gestora; devolve o id. */
  async otherOrg(name: string, person: string): Promise<string> {
    const id = randomUUID();
    const slug = `e2e-${id.slice(0, 8)}`;
    await this.ok(this.admin.from("organizations").insert({ id, name, slug, is_demo: true }));
    this.createdSlugs.push(slug);
    await this.ok(
      this.admin.from("memberships").insert({
        organization_id: id,
        user_id: this.userId(person),
        role: "org_admin",
        display_name: person,
      }),
    );
    return id;
  }

  /** Pessoa da Center One (admin da plataforma), sem imobiliária. */
  async platformAdmin(name: string): Promise<void> {
    const email = `e2e-${name.toLowerCase()}-${randomUUID().slice(0, 8)}@test.local`;
    const created = await this.admin.auth.admin.createUser({ email, email_confirm: true });
    if (!created.data.user) throw new Error(created.error?.message ?? "usuário não criado");
    this.people.set(name, { userId: created.data.user.id, email });
    this.platformAdmins.push(created.data.user.id);
    await this.ok(this.admin.from("platform_admins").insert({ user_id: created.data.user.id }));
  }

  /** E-mail único por cenário para quem vai ser convidado pela tela. */
  inviteEmail(name: string): string {
    return `e2e-convite-${name.toLowerCase()}-${this.id.slice(0, 8)}@test.local`;
  }

  /** Endereço único por cenário para a imobiliária criada pela tela (apagada no fim). */
  newSlug(base: string): string {
    const slug = `e2e-${base}-${this.id.slice(0, 8)}`;
    this.createdSlugs.push(slug);
    return slug;
  }

  /** Quem foi convidado pela tela: a conta já existe (o convite cria); entra pelo link mágico. */
  async invitee(name: string): Promise<void> {
    const email = this.inviteEmail(name);
    const link = await this.admin.auth.admin.generateLink({ type: "magiclink", email });
    if (!link.data.user) throw new Error(link.error?.message ?? "convidado sem conta");
    this.people.set(name, { userId: link.data.user.id, email });
  }

  userId(name: string): string {
    const p = this.people.get(name);
    if (!p) throw new Error(`pessoa desconhecida: ${name}`);
    return p.userId;
  }

  /** token_hash do link mágico, para entrar por /auth/confirm sem depender de e-mail. */
  async magicLinkHash(name: string): Promise<string> {
    const email = this.people.get(name)?.email ?? "";
    const link = await this.admin.auth.admin.generateLink({ type: "magiclink", email });
    if (!link.data.properties) throw new Error(link.error?.message ?? "link mágico não gerado");
    return link.data.properties.hashed_token;
  }

  async lead(
    name: string,
    opts: {
      owner?: string;
      stage?: string;
      assignedHoursAgo?: number;
      /** Resultado do bot (falso = nutrição). */
      qualified?: boolean;
      createdDaysAgo?: number;
      /** Outra imobiliária do cenário (padrão: a principal). */
      organizationId?: string;
    } = {},
  ): Promise<void> {
    const id = randomUUID();
    const hours = opts.assignedHoursAgo ?? 0.1;
    await this.ok(
      this.admin.from("leads").insert({
        id,
        organization_id: opts.organizationId ?? this.id,
        name,
        phone: `55119${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}`,
        stage: opts.stage ?? "new",
        lost_reason: opts.stage === "lost" ? "Teste" : null,
        owner_id: opts.owner ? this.userId(opts.owner) : null,
        assigned_at: opts.owner ? new Date(Date.now() - hours * 3_600_000).toISOString() : null,
        ...(opts.qualified === undefined ? {} : { qualified: opts.qualified }),
        ...(opts.createdDaysAgo === undefined
          ? {}
          : { created_at: new Date(Date.now() - opts.createdDaysAgo * 86_400_000).toISOString() }),
        is_demo: true,
      }),
    );
    this.leads.set(name, id);
  }

  leadId(name: string): string {
    const id = this.leads.get(name);
    if (!id) throw new Error(`lead desconhecido: ${name}`);
    return id;
  }

  async setStage(name: string, stage: string): Promise<void> {
    await this.ok(this.admin.from("leads").update({ stage }).eq("id", this.leadId(name)));
  }

  async leadStage(name: string): Promise<{ stage: string; owner_id: string | null }> {
    return this.must(
      this.admin.from("leads").select("stage, owner_id").eq("id", this.leadId(name)).single(),
    );
  }

  async unit(code: string, status: "available" | "reserved" | "sold"): Promise<void> {
    if (!this.developmentId) {
      this.developmentId = randomUUID();
      await this.ok(
        this.admin.from("developments").insert({
          id: this.developmentId,
          organization_id: this.id,
          name: "Residencial E2E",
          is_demo: true,
        }),
      );
    }
    const id = randomUUID();
    await this.ok(
      this.admin.from("units").insert({
        id,
        organization_id: this.id,
        development_id: this.developmentId,
        code,
        floor: 1,
        status,
        is_demo: true,
      }),
    );
    this.units.set(code, id);
  }

  /** Rascunho de importação de PDF (como se o services/ingest tivesse lido a tabela). */
  async importDraft(rows: { code: string; price: number | null }[]): Promise<string> {
    if (!this.developmentId) throw new Error("crie uma unidade antes do rascunho");
    const id = randomUUID();
    await this.ok(
      this.admin.from("unit_imports").insert({
        id,
        organization_id: this.id,
        development_id: this.developmentId,
        file_name: "tabela-e2e.pdf",
        is_demo: true,
      }),
    );
    await this.ok(
      this.admin.from("unit_import_rows").insert(
        rows.map((r, i) => ({
          organization_id: this.id,
          import_id: id,
          position: i + 1,
          code: r.code,
          price: r.price,
          status: "available",
        })),
      ),
    );
    return id;
  }

  /** Marca, empreendimento e unidades do site público (dados de teste, marcados como demo). */
  async publishSite(opts: {
    development: string;
    whatsapp: string;
    /** Nome da imobiliária no site (padrão: "E2E <id>"). */
    name?: string;
    published?: boolean;
    units?: {
      code: string;
      floor?: number;
      position?: string;
      bedrooms: number;
      area: number;
      parking?: number;
      price: number;
      status: string;
      meshName?: string;
    }[];
  }): Promise<void> {
    await this.ok(
      this.admin
        .from("organizations")
        .update({
          ...(opts.name ? { name: opts.name } : {}),
          brand: { color: "#155F4B", creci: "CRECI 99999-J", whatsapp: opts.whatsapp },
        })
        .eq("id", this.id),
    );
    const developmentId = randomUUID();
    this.developmentId = developmentId;
    await this.ok(
      this.admin.from("developments").insert({
        id: developmentId,
        organization_id: this.id,
        name: opts.development,
        address: "Vila Mariana, São Paulo",
        delivery_date: "2028-12-01",
        published: opts.published ?? true,
        is_demo: true,
      }),
    );
    for (const u of opts.units ?? []) {
      await this.ok(
        this.admin.from("units").insert({
          organization_id: this.id,
          development_id: developmentId,
          code: u.code,
          floor: u.floor ?? null,
          position: u.position ?? null,
          bedrooms: u.bedrooms,
          area_m2: u.area,
          parking: u.parking ?? null,
          price: u.price,
          status: u.status,
          mesh_name: u.meshName ?? null,
          is_demo: true,
        }),
      );
    }
  }

  /** Liga o modelo 3D do arquiteto ao empreendimento publicado por `publishSite`. */
  async setModelUrl(url: string): Promise<void> {
    if (!this.developmentId) throw new Error("publishSite antes de setModelUrl");
    await this.ok(
      this.admin.from("developments").update({ model_url: url }).eq("id", this.developmentId),
    );
  }

  /** Endereço do site público (subdomínio local). */
  siteUrl(baseURL: string): string {
    const u = new URL(baseURL);
    return `${u.protocol}//e2e-${this.id.slice(0, 8)}.${u.host}/`;
  }

  async cleanup(): Promise<void> {
    // Logo enviado no cenário (Storage não apaga em cascata com a organização).
    const files = await this.admin.storage.from("brand").list(this.id);
    if (files.data && files.data.length > 0) {
      await this.admin.storage.from("brand").remove(files.data.map((f) => `${this.id}/${f.name}`));
    }
    await this.admin.from("organizations").delete().eq("id", this.id);
    if (this.createdSlugs.length > 0) {
      await this.admin.from("organizations").delete().in("slug", this.createdSlugs);
    }
    if (this.platformAdmins.length > 0) {
      await this.admin.from("platform_admins").delete().in("user_id", this.platformAdmins);
    }
    for (const { userId } of this.people.values()) await this.admin.auth.admin.deleteUser(userId);
  }
}
