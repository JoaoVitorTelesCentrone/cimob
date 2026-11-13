/**
 * LGPD: nada de dado pessoal ou segredo em ferramenta de terceiros (Sentry). `scrubText` troca
 * telefone, e-mail e tokens por marcadores; `scrubEvent` tira o que nunca deve sair do servidor
 * (corpo, cookies, cabeçalhos da requisição, dados soltos) e limpa os textos que sobram.
 */

const PATTERNS: [RegExp, string][] = [
  [/\beyJ[\w-]+\.[\w-]+\.[\w-]+/g, "[token]"],
  [/\bBearer\s+[\w.~+/=-]+/g, "Bearer [token]"],
  [/\bEAA[A-Za-z0-9]{10,}/g, "[token]"],
  [/\bsb_(?:secret|publishable)_[\w-]+/g, "[token]"],
  [/[\w.%+-]+@[\w-]+(?:\.[\w-]+)*\.[A-Za-z]{2,}/g, "[e-mail]"],
];
/** Sequência com cara de telefone; só vira marcador se tiver de 10 a 15 dígitos (datas e ids ficam). */
const PHONE = /\+?\d[\d\s().-]{6,}\d/g;

export function scrubText(text: string): string {
  let out = text;
  for (const [re, mark] of PATTERNS) out = out.replace(re, mark);
  return out.replace(PHONE, (m) => {
    const digits = m.replace(/\D/g, "").length;
    return digits >= 10 && digits <= 15 ? "[telefone]" : m;
  });
}

type Request = {
  url?: string;
  method?: string;
  data?: unknown;
  cookies?: unknown;
  headers?: Record<string, string>;
  query_string?: unknown;
  [key: string]: unknown;
};
type Breadcrumb = { message?: string; data?: unknown; [key: string]: unknown };
export type ScrubbableEvent = {
  message?: string;
  exception?: { values?: { value?: string; [key: string]: unknown }[] };
  request?: Request;
  user?: { id?: string | number; [key: string]: unknown };
  breadcrumbs?: Breadcrumb[];
  extra?: unknown;
  [key: string]: unknown;
};

/** Cópia sem as chaves dadas. */
const omit = (obj: object, keys: string[]) =>
  Object.fromEntries(Object.entries(obj).filter(([k]) => !keys.includes(k)));

const SAFE_HEADERS = new Set(["user-agent", "content-type", "accept-language"]);

export function scrubEvent<T extends ScrubbableEvent>(event: T): T {
  const out: ScrubbableEvent = omit(event, ["extra"]);

  if (event.message !== undefined) out.message = scrubText(event.message);
  if (event.exception?.values) {
    out.exception = {
      ...event.exception,
      values: event.exception.values.map((v) =>
        v.value === undefined ? v : { ...v, value: scrubText(v.value) },
      ),
    };
  }
  if (event.request) {
    const { headers, query_string, url } = event.request;
    out.request = {
      ...omit(event.request, ["data", "cookies", "headers", "query_string", "url"]),
      ...(url !== undefined ? { url: scrubText(url) } : {}),
      ...(headers
        ? {
            headers: Object.fromEntries(
              Object.entries(headers).filter(([k]) => SAFE_HEADERS.has(k.toLowerCase())),
            ),
          }
        : {}),
      ...(typeof query_string === "string" ? { query_string: scrubText(query_string) } : {}),
    };
  }
  if (event.user) {
    out.user = event.user.id === undefined ? {} : { id: event.user.id };
  }
  if (event.breadcrumbs) {
    out.breadcrumbs = event.breadcrumbs.map((crumb) => {
      const b: Breadcrumb = omit(crumb, ["data"]);
      return crumb.message === undefined ? b : { ...b, message: scrubText(crumb.message) };
    });
  }
  return out as T;
}

/**
 * O que o SDK do Sentry (v11, `dataCollection`) pode coletar sozinho: nada de usuário, cookie, corpo
 * ou query; dos cabeçalhos, só os inofensivos. O limpador acima ainda passa em tudo antes de enviar.
 */
export const SENTRY_DATA_COLLECTION = {
  userInfo: false,
  cookies: false,
  httpHeaders: { request: { allow: ["user-agent", "content-type"] }, response: false },
  httpBodies: [] as never[],
  urlQueryParams: false,
};
