import express from 'express';
import path from 'node:path';
import dotenv from 'dotenv';

dotenv.config();

// Необязательный сервер для самостоятельного хостинга (`npm run build && npm start`).
// Для GitHub Pages он НЕ нужен: достаточно статической сборки из папки dist/.
const app = express();
const PORT = process.env.PORT || 3000;
const distPath = path.join(process.cwd(), 'dist');

app.use(express.static(distPath));

app.get('*', (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`STRATUM server listening on http://0.0.0.0:${PORT}`);
  });
}

export default app;
