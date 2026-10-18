import React from 'react';
export default function ProductionDocument({ data }) {
  const { guide, revision, evidence, links, progress } = data;
  return (
    <section>
      <h3>Materiais para o futuro documento</h3>
      <p>
        {guide
          ? `Guia v${guide.version} · ${guide.status === 'approved' ? 'Aprovado' : 'Ainda não aprovado'}`
          : 'Guia ainda não disponível.'}
      </p>
      <p>
        {!progress.required
          ? `Código não aplicável: ${data.decision.reason}`
          : revision
            ? `Versão do código ${revision.number} · ${revision.status === 'approved' ? 'Aprovada' : 'Ainda não aprovada'}`
            : 'Código ainda não preparado.'}
      </p>
      <ul>
        {evidence
          .filter((e) => e.kind === 'capture')
          .map((e) => (
            <li key={e.id}>
              {e.description} · {e.status === 'approved' ? 'Aprovada' : 'Ainda não aprovada'} ·{' '}
              {links.some((l) => l.guide_id === guide?.id && l.evidence_id === e.id)
                ? 'Associada ao guia selecionado'
                : 'Sem vínculo ao guia selecionado'}
            </li>
          ))}
      </ul>
      <p>
        {progress.materials_ready
          ? 'Todos os materiais disponíveis estão organizados.'
          : `Pendências: ${progress.states
              .slice(0, 4)
              .map((s, i) =>
                !['Concluída', 'Não aplicável'].includes(s) ? `etapa ${i + 1} (${s})` : '',
              )
              .filter(Boolean)
              .join('; ')}.`}
      </p>
      <p className="warning">
        A exportação para Word estará disponível na próxima fase. Nenhum DOCX foi criado e o
        documento ainda não está finalizado.
      </p>
      <p>
        Esta prévia usa o guia, a versão de código e os vínculos selecionados acima. Selecionar
        materiais não certifica execução do código.
      </p>
      <h4>Materiais e referências disponíveis para consulta</h4>
      <ul>
        {data.materials.map((m) => (
          <li key={m.id}>
            {m.name} · {m.extraction_status}
          </li>
        ))}
        {data.references.map((r) => (
          <li key={r.id}>{r.title}</li>
        ))}
      </ul>
    </section>
  );
}
