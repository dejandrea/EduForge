// Only explicit Markdown headings or numbered lines become suggested internal stages.
// A free-text section remains available for consultation and teacher naming.
export function guideStages(content, definitions = []) {
  return content.map((section) => {
    const stages = [];
    for (const line of section.content.split(/\r?\n/)) {
      const match = line.match(/^\s*(?:#{1,6}\s+|\d+[.)]\s+)(\S.{0,498})$/);
      if (!match) continue;
      const title = match[1].replace(/^\*\*(.*?)\*\*:?$/, '$1').trim();
      if (!stages.includes(title)) stages.push(title);
    }
    return {
      section_id: section.section_id,
      title: definitions.find((s) => s.id === section.section_id)?.title || section.section_id,
      content: section.content,
      stages,
      ambiguous: stages.length === 0,
    };
  });
}
export function isManualTest(e) {
  if (e.origin !== 'manual' || e.status === 'rejected') return false;
  if (e.kind === 'test') return true;
  const text = `${e.description || ''} ${e.data?.result_text || ''}`;
  return (
    e.kind === 'manual' &&
    /teste manual|testei|validação manual/i.test(text) &&
    !/não (foi )?(testad|realizad)|teste manual não/i.test(text)
  );
}
export function productionProgress({
  roadmap,
  guide,
  revision,
  evidence = [],
  links = [],
  jobs = [],
  decision,
  preparations = [],
}) {
  const required = decision?.requires_code !== 0;
  const records = evidence.filter((e) => e.status !== 'rejected');
  // Coverage belongs to the exact guide version and uses distinct evidence IDs.
  const covered = new Set(
    links
      .filter((l) => l.guide_id === guide?.id)
      .map((l) => l.evidence_id)
      .filter(Boolean),
  );
  const unlinked = records.filter((e) => !covered.has(e.id));
  const tests = records.filter(isManualTest),
    captures = records.filter((e) => e.kind === 'capture');
  const pending = records.filter(
    (e) => e.status === 'pending' && !['test', 'build'].includes(e.kind),
  );
  const jobsPending = jobs.some((j) => j.proposal_status === 'pending');
  const running =
    jobs.some((j) => ['pending', 'running'].includes(j.status)) ||
    preparations.some((p) => ['pending', 'running'].includes(p.status));
  const evidenceReady = tests.length > 0 && !unlinked.length && !pending.length;
  const states = [
    roadmap
      ? roadmap.status === 'approved'
        ? 'Concluída'
        : 'Aguardando revisão'
      : 'Bloqueada por pendência real',
    guide ? (guide.status === 'approved' ? 'Concluída' : 'Aguardando revisão') : 'Não iniciada',
    !required
      ? 'Não aplicável'
      : revision?.status === 'approved'
        ? 'Concluída'
        : revision || jobsPending
          ? 'Aguardando revisão'
          : running
            ? 'Em andamento'
            : 'Não iniciada',
    !required
      ? 'Não aplicável'
      : evidenceReady
        ? 'Concluída'
        : pending.length
          ? 'Aguardando revisão'
          : records.length
            ? 'Em andamento'
            : revision
              ? 'Não iniciada'
              : 'Bloqueada por pendência real',
    'Bloqueada por pendência real',
  ];
  let next;
  if (!roadmap || roadmap.status !== 'approved') next = { stage: 1, label: 'Revisar planejamento' };
  else if (!guide) next = { stage: 2, label: 'Gerar ou criar guia' };
  else if (required && revision?.status === 'approved' && tests.length && unlinked.length)
    next = { stage: 4, label: 'Organizar evidências' };
  else if (guide.status !== 'approved') next = { stage: 2, label: 'Revisar guia' };
  else if (required && jobsPending) next = { stage: 3, label: 'Revisar proposta de código' };
  else if (required && !revision)
    next = { stage: 3, label: running ? 'Acompanhar preparação' : 'Preparar código' };
  else if (required && revision.status !== 'approved') next = { stage: 3, label: 'Revisar código' };
  else if (required && !tests.length) next = { stage: 4, label: 'Registrar teste manual' };
  else if (required && pending.length) next = { stage: 4, label: 'Revisar registros de teste' };
  else next = { stage: 5, label: 'Preparar documento final' };
  return {
    states,
    next,
    required,
    tests: tests.length,
    captures: captures.length,
    evidence: records.length,
    unlinked: unlinked.length,
    covered: records.length - unlinked.length,
    pending: pending.length,
    materials_ready: states.slice(0, 4).every((s) => ['Concluída', 'Não aplicável'].includes(s)),
    document_available: false,
  };
}
