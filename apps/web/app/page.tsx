import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-6 p-6">
      <h1 className="font-display text-[32px] leading-9 font-extrabold tracking-tight uppercase">
        Center One Imob
      </h1>
      <p className="text-ink-muted">Do anúncio à visita.</p>
      <div className="flex flex-wrap items-center gap-2">
        <Button>Fale com a gente</Button>
        <span className="rounded-pill bg-available-soft px-2 py-1 text-[11.5px] font-extrabold text-available-ink">
          Disponível
        </span>
        <span className="rounded-pill bg-reserved-soft px-2 py-1 text-[11.5px] font-extrabold text-reserved-ink">
          Reservado
        </span>
        <span className="rounded-pill bg-sold-soft px-2 py-1 text-[11.5px] font-extrabold text-sold-ink">
          Vendido
        </span>
      </div>
    </main>
  );
}
