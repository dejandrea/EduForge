import { parentPort, workerData } from 'node:worker_threads';
import { readFile } from 'node:fs/promises';
import { extractDocument } from './extract.js';
try {
  const result = await extractDocument(await readFile(workerData.path), workerData.kind);
  parentPort.postMessage(result);
} catch {
  parentPort.postMessage({
    text: '',
    status: 'failed',
    limitations: [
      'Não foi possível extrair texto. O arquivo pode estar danificado, protegido ou conter recursos não suportados. O original foi preservado.',
    ],
  });
}
