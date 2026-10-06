#!/usr/bin/env node
// Crea el siguiente archivo de migración numerado en resources/db/migrations/.
//
// Uso: npm run db:new -- agregar_telefono_clientes
//   -> resources/db/migrations/0005_agregar_telefono_clientes.sql

import fs from 'node:fs/promises';
import path from 'node:path';
import { migrationsDir, readMigrationFiles, MIGRATION_FILE_PATTERN } from './migrate.mjs';

const description = process.argv
  .slice(2)
  .join('_')
  .toLowerCase()
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '') // quita tildes: "migración" -> "migracion"
  .replace(/[^a-z0-9]+/g, '_')
  .replace(/^_+|_+$/g, '');

if (!description) {
  console.error('Falta la descripción. Uso: npm run db:new -- <descripcion>');
  process.exit(1);
}

const files = await readMigrationFiles();
const lastNumber = files.length > 0 ? Number(files.at(-1).version.slice(0, 4)) : 0;
const number = String(lastNumber + 1).padStart(4, '0');
const filename = `${number}_${description}.sql`;

if (!MIGRATION_FILE_PATTERN.test(filename)) {
  console.error(`Nombre generado inválido: ${filename}`);
  process.exit(1);
}

const template = `-- Migración ${number}: ${description.replace(/_/g, ' ')}
--
-- DDL idempotente (IF NOT EXISTS / IF EXISTS). Una vez aplicada en un ambiente
-- compartido no se edita: cualquier cambio posterior va en una migración nueva.

`;

await fs.writeFile(path.join(migrationsDir, filename), template, { flag: 'wx' });
console.log(`Creada: resources/db/migrations/${filename}`);
