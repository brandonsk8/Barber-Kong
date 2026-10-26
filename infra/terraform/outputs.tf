output "frontend_url" {
  description = "URL pública del frontend en producción."
  value       = "https://${vercel_project_domain.frontend.domain}"
}

output "backend_url" {
  description = "URL pública de la API en producción."
  value       = "https://${vercel_project_domain.backend.domain}"
}

output "supabase_project_ref" {
  description = "Referencia del proyecto de Supabase (usada en DB_USER, en connection strings, etc.)."
  value       = supabase_project.barberkong.id
}

output "db_host" {
  description = "Host del pooler de sesión de Supabase (puerto 5432, requerido por el runner de migraciones)."
  value       = "aws-0-${var.supabase_region}.pooler.supabase.com"
}
