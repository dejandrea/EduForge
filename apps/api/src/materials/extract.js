import { unzipSync, strFromU8 } from 'fflate';
import { XMLParser, XMLValidator } from 'fast-xml-parser';

export const MAX_FILE_SIZE = 10 * 1024 * 1024;
export const MAX_TEXT = 250000;
export function checkDocxArchive(buffer) {
  const end = buffer.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (end < 0 || end + 22 > buffer.length) throw new Error('Arquivo DOCX inválido.');
  const count = buffer.readUInt16LE(end + 10);
  let offset = buffer.readUInt32LE(end + 16),
    total = 0,
    document = false;
  if (count > 2000 || count === 65535) throw new Error('DOCX excede o limite de entradas.');
  for (let i = 0; i < count; i++) {
    if (offset + 46 > buffer.length || buffer.readUInt32LE(offset) !== 0x02014b50)
      throw new Error('Estrutura ZIP inválida.');
    const size = buffer.readUInt32LE(offset + 24),
      length = buffer.readUInt16LE(offset + 28),
      extra = buffer.readUInt16LE(offset + 30),
      comment = buffer.readUInt16LE(offset + 32);
    const name = buffer.subarray(offset + 46, offset + 46 + length).toString('utf8');
    total += size;
    if (
      total > 50 * 1024 * 1024 ||
      size === 0xffffffff ||
      buffer.readUInt16LE(offset + 8) & 1 ||
      name.startsWith('/') ||
      name.includes('\\') ||
      name.split('/').includes('..') ||
      /vbaProject\.bin$/i.test(name)
    )
      throw new Error('DOCX contém estrutura não permitida ou expansão excessiva.');
    if (name === 'word/document.xml') document = true;
    offset += 46 + length + extra + comment;
  }
  if (!document) throw new Error('O ZIP não contém um documento Word.');
}
export function validateFile(name, buffer) {
  if (!buffer.length || buffer.length > MAX_FILE_SIZE)
    throw Object.assign(new Error('Envie um arquivo não vazio de até 10 MB.'), { status: 400 });
  const extension = name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1];
  const kinds = { docx: 'docx', pdf: 'pdf', md: 'markdown', markdown: 'markdown', txt: 'txt' };
  const kind = kinds[extension];
  if (!kind)
    throw Object.assign(new Error('Formatos permitidos: DOCX, PDF, Markdown e TXT.'), {
      status: 400,
    });
  try {
    if (kind === 'docx') checkDocxArchive(buffer);
    else if (kind === 'pdf') {
      if (!buffer.subarray(0, 8).toString('ascii').startsWith('%PDF-'))
        throw new Error('PDF inválido.');
    } else {
      const text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
      if (text.includes('\0')) throw new Error('Texto binário não permitido.');
    }
  } catch (error) {
    throw Object.assign(new Error(error.message), { status: 400 });
  }
  return kind;
}
export async function extractDocument(buffer, kind) {
  const limitations = [];
  let text = '';
  if (kind === 'docx') {
    checkDocxArchive(buffer);
    const files = unzipSync(new Uint8Array(buffer), {
      filter: ({ name }) => ['word/document.xml', 'word/_rels/document.xml.rels'].includes(name),
    });
    const parse = (bytes, ordered = false) => {
      const xml = strFromU8(bytes);
      if (/<!DOCTYPE|<!ENTITY/i.test(xml) || XMLValidator.validate(xml) !== true)
        throw new Error('XML do documento invalido ou nao permitido.');
      return new XMLParser({
        preserveOrder: ordered,
        ignoreAttributes: false,
        trimValues: false,
        parseTagValue: false,
        processEntities: true,
      }).parse(xml);
    };
    const relations = new Map();
    if (files['word/_rels/document.xml.rels']) {
      const entries =
        parse(files['word/_rels/document.xml.rels']).Relationships?.Relationship || [];
      for (const r of Array.isArray(entries) ? entries : [entries])
        relations.set(r['@_Id'], r['@_Target']);
    }
    const flatten = (nodes) =>
      nodes
        .map((node) => {
          const key = Object.keys(node).find((k) => k !== ':@');
          if (key === '#text') return String(node[key]);
          if (key === 'w:tab') return '\t';
          if (key === 'w:br' || key === 'w:cr') return '\n';
          if (key === 'w:pPr') return '';
          if (key === 'a:blip')
            return `[Imagem: ${relations.get(node[':@']?.['@_r:embed']) || 'incorporada'}; conteudo visual nao extraido]`;
          const value = Array.isArray(node[key]) ? flatten(node[key]) : '';
          const target = relations.get(node[':@']?.['@_r:id']);
          if (key === 'w:hyperlink' && /^https?:\/\//i.test(target || ''))
            return `${value} (${target})`;
          return value;
        })
        .join('');
    const paragraphs = [];
    const walk = (nodes) => {
      for (const node of nodes) {
        if (node['w:p']) {
          const style = node['w:p']
            .find((n) => n['w:pPr'])
            ?.['w:pPr']?.find((n) => n['w:pStyle'])?.[':@']?.['@_w:val'];
          const level = /^(?:Heading|T[í]tulo)([1-6])$/i.exec(style || '')?.[1];
          paragraphs.push((level ? '#'.repeat(Number(level)) + ' ' : '') + flatten(node['w:p']));
        } else
          for (const [key, children] of Object.entries(node))
            if (key !== ':@' && Array.isArray(children)) walk(children);
      }
    };
    walk(parse(files['word/document.xml'], true));
    text = paragraphs.join('\n\n');
    limitations.push(
      'Extra\u00e7\u00e3o textual do corpo do Word. Formata\u00e7\u00e3o, tabelas, cabe\u00e7alhos, notas e imagens podem perder informa\u00e7\u00f5es; confira o original. Imagens n\u00e3o interpretadas.',
    );
  } else if (kind === 'pdf') {
    const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const task = getDocument({
      data: new Uint8Array(buffer),
      isEvalSupported: false,
      disableFontFace: true,
      useSystemFonts: false,
      disableAutoFetch: true,
    });
    const pdf = await task.promise;
    try {
      for (let pageNumber = 1; pageNumber <= Math.min(pdf.numPages, 200); pageNumber++) {
        const page = await pdf.getPage(pageNumber);
        const content = await page.getTextContent();
        text +=
          `\n\n[Página ${pageNumber}]\n` +
          content.items
            .map((item) =>
              typeof item.str === 'string' ? item.str + (item.hasEOL ? '\n' : ' ') : '',
            )
            .join('');
        if (text.length > MAX_TEXT) break;
      }
      if (pdf.numPages > 200)
        limitations.push('Somente as primeiras 200 páginas foram consideradas.');
      limitations.push(
        'PDF textual: ordem de leitura e colunas podem variar. Imagens, diagramas e links não textuais não são interpretados. Sem OCR.',
      );
    } finally {
      await task.destroy();
    }
    if (!text.replace(/\[Página \d+\]/g, '').trim())
      return {
        text: '',
        status: 'no_text',
        limitations: [
          ...limitations,
          'Nenhum texto encontrado. PDF digitalizado exige OCR, não disponível nesta fase.',
        ],
      };
  } else text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  const truncated = text.length > MAX_TEXT;
  text = text.slice(0, MAX_TEXT).replace(/\0/g, '').trim();
  if (truncated)
    limitations.push(`Texto limitado a ${MAX_TEXT} caracteres. O original foi preservado.`);
  return { text, status: text ? (truncated ? 'limited' : 'ready') : 'no_text', limitations };
}
