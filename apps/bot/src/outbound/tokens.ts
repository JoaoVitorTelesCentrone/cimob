import type postgres from "postgres";

export type TokenSource = { get(phoneNumberId: string): Promise<string | null> };

/**
 * Token da Cloud API por número: vem do Supabase Vault (`whatsapp_accounts.token_secret_id`).
 * Enquanto a decisão "um app da Meta para todas ou um por imobiliária" está aberta, aceita também
 * um token único do ambiente (`WHATSAPP_ACCESS_TOKEN`) para números sem token próprio.
 */
export function createVaultTokens(sql: postgres.Sql, fallback: string | null): TokenSource {
  return {
    async get(phoneNumberId) {
      const [row] = await sql<{ token: string | null }[]>`
        select s.decrypted_secret as token
        from whatsapp_accounts w
        left join vault.decrypted_secrets s on s.id = w.token_secret_id
        where w.phone_number_id = ${phoneNumberId}`;
      return row?.token ?? fallback;
    },
  };
}
