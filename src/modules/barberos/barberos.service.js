import bcrypt from 'bcrypt';
import { ApiError } from '../../helpers/ApiError.js';

const SALT_ROUNDS = 10;

// Franja de atención por defecto (9:00-19:00, receso 13:00-14:00 excluido acá porque
// el frontend ya lo bloquea localmente) — se usa solo para expandir qué horas de una
// hora de duración quedan cubiertas por una cita ya agendada.
function slotsCubiertos(horaInicio, horaFin) {
  const start = Number(horaInicio.slice(0, 2));
  const end = Number(horaFin.slice(0, 2));
  const endMinutes = Number(horaFin.slice(3, 5));
  const slots = [];
  for (let h = start; h < end || (h === end && endMinutes > 0 && h === start); h += 1) {
    slots.push(`${String(h).padStart(2, '0')}:00`);
  }
  return slots.length ? slots : [horaInicio.slice(0, 5)];
}

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

// Horario por defecto de la barbería al crear un barbero: domingo a jueves, 9:00-19:00.
const HORARIO_POR_DEFECTO = [0, 1, 2, 3, 4].map((dia) => ({
  dia_semana: dia,
  hora_inicio: '09:00',
  hora_fin: '19:00',
}));

// 'lunes' ya es plural; 'domingo' y 'sábado' necesitan la 's' ("los domingos").
const enPlural = (dia) => (dia.endsWith('s') ? dia : `${dia}s`);

// 0 = domingo ... 6 = sábado, igual que disponibilidad_barberos.dia_semana. Se calcula
// en UTC a propósito: la fecha ya es solo-día y no debe correrse por zona horaria.
function diaSemanaDe(fecha) {
  const [y, m, d] = fecha.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

// Reglas que el JSON Schema no puede expresar: cada bloque termina después de empezar y
// los bloques de un mismo día no se traslapan. Los mensajes dicen qué bloque está mal
// (UC-22/UC-23: "impide guardar y señala los campos con error").
function validarHorario(horario) {
  horario.forEach((b, i) => {
    if (b.hora_fin <= b.hora_inicio) {
      throw ApiError.badRequest(
        `Horario, bloque ${i + 1} (${DIAS[b.dia_semana]}): la hora de fin debe ser posterior a la de inicio.`
      );
    }
  });

  const porDia = new Map();
  horario.forEach((b, i) => {
    porDia.set(b.dia_semana, [...(porDia.get(b.dia_semana) || []), { ...b, n: i + 1 }]);
  });
  porDia.forEach((bloques, dia) => {
    const ordenados = [...bloques].sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio));
    for (let i = 1; i < ordenados.length; i += 1) {
      if (ordenados[i].hora_inicio < ordenados[i - 1].hora_fin) {
        throw ApiError.badRequest(
          `Horario (${DIAS[dia]}): los bloques ${ordenados[i - 1].n} y ${ordenados[i].n} se traslapan.`
        );
      }
    }
  });
}

// "Hoy" en la zona horaria de la barbería (AAAA-MM-DD), no la del servidor.
function hoyGuatemala() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Guatemala' }).format(new Date());
}

// Solo el administrador o el propio barbero pueden tocar la agenda de ese barbero.
function assertPuedeGestionar(barbero, requester) {
  if (requester.role === 'admin') return;
  if (requester.role === 'barbero' && barbero.user_id === requester.id) return;
  throw ApiError.forbidden('Solo puedes gestionar tu propia agenda.');
}

export function createBarberosService({ repository }) {
  return {
    async listActive() {
      return repository.findAllActive();
    },

    async listAll() {
      return repository.findAll();
    },

    async getById(id) {
      const barbero = await repository.findById(id);
      if (!barbero) throw ApiError.notFound('Barbero no encontrado.');
      return barbero;
    },

    // Usado por auth.service.js para enriquecer el JWT/perfil de un usuario con role
    // 'barbero' con el id de su fila en `barberos` (distinto del id de `users`), que es
    // el que citas.service.js espera como barbero_id.
    async getByUserId(userId) {
      return repository.findByUserId(userId);
    },

    // Barbero con su horario semanal (endpoint público). No incluye el correo ni el id de
    // su cuenta de acceso: getById los conserva porque otros flujos los necesitan.
    async getDetalle(id) {
      const { email, user_id: userId, ...publico } = await this.getById(id);
      return { ...publico, horario: await repository.findHorario(id) };
    },

    async getHorario(id) {
      await this.getById(id);
      return repository.findHorario(id);
    },

    async create({ nombre, especialidad, email, password, horario = HORARIO_POR_DEFECTO }) {
      validarHorario(horario);
      const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
      try {
        return await repository.createWithUser({ nombre, especialidad, email, passwordHash, horario });
      } catch (err) {
        if (err.code === '23505') throw ApiError.conflict('Ya existe una cuenta con ese correo.');
        throw err;
      }
    },

    async update(id, { horario, ...datos }) {
      if (horario) validarHorario(horario);
      const barbero = await repository.update(id, datos, horario);
      if (!barbero) throw ApiError.notFound('Barbero no encontrado.');
      return { ...barbero, horario: await repository.findHorario(id) };
    },

    // ¿Puede el barbero atender una cita en [horaInicio, horaFin] de esa fecha? La usa
    // citas.service.js al agendar/reprogramar, para que ninguna cita caiga fuera del
    // horario que el administrador le configuró.
    async assertAtiende({ barberoId, fecha, horaInicio, horaFin }) {
      if (await repository.findAusencia(barberoId, fecha)) {
        throw ApiError.conflict('El barbero no estará disponible ese día. Elige otra fecha.');
      }
      const dia = diaSemanaDe(fecha);
      const bloques = await repository.findHorarioDelDia(barberoId, dia);
      if (bloques.length === 0) {
        throw ApiError.conflict(`El barbero no atiende los ${enPlural(DIAS[dia])}. Elige otro día.`);
      }
      const inicio = horaInicio.slice(0, 5);
      const fin = horaFin.slice(0, 5);
      const cabe = fin > inicio && bloques.some((b) => inicio >= b.hora_inicio && fin <= b.hora_fin);
      if (!cabe) {
        throw ApiError.conflict('Ese horario está fuera del horario de atención del barbero.');
      }
    },

    async deactivate(id) {
      const barbero = await repository.setActive(id, false);
      if (!barbero) throw ApiError.notFound('Barbero no encontrado.');
      return barbero;
    },

    async activate(id) {
      const barbero = await repository.setActive(id, true);
      if (!barbero) throw ApiError.notFound('Barbero no encontrado.');
      return barbero;
    },

    async getDisponibilidad(barberoId, fecha) {
      await this.getById(barberoId);
      const citas = await repository.findCitasDelDia(barberoId, fecha);
      const ocupadas = new Set();
      citas.forEach((c) => {
        slotsCubiertos(c.hora_inicio, c.hora_fin).forEach((s) => ocupadas.add(s));
      });
      // `trabaja` y `bloques` le dicen al frontend qué horas ofrecer ese día según el
      // horario del barbero (si no trabaja ese día, no hay horas que mostrar).
      const ausente = Boolean(await repository.findAusencia(barberoId, fecha));
      const bloques = ausente ? [] : await repository.findHorarioDelDia(barberoId, diaSemanaDe(fecha));
      return { ocupadas: Array.from(ocupadas).sort(), trabaja: bloques.length > 0, bloques, ausente };
    },

    // ----- Días en que el barbero no estará disponible -----

    async listAusencias(barberoId, requester) {
      const barbero = await this.getById(barberoId);
      assertPuedeGestionar(barbero, requester);
      return repository.findAusencias(barberoId, hoyGuatemala());
    },

    async crearAusencia(barberoId, { fecha, motivo }, requester) {
      const barbero = await this.getById(barberoId);
      assertPuedeGestionar(barbero, requester);

      if (fecha < hoyGuatemala()) throw ApiError.badRequest('No puedes marcar un día que ya pasó.');

      // No se cancelan citas de clientes por detrás: si ya hay citas ese día, primero se
      // cancelan o reprograman (mismo criterio que al desactivar un barbero con citas).
      const citas = await repository.findCitasDelDia(barberoId, fecha);
      if (citas.length > 0) {
        throw ApiError.conflict(
          `Ese día ya hay ${citas.length} cita(s) agendada(s) con este barbero. Cancélalas o reprográmalas antes de marcarlo como no disponible.`
        );
      }

      try {
        return await repository.createAusencia({ barberoId, fecha, motivo });
      } catch (err) {
        if (err.code === '23505') throw ApiError.conflict('Ese día ya está marcado como no disponible.');
        throw err;
      }
    },

    async quitarAusencia(barberoId, ausenciaId, requester) {
      const barbero = await this.getById(barberoId);
      assertPuedeGestionar(barbero, requester);
      const eliminada = await repository.deleteAusencia(ausenciaId, barberoId);
      if (!eliminada) throw ApiError.notFound('Esa ausencia no existe.');
    },
  };
}
