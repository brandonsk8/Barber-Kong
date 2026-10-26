variable "vercel_team_id" {
  description = "ID del equipo de Vercel (vacío si los proyectos viven en una cuenta personal, no en un equipo)."
  type        = string
  default     = null
}

variable "supabase_organization_id" {
  description = "Slug de la organización de Supabase (Organization Settings > General)."
  type        = string
}

variable "supabase_region" {
  description = "Región del proyecto de Supabase."
  type        = string
  default     = "us-east-1"
}

variable "github_repo_frontend" {
  description = "Repositorio de GitHub del frontend, formato <usuario>/<repo>."
  type        = string
  default     = "brandonsk8/Barber-Kong-Frontend"
}

variable "github_repo_backend" {
  description = "Repositorio de GitHub del backend, formato <usuario>/<repo>."
  type        = string
  default     = "brandonsk8/Barber-Kong"
}

variable "api_url" {
  description = "URL pública de la API en producción, usada como VITE_API_URL del frontend."
  type        = string
  default     = "https://barber-kong-api.vercel.app/api"
}

variable "frontend_url" {
  description = "URL pública del frontend en producción, usada por el backend (p.ej. enlaces de recuperación de contraseña)."
  type        = string
  default     = "https://barberkongs.vercel.app"
}

variable "jwt_secret" {
  description = "Secreto para firmar los JWT de sesión. Sensible: pasarlo por TF_VAR_jwt_secret, nunca en un .tfvars versionado."
  type        = string
  sensitive   = true
}

variable "db_app_password" {
  description = "Contraseña del rol de base de datos de mínimo privilegio (barberkong_app) que usa la API. Sensible."
  type        = string
  sensitive   = true
}
