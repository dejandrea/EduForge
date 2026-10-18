import React, { useRef, useState } from 'react';
import { api } from '../api';
import { InputField } from './Pedagogy';
import './CodeManualTest.css';

export default function CodeManualTest({ revision, onSaved }) {
  const [environment, setEnvironment] = useState(
    revision.manifest.some((f) => /game|frog|sprite/i.test(f.path)) ? 'Code.org Game Lab' : '',
  );
  const [result, setResult] = useState(''),
    [notes, setNotes] = useState(''),
    [saved, setSaved] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [message, setMessage] = useState('');
  const file = useRef(null);
  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    let reportSaved = saved;
    try {
      if (!saved) {
        await api(`/code/revisions/${revision.id}/evidence`, {
          method: 'POST',
          body: JSON.stringify({
            kind: 'manual',
            description: `Teste manual realizado pela professora em ${environment}: ${result}.`,
            result_text: `Validação manual relatada pela professora. Não executada nem comprovada pelo EduForge.\n${notes}`,
          }),
        });
        reportSaved = true;
        setSaved(true);
        onSaved();
      }
      if (file.current.files[0]) {
        const form = new FormData();
        form.append('file', file.current.files[0]);
        form.append(
          'description',
          `Captura enviada pela professora: teste manual em ${environment} — ${result}.`,
        );
        await api(`/code/revisions/${revision.id}/captures`, { method: 'POST', body: form });
        file.current.value = '';
        onSaved();
      }
      setMessage(
        'Teste manual registrado. Confira os registros abaixo e associe-os ao guia. A captura precisa de aprovação humana.',
      );
    } catch (e) {
      setError(
        `${reportSaved ? 'O relato já foi salvo. Tente enviar somente a captura novamente. ' : ''}${e.message}`,
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="code-manual-test" onSubmit={save}>
      <h3>Como foi o teste do código?</h3>
      <p>
        Registre o teste realizado por você no ambiente original. Esse relato não é um teste
        automatizado nem uma comprovação técnica.
      </p>
      <fieldset disabled={busy || saved}>
        <InputField
          label="Ambiente utilizado"
          required
          max={500}
          value={environment}
          onChange={setEnvironment}
        />
        <label className="field">
          <span>Resultado do teste manual</span>
          <select required value={result} onChange={(e) => setResult(e.target.value)}>
            <option value="">Selecione…</option>
            {['Funcionou', 'Funcionou parcialmente', 'Apresentou problemas'].map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </label>
        <InputField
          label="Observações do teste (opcional)"
          multiline
          max={15000}
          value={notes}
          onChange={setNotes}
        />
      </fieldset>
      <label className="field">
        <span>Captura PNG do teste (opcional)</span>
        <input ref={file} type="file" accept="image/png,.png" disabled={busy} />
      </label>
      <p>
        PNG até 5 MB e 4096 × 4096. Confira se a imagem contém somente os dados necessários à aula.
      </p>
      <button className="primary" disabled={busy}>
        {busy ? 'Salvando…' : saved ? 'Enviar captura deste teste' : 'Salvar teste e captura'}
      </button>
      {saved && (
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setSaved(false);
            setResult('');
            setNotes('');
            setMessage('');
          }}
        >
          Registrar outro teste
        </button>
      )}
      {message && <p role="status">{message}</p>}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </form>
  );
}
