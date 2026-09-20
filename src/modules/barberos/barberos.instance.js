// Instancia compartida del service de barberos (repositorio real ya inyectado), para
// que auth.service.js pueda enriquecer el perfil de un usuario con role 'barbero' con
// su barberos.id sin importar el repositorio de este módulo directamente.
import * as repository from './barberos.repository.js';
import { createBarberosService } from './barberos.service.js';

export const barberosService = createBarberosService({ repository });
