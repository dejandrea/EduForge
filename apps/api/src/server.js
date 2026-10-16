import { createApp } from './app.js';
import { openDatabase } from './database.js';
import { fork } from 'node:child_process';
const db = openDatabase();
const worker = fork(new URL('./ai/worker.js', import.meta.url), [], {
  execArgv: [],
  stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
  windowsHide: true,
});
const server = createApp(db).listen(Number(process.env.PORT || 3001), '127.0.0.1', () =>
  console.log(`EduForge API: http://127.0.0.1:${process.env.PORT || 3001}`),
);
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () =>
    server.close(() => {
      if (worker.connected) worker.disconnect();
      db.close();
      process.exit(0);
    }),
  );
