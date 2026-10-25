-- Supabase expone automáticamente cada tabla del esquema "public" por su API REST
-- (PostgREST) usando la clave pública "anon". Sin RLS, cualquiera con esa clave podría
-- leer o escribir cualquier tabla desde el navegador — incluida "users", con los hashes
-- de contraseña. El backend se conecta a través del connection pooler como el rol
-- "postgres" (superusuario), que SIEMPRE puede saltarse RLS, así que esto no cambia en
-- nada el comportamiento de la API ni de ninguna query existente.
--
-- No se agregan políticas (POLICY a propósito: con RLS activo y cero políticas, nadie
-- fuera de un rol superusuario puede leer ni escribir una fila por fuera del backend.
-- Es la opción más simple y segura dado que esta app nunca expone la base de datos
-- directamente al navegador — todo pasa por la API.
--
-- Idempotente: volver a correr ENABLE ROW LEVEL SECURITY sobre una tabla que ya la
-- tiene activa no da error.

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE barberos ENABLE ROW LEVEL SECURITY;
ALTER TABLE disponibilidad_barberos ENABLE ROW LEVEL SECURITY;
ALTER TABLE servicios ENABLE ROW LEVEL SECURITY;
ALTER TABLE insumos ENABLE ROW LEVEL SECURITY;
ALTER TABLE servicio_insumos ENABLE ROW LEVEL SECURITY;
ALTER TABLE citas ENABLE ROW LEVEL SECURITY;
ALTER TABLE insumo_movimientos ENABLE ROW LEVEL SECURITY;
ALTER TABLE notificaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE password_reset_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE two_factor_codes ENABLE ROW LEVEL SECURITY;
