import { unzipSync, zipSync, strFromU8, strToU8 } from 'fflate';
import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { validateFile } from '../materials/extract.js';
import { problem } from '../code/storage.js';

const escape = (value) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c],
  );
const parser = new XMLParser({ trimValues: false, parseTagValue: false });
const text = (p) =>
  [...p.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)]
    .map((m) => parser.parse(`<t>${m[1]}</t>`).t ?? '')
    .join('');
const paragraph = (value, heading = false, code = false) =>
  `<w:p><w:pPr>${heading ? '<w:pStyle w:val="Heading2"/>' : ''}<w:spacing w:after="120"/></w:pPr><w:r>${code ? '<w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/><w:sz w:val="20"/></w:rPr>' : ''}<w:t xml:space="preserve">${escape(value)}</w:t></w:r></w:p>`;
const paragraphs = (value, code = false) =>
  String(value ?? '')
    .split(/\r?\n/)
    .map((line) => paragraph(line, false, code))
    .join('');
function guideParagraphs(value) {
  let code = false;
  return String(value ?? '')
    .split(/\r?\n/)
    .map((line) => {
      if (/^\s*```/.test(line)) {
        code = !code;
        return '';
      }
      const heading = !code && line.match(/^#{1,6}\s+(.+)$/);
      return paragraph(heading ? heading[1] : line, Boolean(heading), code);
    })
    .join('');
}
function scalar(paragraphXml, marker, value) {
  let offset = 0;
  const nodes = [...paragraphXml.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)].map((m) => {
    const value = String(parser.parse(`<t>${m[1]}</t>`).t ?? ''),
      start = offset;
    offset += value.length;
    return { value, start, end: offset };
  });
  const flat = nodes.map((n) => n.value).join(''),
    matches = [];
  for (let at = flat.indexOf(marker); at !== -1; at = flat.indexOf(marker, at + marker.length))
    matches.push({ start: at, end: at + marker.length });
  let index = 0;
  return paragraphXml.replace(/<w:t(?:\s[^>]*)?>[\s\S]*?<\/w:t>/g, () => {
    const node = nodes[index++];
    let result = '',
      cursor = 0;
    for (const match of matches) {
      if (match.end <= node.start || match.start >= node.end) continue;
      const localStart = Math.max(0, match.start - node.start),
        localEnd = Math.min(node.value.length, match.end - node.start);
      result += node.value.slice(cursor, localStart);
      if (match.start >= node.start) result += String(value ?? '');
      cursor = localEnd;
    }
    result += node.value.slice(cursor);
    return `<w:t xml:space="preserve">${escape(result).replace(/\r?\n/g, '</w:t><w:br/><w:t xml:space="preserve">')}</w:t>`;
  });
}
function archive(bytes) {
  validateFile('template.docx', bytes);
  const files = unzipSync(bytes);
  for (const [name, data] of Object.entries(files))
    if (/\.xml$|\.rels$/.test(name)) {
      const xml = strFromU8(data);
      if (/<!DOCTYPE|<!ENTITY/i.test(xml) || XMLValidator.validate(xml) !== true)
        throw problem('XML do modelo inválido ou não permitido.');
    }
  const xml = strFromU8(files['word/document.xml']);
  if (!xml.includes('<w:body>') || /<w:txbxContent|<w:altChunk|<w:sdt|<w:ins\b|<w:del\b/.test(xml))
    throw problem(
      'Modelo contém controles, alterações ou elementos incompatíveis. Use uma cópia simplificada.',
    );
  return { files, xml };
}
export function inspectDocx(bytes, settings) {
  const { xml } = archive(bytes),
    body = xml.split('<w:body>')[1].split('</w:body>')[0];
  const ps = [...body.matchAll(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g)].map((m) => text(m[0]));
  const found = Object.fromEntries(
    Object.entries(settings.markers).map(([key, marker]) => [
      key,
      Boolean(marker && ps.some((p) => p.includes(marker))),
    ]),
  );
  if (settings.fill_mode === 'markers') {
    for (const [key, marker] of Object.entries(settings.markers)) {
      if (marker && !found[key])
        throw problem(
          `Marcador ausente no corpo do modelo: ${marker}. Configure os marcadores ou escolha explicitamente substituir o corpo.`,
        );
      if (
        marker &&
        ['guide', 'code', 'captures'].includes(key) &&
        ps.some((p) => p.includes(marker) && p.trim() !== marker)
      )
        throw problem(`O marcador ${marker} precisa ocupar um parágrafo exclusivo.`);
    }
    const enabled = new Set(Object.values(settings.markers).filter(Boolean));
    for (const p of ps)
      for (const marker of p.match(/\{\{[A-Z0-9_]+\}\}/g) || [])
        if (!enabled.has(marker)) throw problem(`Marcador sem configuração: ${marker}.`);
    if (!settings.markers.guide) throw problem('Ative um marcador para o conteúdo do guia.');
  }
  return {
    found,
    warnings: [
      'A conversão Google Docs → DOCX → Google Docs exige revisão visual de estilos, tabelas, cabeçalhos e rodapés.',
      ...(settings.fill_mode === 'replace_body'
        ? [
            'O corpo da cópia será substituído integralmente; elementos fixos devem estar no cabeçalho ou rodapé.',
          ]
        : []),
    ],
  };
}
export function fillDocx(bytes, settings, content) {
  inspectDocx(bytes, settings);
  if (
    settings.fill_mode === 'markers' &&
    ((content.code?.length && !settings.markers.code) ||
      (content.captures?.length && !settings.markers.captures))
  )
    throw problem('Ative os marcadores de código e capturas para os materiais selecionados.');
  const { files, xml } = archive(bytes);
  let relationships = files['word/_rels/document.xml.rels']
    ? strFromU8(files['word/_rels/document.xml.rels'])
    : '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>';
  let types = strFromU8(files['[Content_Types].xml']);
  let imageIndex = 1;
  const images = (content.captures || [])
    .map((capture) => {
      while (
        files[`word/media/eduforge-${imageIndex}.png`] ||
        relationships.includes(`eduforge${imageIndex}`)
      )
        imageIndex++;
      const n = imageIndex++,
        id = `eduforge${n}`,
        name = `eduforge-${n}.png`,
        scale = Math.min(1, 5486400 / (capture.width * 9525), 6400800 / (capture.height * 9525)),
        width = Math.round(capture.width * 9525 * scale),
        height = Math.round(capture.height * 9525 * scale);
      if (!Number.isFinite(height) || height < 1 || height > 100000000)
        throw problem('Dimensões da captura inválidas.');
      files[`word/media/${name}`] = capture.bytes;
      relationships = relationships.replace(
        '</Relationships>',
        `<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${name}"/></Relationships>`,
      );
      return `<w:p><w:r><w:drawing><wp:inline xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"><wp:extent cx="${width}" cy="${height}"/><wp:docPr id="${100000 + n}" name="${id}"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="0" name="${name}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:embed="${id}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${width}" cy="${height}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>${paragraph(capture.caption)}`;
    })
    .join('');
  if (images && !/Extension="png"/i.test(types))
    types = types.replace('</Types>', '<Default Extension="png" ContentType="image/png"/></Types>');
  const blocks = {
    title: paragraph(content.title),
    objectives: paragraphs(content.objectives),
    guide: content.sections
      .map((s) => paragraph(s.title, true) + guideParagraphs(s.content))
      .join(''),
    code:
      (content.code || [])
        .map((c) => paragraph(c.path, true) + paragraphs(c.content, true))
        .join('') || paragraph('Nenhum arquivo de código selecionado.'),
    captures: images || paragraph('Nenhuma captura selecionada.'),
  };
  let output;
  if (settings.fill_mode === 'replace_body') {
    const section = xml.match(/<w:sectPr\b[^>]*\/>|<w:sectPr\b[\s\S]*?<\/w:sectPr>/g)?.at(-1) || '';
    output = xml.replace(
      /<w:body>[\s\S]*?<\/w:body>/,
      `<w:body>${Object.values(blocks).join('')}${section}</w:body>`,
    );
  } else {
    output = xml.replace(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g, (p) => {
      let value = text(p);
      for (const [key, marker] of Object.entries(settings.markers)) {
        if (!marker || !value.includes(marker)) continue;
        if (['guide', 'code', 'captures'].includes(key)) return blocks[key];
        // Replace split markers without moving neighboring text into another run.
        p = scalar(p, marker, content[key]);
        value = text(p);
      }
      return p;
    });
  }
  files['word/document.xml'] = strToU8(output);
  files['word/_rels/document.xml.rels'] = strToU8(relationships);
  files['[Content_Types].xml'] = strToU8(types);
  const result = Buffer.from(zipSync(files));
  archive(result);
  return result;
}
export function verifyExport(prepared, exported) {
  const source = archive(prepared).xml,
    result = archive(exported).xml;
  const normalize = (s) => s.normalize('NFC').replace(/\s+/g, ' ').trim();
  const paragraphs = (xml) =>
    [...xml.matchAll(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g)]
      .map((m) => normalize(text(m[0])))
      .filter(Boolean);
  const actual = paragraphs(result).join(' ');
  if (actual !== paragraphs(source).join(' '))
    throw problem(
      'O DOCX exportado não confirmou exatamente o texto enviado. Confira a cópia no Google Docs antes de continuar.',
    );
  if ((result.match(/<w:drawing\b/g) || []).length !== (source.match(/<w:drawing\b/g) || []).length)
    throw problem(
      'O DOCX exportado não confirmou todas as imagens. Confira a cópia no Google Docs.',
    );
}
