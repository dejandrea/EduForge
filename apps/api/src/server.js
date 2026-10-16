import { createApp } from './app.js';
import { openDatabase } from './database.js';
const db = openDatabase();
const server = createApp(db).listen(Number(process.env.PORT || 3001), '127.0.0.1', () =>
  console.log(`EduForge API: http://127.0.0.1:${process.env.PORT || 3001}`),
);
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () =>
    server.close(() => {
      db.close();
      process.exit(0);
    }),
  );
