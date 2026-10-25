import winston from 'winston';
import 'winston-daily-rotate-file';

const isProduction = process.env.NODE_ENV === 'production';
// Vercel pone esta variable automáticamente en sus funciones serverless. Su filesystem
// es de solo lectura (salvo /tmp), así que ahí nunca se agrega el transport de archivo
// rotado aunque NODE_ENV sea production — solo consola (Vercel ya captura y centraliza
// stdout/stderr de cada función en sus propios logs).
const isVercel = process.env.VERCEL === '1';

// Bitácora central: nada de console.log para errores relevantes (fue anti-patrón
// identificado en otros proyectos del equipo). En dev, consola legible; en producción
// fuera de Vercel, además archivo rotado diario para poder revisar incidentes después
// del hecho.
const transports = [
  new winston.transports.Console({
    format: isProduction
      ? winston.format.json()
      : winston.format.combine(winston.format.colorize(), winston.format.simple()),
  }),
];

if (isProduction && !isVercel) {
  transports.push(
    new winston.transports.DailyRotateFile({
      dirname: 'logs',
      filename: 'barber-kong-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxFiles: '14d',
    })
  );
}

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
  format: winston.format.combine(winston.format.timestamp(), winston.format.errors({ stack: true })),
  transports,
});
