import { KruangChip } from "@/components/ui/kruang-chip";

/** Shows the two list shapes the importer understands. */
export function FormatGuide() {
  return (
    <aside aria-labelledby="guia-formatos" className="flex flex-col gap-8 text-[14px]">
      <div>
        <h2 id="guia-formatos" className="eyebrow">
          Como a lista pode estar
        </h2>
        <p className="mt-4 leading-relaxed text-bone-400">
          Não precisa seguir um modelo rígido. Estes dois formatos são reconhecidos, com ou sem numeração:
        </p>
      </div>

      <figure>
        <figcaption className="mb-3 text-[13px] font-medium text-bone-200">Nomes sob o título da graduação</figcaption>
        <div className="rounded-xl border border-line bg-ink-900/70 px-5 py-4 font-mono text-[12px] leading-[1.9] text-bone-400">
          <p className="flex items-center gap-2.5 text-bone-100">
            <KruangChip graduationId="vermelha" size="xs" /> VERMELHA
          </p>
          <p>1. Otávio Mendes Arruda</p>
          <p>2. Lívia Brandão</p>
          <p className="mt-2 flex items-center gap-2.5 text-bone-100">
            <KruangChip graduationId="azul-claro" size="xs" /> AZUL CLARO
          </p>
          <p>3. Érico Fontes da Silva</p>
        </div>
      </figure>

      <figure>
        <figcaption className="mb-3 text-[13px] font-medium text-bone-200">Tabela com nome e graduação</figcaption>
        <div className="overflow-hidden rounded-xl border border-line bg-ink-900/70 font-mono text-[12px] text-bone-400">
          <div className="grid grid-cols-[1.3fr_1fr] border-b border-line px-5 py-2.5 text-bone-100">
            <span>Nome</span>
            <span>Graduação</span>
          </div>
          <div className="grid grid-cols-[1.3fr_1fr] px-5 py-2">
            <span>João Silva</span>
            <span>Vermelha</span>
          </div>
          <div className="grid grid-cols-[1.3fr_1fr] px-5 pb-2.5">
            <span>Maria Oliveira</span>
            <span>Azul-claro</span>
          </div>
        </div>
      </figure>

      <p className="border-t border-line pt-6 leading-relaxed text-bone-500">
        Se o arquivo tiver o resumo do pedido de kruangs, ele é usado para conferir se a contagem de alunos bate.
      </p>
    </aside>
  );
}
