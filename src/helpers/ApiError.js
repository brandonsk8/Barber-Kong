// Error con intención: status HTTP + mensaje ya pensado para mostrarse al usuario final
// (RNF-USA-03: mensajes comprensibles, no códigos técnicos). Los módulos lanzan esto
// (o dejan que un error real se propague) y llaman a next(error); el errorHandler
// centralizado en src/server/app.js decide qué responder.
export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }

  static badRequest(message) {
    return new ApiError(400, message);
  }

  static unauthorized(message = 'No autenticado.') {
    return new ApiError(401, message);
  }

  static forbidden(message = 'No tienes permiso para esta acción.') {
    return new ApiError(403, message);
  }

  static notFound(message = 'Recurso no encontrado.') {
    return new ApiError(404, message);
  }

  static conflict(message) {
    return new ApiError(409, message);
  }
}
