// Instancia compartida del service de inventario (repositorio real ya inyectado), para
// que citas.controller.js (EP-02) pueda llamar a descontarPorServicio/notificarStockBajo
// sin duplicar la lógica de negocio, tal como lo pide PLAN_FASE2.md para UC-16/UC-17.
import * as repository from './inventario.repository.js';
import { createInventarioService } from './inventario.service.js';

export const inventarioService = createInventarioService({ repository });
