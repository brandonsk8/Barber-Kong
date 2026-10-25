// Se ejecuta antes de cada archivo de pruebas. Vitest no pasa por `node --env-file`, así
// que el .env.test se carga aquí; en CI las variables pueden venir ya en el entorno (las
// que ya existen no se pisan).
import { existsSync } from 'node:fs';
import { vi } from 'vitest';

if (existsSync('.env.test')) process.loadEnvFile('.env.test');

// SEGURO: las pruebas crean y borran datos de verdad, así que jamás deben correr contra la
// base de desarrollo ni la de producción. Se niegan a arrancar salvo que sea NODE_ENV=test y
// la base se llame "*_test". No debilitar esta guarda.
if (process.env.NODE_ENV !== 'test') {
  throw new Error('Las pruebas solo corren con NODE_ENV=test (usa `npm test`).');
}
if (process.env.DB_NAME && !process.env.DB_NAME.endsWith('_test')) {
  throw new Error(
    `Las pruebas no pueden apuntar a la base "${process.env.DB_NAME}": su nombre debe terminar en "_test".`
  );
}

process.env.JWT_SECRET ||= 'test-secret';
process.env.LOG_LEVEL ||= 'error'; // sin ruido: los 4xx esperados se registran como warn

// Ninguna prueba debe mandar correos de verdad (ni intentarlo contra un SMTP real): el
// transporte se reemplaza para todos los archivos y los tests revisan `sendMail.mock.calls`.
vi.mock('../src/services/mailer.js', () => ({ sendMail: vi.fn().mockResolvedValue({}) }));
