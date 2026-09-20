// Monta solo: escanea recursivamente src/modules en busca de *.routes.js y las monta
// bajo /api/<carpetas del archivo>. Nadie tiene que registrar rutas a mano — agregar un
// módulo nuevo es crear su carpeta con sus 4-5 archivos de siempre (routes/controller/
// service/repository/schema) y listo. Carpetas llamadas "shared" se ignoran (para
// helpers compartidos entre módulos que no son, ellos mismos, un módulo montable).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { logger } from '../config/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function findRouteFiles(dir, prefixParts = []) {
  const found = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (entry.name === 'shared') continue;
      found.push(...findRouteFiles(path.join(dir, entry.name), [...prefixParts, entry.name]));
    } else if (entry.isFile() && entry.name.endsWith('.routes.js')) {
      found.push({ filePath: path.join(dir, entry.name), prefix: `/${prefixParts.join('/')}` });
    }
  }
  return found;
}

export async function mountModules(app) {
  const routeFiles = findRouteFiles(__dirname);

  for (const { filePath, prefix } of routeFiles) {
    const mod = await import(pathToFileURL(filePath).href);
    app.use(`/api${prefix}`, mod.default);
    logger.info(`Montado /api${prefix} -> ${path.relative(path.resolve(__dirname, '..'), filePath)}`);
  }
}
