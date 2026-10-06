---
name: revisar-ui
description: Revisar una pantalla del frontend de Barber Kong en móvil, tablet y escritorio (responsive, mensajes de éxito/error/carga, coherencia visual, accesibilidad básica) usando el MCP de Playwright.
---

# Revisión de UI con Playwright MCP

Requiere el sistema levantado (skill `verificar-entorno`) y el MCP `playwright`.

## Pasos

1. Navegar a `http://localhost:5173` y, si la pantalla requiere sesión, iniciar sesión
   con la cuenta demo del rol correspondiente (`resources/db/seed.sql`).
2. Para cada tamaño — **375×812** (móvil), **768×1024** (tablet), **1366×768**
   (escritorio) — redimensionar, tomar snapshot/captura y revisar:
   - **Responsive**: sin scroll horizontal, tablas usables (scroll interno o tarjetas),
     menús accesibles, botones no cortados.
   - **Retroalimentación**: enviar el formulario vacío/inválido → mensaje de error
     visible; acción válida → mensaje de éxito; acciones lentas → `Spinner`; acciones
     destructivas → confirmación (`Modal`).
   - **Coherencia visual**: mismos colores, tipografía y espaciado que el resto de
     pantallas (`src/index.css`), componentes compartidos (`Alert`, `Modal`, `Spinner`)
     en vez de estilos nuevos sueltos.
   - **Accesibilidad básica**: contraste legible, texto ≥ 14px, inputs con `label` o
     `placeholder`, foco visible al navegar con Tab.
3. Revisar la consola del navegador: sin errores ni requests fallidos.

## Reporte

Tabla por tamaño de pantalla con problemas encontrados (pantalla, qué falla, archivo
probable en `Barber-Kong-Frontend/frontend/src/`). No cambiar código salvo que el
integrante lo pida. No enviar formularios que creen datos reales fuera del entorno local.
