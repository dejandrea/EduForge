import { problem } from './storage.js';
function crc(bytes) {
  let value = 0xffffffff;
  for (const byte of bytes) {
    value ^= byte;
    for (let n = 0; n < 8; n++) value = (value >>> 1) ^ (value & 1 ? 0xedb88320 : 0);
  }
  return (value ^ 0xffffffff) >>> 0;
}
export function cleanPng(bytes) {
  if (
    bytes.length > 5 * 1024 * 1024 ||
    !bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    throw problem('Envie uma imagem PNG de até 5 MB.', 400);
  const kept = [bytes.subarray(0, 8)];
  let offset = 8,
    width,
    height,
    ended = false,
    hasData = false,
    parts = 0;
  while (offset < bytes.length) {
    if (++parts > 10000 || offset + 12 > bytes.length) throw problem('PNG inválido.', 400);
    const size = bytes.readUInt32BE(offset),
      end = offset + 12 + size,
      type = bytes.toString('ascii', offset + 4, offset + 8);
    if (
      end > bytes.length ||
      crc(bytes.subarray(offset + 4, end - 4)) !== bytes.readUInt32BE(end - 4)
    )
      throw problem('PNG inválido ou corrompido.', 400);
    if (offset === 8) {
      if (type !== 'IHDR' || size !== 13) throw problem('Cabeçalho PNG inválido.', 400);
      width = bytes.readUInt32BE(offset + 8);
      height = bytes.readUInt32BE(offset + 12);
      if (!width || !height || width > 4096 || height > 4096)
        throw problem('Resolução máxima: 4096 × 4096.', 400);
    } else if (type === 'IHDR') throw problem('PNG inválido.', 400);
    if (['IHDR', 'IDAT', 'PLTE', 'tRNS', 'IEND'].includes(type))
      kept.push(bytes.subarray(offset, end));
    if (type === 'IDAT') hasData = true;
    offset = end;
    if (type === 'IEND') {
      ended = size === 0;
      break;
    }
  }
  if (!ended || !hasData || offset !== bytes.length)
    throw problem('PNG incompleto ou com conteúdo adicional.', 400);
  return { bytes: Buffer.concat(kept), width, height };
}
