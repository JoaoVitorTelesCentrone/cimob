"use client";

/** Abre a impressão do navegador (dá para salvar em PDF por ela). */
export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => {
        window.print();
      }}
      className="h-10 rounded-pill bg-brand px-5 text-sm font-semibold text-on-brand print:hidden"
    >
      Imprimir ou salvar PDF
    </button>
  );
}
