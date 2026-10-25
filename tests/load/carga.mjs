// Pruebas de carga y concurrencia (manuales; NO forman parte de `npm test`).
//   npm run test:carga
// Mide, contra la base *_test y la app real levantada en un puerto efímero:
//   A) RNF-REN-01/02: 20 usuarios concurrentes consultando disponibilidad y catálogo; el p95
//      de la consulta de disponibilidad debe ser < 2 s y no debe haber errores.
//   B) RF-CIT-07 bajo concurrencia: varias rondas de N clientes pidiendo el mismo horario del
//      mismo barbero a la vez; cada ronda debería confirmar exactamente una cita.
// Imprime un resumen legible y, al final, una línea JSON (`RESULTADO_JSON=`) con los números.
import { query } from '../../src/config/db.js';
import { getApp, crearUsuario, crearServicio, login, fechaEn, cerrar } from '../helpers/fixtures.js';

if (process.env.NODE_ENV !== 'test' || !String(process.env.DB_NAME).endsWith('_test')) {
  console.error('Solo corre con NODE_ENV=test y una base cuyo nombre termine en "_test" (usa `npm run test:carga`).');
  process.exit(1);
}

const USUARIOS = Number(process.env.CARGA_USUARIOS || 20);
const SEGUNDOS = Number(process.env.CARGA_SEGUNDOS || 15);
const RONDAS = Number(process.env.CONC_RONDAS || 5);
const POR_RONDA = Number(process.env.CONC_CLIENTES || 30);

const percentil = (ordenado, p) => ordenado[Math.min(ordenado.length - 1, Math.ceil((p / 100) * ordenado.length) - 1)];
const stats = (ms) => {
  const o = [...ms].sort((a, b) => a - b);
  return { n: o.length, p50: percentil(o, 50), p95: percentil(o, 95), p99: percentil(o, 99), max: o[o.length - 1] };
};
const r1 = (x) => Math.round(x * 10) / 10;

const app = await getApp();
const server = app.listen(0);
const base = `http://127.0.0.1:${server.address().port}`;
const resultado = { entorno: { usuarios: USUARIOS, segundos: SEGUNDOS }, carga: {}, concurrencia: {} };

try {
  const barbero = await crearUsuario({ role: 'barbero' });
  await crearServicio();
  const fechaConsulta = fechaEn(10);

  // ---------- A) carga: USUARIOS concurrentes durante SEGUNDOS ----------
  const rutas = [
    { clave: 'disponibilidad', url: `${base}/api/barberos/${barbero.perfilId}/disponibilidad?fecha=${fechaConsulta}` },
    { clave: 'catalogo_servicios', url: `${base}/api/servicios` },
    { clave: 'lista_barberos', url: `${base}/api/barberos` },
  ];
  const lat = Object.fromEntries(rutas.map((r) => [r.clave, []]));
  let errores = 0;
  const fin = Date.now() + SEGUNDOS * 1000;
  const t0 = Date.now();

  await Promise.all(
    Array.from({ length: USUARIOS }, async (_, i) => {
      for (let k = i; Date.now() < fin; k++) {
        const ruta = rutas[k % rutas.length];
        const ini = performance.now();
        try {
          const res = await fetch(ruta.url);
          await res.arrayBuffer();
          if (!res.ok) errores++;
        } catch {
          errores++;
        }
        lat[ruta.clave].push(performance.now() - ini);
      }
    })
  );
  const duracion = (Date.now() - t0) / 1000;
  const total = Object.values(lat).reduce((s, l) => s + l.length, 0);
  resultado.carga = {
    solicitudes: total,
    solicitudes_por_segundo: r1(total / duracion),
    errores,
    por_ruta: Object.fromEntries(Object.entries(lat).map(([k, v]) => [k, Object.fromEntries(Object.entries(stats(v)).map(([a, b]) => [a, r1(b)]))])),
  };
  resultado.carga.cumple_RNF_REN_01 = resultado.carga.por_ruta.disponibilidad.p95 < 2000;
  resultado.carga.cumple_RNF_REN_02 = errores === 0;

  // ---------- B) concurrencia: rondas de reservas simultáneas ----------
  const servicio = await crearServicio({ duracion: 60 });
  const rondas = [];
  for (let r = 0; r < RONDAS; r++) {
    const b = await crearUsuario({ role: 'barbero' });
    const clientes = await Promise.all(Array.from({ length: POR_RONDA }, () => crearUsuario({ role: 'cliente' })));
    const sesiones = await Promise.all(clientes.map(login));
    const fecha = fechaEn(50 + r);
    const respuestas = await Promise.all(
      sesiones.map((h) =>
        fetch(`${base}/api/citas`, {
          method: 'POST',
          headers: { ...h, 'Content-Type': 'application/json' },
          body: JSON.stringify({ servicio_id: servicio.id, barbero_id: b.perfilId, fecha, hora_inicio: '10:00' }),
        })
      )
    );
    const confirmadas = respuestas.filter((x) => x.status === 201).length;
    const enBD = (await query(
      `SELECT count(*)::int AS n FROM citas WHERE barbero_id = $1 AND fecha = $2 AND estado != 'cancelada'`,
      [b.perfilId, fecha]
    )).rows[0].n;
    rondas.push({ ronda: r + 1, solicitudes: POR_RONDA, confirmadas, en_bd: enBD });
  }
  resultado.concurrencia = {
    rondas,
    rondas_con_doble_reserva: rondas.filter((x) => x.en_bd > 1).length,
    total_rondas: RONDAS,
    clientes_por_ronda: POR_RONDA,
  };

  // ---------- resumen ----------
  console.log(`\nA) Carga: ${USUARIOS} usuarios concurrentes durante ${SEGUNDOS} s`);
  console.log(`   ${total} solicitudes (${resultado.carga.solicitudes_por_segundo}/s), errores: ${errores}`);
  for (const [k, v] of Object.entries(resultado.carga.por_ruta)) {
    console.log(`   ${k.padEnd(20)} p50 ${v.p50} ms · p95 ${v.p95} ms · p99 ${v.p99} ms · máx ${v.max} ms`);
  }
  console.log(`   RNF-REN-01 (p95 de disponibilidad < 2000 ms): ${resultado.carga.cumple_RNF_REN_01 ? 'CUMPLE' : 'NO CUMPLE'}`);
  console.log(`   RNF-REN-02 (20 usuarios sin errores):        ${resultado.carga.cumple_RNF_REN_02 ? 'CUMPLE' : 'NO CUMPLE'}`);
  console.log(`\nB) Reservas simultáneas: ${RONDAS} rondas de ${POR_RONDA} clientes por el mismo horario`);
  for (const x of rondas) console.log(`   ronda ${x.ronda}: ${x.confirmadas} confirmadas, ${x.en_bd} en la base${x.en_bd > 1 ? '  <-- DOBLE RESERVA' : ''}`);
  console.log(`   Rondas con doble reserva: ${resultado.concurrencia.rondas_con_doble_reserva} de ${RONDAS}`);
  console.log(`\nRESULTADO_JSON=${JSON.stringify(resultado)}`);
} finally {
  server.close();
  await cerrar();
}
