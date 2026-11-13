/** Link do WhatsApp para o número (só dígitos, com DDI). */
export function whatsappUrl(phone: string, text?: string): string {
  const url = `https://wa.me/${phone.replace(/\D/g, "")}`;
  return text ? `${url}?text=${encodeURIComponent(text)}` : url;
}
