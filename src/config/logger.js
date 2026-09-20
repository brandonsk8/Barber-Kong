import winston from 'winston';
import 'winston-daily-rotate-file';

const isProduction = process.env.NODE_ENV === 'production';

// Bitácora central: nada de console.log para errores relevantes (fue anti-patrón
// identificado en otros proyectos del equipo). En dev, consola legible; en producción,
// además archivo rotado diario para poder revisar incidentes después del hecho.
const transports = [
  new winston.transports.Console({
    format: isProduction
      ? winston.format.json()
      : winston.format.combine(winston.format.colorize(), winston.format.simple()),
  }),
];

if (isProduction) {
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
