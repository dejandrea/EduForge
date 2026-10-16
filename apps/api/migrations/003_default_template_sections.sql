-- Preserve the approved factory version and all user versions/references.
-- The updated model is a draft, subject to explicit review and approval.
INSERT INTO template_versions (id,template_id,version,status,data,created_at,updated_at)
SELECT
 '10000000-0000-4000-8000-000000000003',
 source.template_id,
 (SELECT coalesce(max(version),0)+1 FROM template_versions WHERE template_id=source.template_id),
 'draft',
 json_set(source.data,
  '$.description','Modelo atualizado com objetivos pedagógicos, pilares, avaliação informal, pensamento computacional e mensagem final.',
  '$.sections',json_insert(
   json_remove(json_extract(source.data,'$.sections'),'$[16]'),
   '$[#]',json('{"id":"learning-objectives","title":"Objetivos pedagógicos da aula","optional":true,"enabled":true,"instructions":"Explicite os objetivos de aprendizagem e as evidências esperadas ao final da aula."}'),
   '$[#]',json('{"id":"lesson-pillars","title":"Pilares da aula","optional":true,"enabled":true,"instructions":"Identifique os pilares que orientam a experiência pedagógica e sua relação com as atividades."}'),
   '$[#]',json('{"id":"informal-assessment","title":"O que observar na avaliação informal","optional":true,"enabled":true,"instructions":"Liste sinais de compreensão, dificuldades e comportamentos a observar durante as atividades."}'),
   '$[#]',json('{"id":"computational-thinking","title":"Habilidades de pensamento computacional","optional":true,"enabled":true,"instructions":"Relacione as habilidades de pensamento computacional trabalhadas e como observá-las na prática."}'),
   '$[#]',json('{"id":"teacher-message","title":"Mensagem final para a professora","optional":true,"enabled":true,"instructions":"Inclua uma orientação final de apoio à condução da aula e à reflexão sobre a aprendizagem."}'),
   '$[#]',json_extract(source.data,'$.sections[16]')
  )
 ),
 strftime('%Y-%m-%dT%H:%M:%fZ','now'),strftime('%Y-%m-%dT%H:%M:%fZ','now')
FROM template_versions source WHERE source.id='10000000-0000-4000-8000-000000000002';
