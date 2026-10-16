import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabase } from '../src/database.js';
import { createApp } from '../src/app.js';

test('CRUD, validação, dashboard, isolamento e persistência após reabrir SQLite', async () => {
  const folder = mkdtempSync(join(tmpdir(), 'eduforge-test-'));
  const filename = join(folder, 'test.db');
  let db = openDatabase(filename);
  let server;
  try {
    server = createApp(db).listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}/api`;
    const request = async (path, method='GET', body, extra={}) => {
      const res = await fetch(base+path, { method, headers: { 'Content-Type':'application/json', ...extra }, body:body===undefined ? undefined : JSON.stringify(body) });
      return { status:res.status, data:res.status===204 ? null : await res.json() };
    };
    assert.equal((await request('/dashboard')).data.projects,0);
    assert.equal((await request('/projects','POST',{name:''})).status,400);
    assert.equal((await request('/projects','POST',{name:'Teste',repository_url:'javascript:alert(1)'})).status,400);
    assert.equal((await request('/projects','POST',{name:'Teste',unexpected:true})).status,400);
    assert.equal((await request('/projects','POST',{name:'Teste'}, {Origin:'https://example.org'})).status,403);
    const created = await request('/projects','POST',{name:'Projeto de teste',default_duration:90});
    assert.equal(created.status,201);
    const p = created.data;
    assert.ok(p.id); assert.ok(p.created_at);
    assert.equal((await request('/projects')).data.length,1);
    const lesson = {number:12,title:'Aula de teste',duration:90,status:'in_progress',objectives:'Verificar o fluxo'};
    const l = (await request(`/projects/${p.id}/lessons`,'POST',lesson)).data;
    assert.equal(l.project_id,p.id);
    assert.equal((await request(`/projects/${p.id}/lessons`,'POST',lesson)).status,409);
    assert.equal((await request('/projects/missing/lessons','POST',lesson)).status,404);
    assert.equal((await request(`/lessons/${l.id}`,'PUT',{...lesson,duration:0})).status,400);
    assert.equal((await request('/dashboard')).data.in_progress,1);
    await request(`/lessons/${l.id}`,'PUT',{...lesson,status:'completed',title:'Aula revisada'});
    const dashboard = (await request('/dashboard')).data;
    assert.equal(dashboard.completed,1); assert.equal(dashboard.in_progress,0); assert.equal(dashboard.lessons,1);
    await request(`/projects/${p.id}`,'PUT',{name:'Projeto revisado',default_duration:45});
    assert.equal((await request(`/projects/${p.id}`)).data.name,'Projeto revisado');
    assert.equal((await request('/lessons')).data[0].project_name,'Projeto revisado');
    await new Promise(resolve => server.close(resolve)); server = null; db.close();
    db = openDatabase(filename);
    assert.equal(db.prepare('SELECT title FROM lessons WHERE id=?').get(l.id).title,'Aula revisada');
    assert.equal(db.prepare('SELECT count(*) AS n FROM migrations').get().n,1);
    server = createApp(db).listen(0,'127.0.0.1');
    await new Promise(resolve => server.once('listening',resolve));
    const base2 = `http://127.0.0.1:${server.address().port}/api`;
    assert.equal((await fetch(`${base2}/lessons/${l.id}`,{method:'DELETE'})).status,204);
    assert.equal(db.prepare('SELECT count(*) AS n FROM lessons').get().n,0);
    await fetch(`${base2}/projects/${p.id}/lessons`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(lesson)});
    assert.equal((await fetch(`${base2}/projects/${p.id}`,{method:'DELETE'})).status,204);
    assert.equal(db.prepare('SELECT count(*) AS n FROM lessons').get().n,0);
    assert.equal((await fetch(`${base2}/projects/${p.id}`)).status,404);
  } finally {
    if (server) await new Promise(resolve=>server.close(resolve));
    db.close(); rmSync(folder,{recursive:true,force:true});
  }
});
