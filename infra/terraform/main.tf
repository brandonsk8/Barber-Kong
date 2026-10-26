# ---------------------------------------------------------------------------
# Barber Kongs — Infraestructura como código (Tarea 3, Fase 3)
#
# IMPORTANTE: este código DOCUMENTA la infraestructura que ya existe y fue
# creada a mano en Vercel y Supabase (ver sección 1 del documento de
# Infraestructura, Despliegue y Backup). NO se ha corrido "terraform apply"
# contra la infraestructura real todavía — hacerlo sin un "terraform import"
# previo intentaría CREAR proyectos nuevos en vez de adoptar los existentes,
# lo que rompería lo que ya está funcionando. El README explica cómo
# importar antes de aplicar.
# ---------------------------------------------------------------------------

# --- Supabase: base de datos Postgres -------------------------------------

resource "supabase_project" "barberkong" {
  organization_id   = var.supabase_organization_id
  name              = "BarberKongs"
  database_password = var.db_app_password
  region            = var.supabase_region

  # La contraseña y el plan se gestionan hoy desde el dashboard de Supabase
  # (rotación de contraseñas, reseteo); no queremos que un "apply" la pise.
  lifecycle {
    ignore_changes = [database_password]
  }
}

# --- Vercel: frontend (React + Vite) ---------------------------------------

resource "vercel_project" "frontend" {
  name      = "frontend"
  framework = "vite"

  git_repository = {
    type = "github"
    repo = var.github_repo_frontend
  }

  # El repo tiene la app dentro de una subcarpeta "frontend/".
  root_directory = "frontend"
}

resource "vercel_project_environment_variable" "frontend_api_url" {
  project_id = vercel_project.frontend.id
  key        = "VITE_API_URL"
  value      = var.api_url
  target     = ["production", "preview"]
}

resource "vercel_project_domain" "frontend" {
  project_id = vercel_project.frontend.id
  domain     = "barberkongs.vercel.app"
}

# --- Vercel: backend (API Node/Express-style) -------------------------------

resource "vercel_project" "backend" {
  name      = "barber-kong-api"
  framework = null

  git_repository = {
    type = "github"
    repo = var.github_repo_backend
  }
}

locals {
  # DB_USER necesita el sufijo ".<project-ref>" que exige el pooler de Supabase
  # (Supavisor) para saber a qué proyecto enrutar la conexión.
  db_user = "barberkong_app.${supabase_project.barberkong.id}"
}

resource "vercel_project_environment_variable" "backend_env" {
  for_each = {
    DB_HOST         = "aws-0-${var.supabase_region}.pooler.supabase.com"
    DB_PORT         = "5432"
    DB_NAME         = "postgres"
    DB_USER         = local.db_user
    DB_PASSWORD     = var.db_app_password
    DB_SSL          = "true"
    JWT_SECRET      = var.jwt_secret
    JWT_EXPIRES_IN  = "2h"
    FRONTEND_URL    = var.frontend_url
  }

  project_id = vercel_project.backend.id
  key        = each.key
  value      = each.value
  target     = ["production"]
  sensitive  = contains(["DB_PASSWORD", "JWT_SECRET"], each.key)
}

resource "vercel_project_domain" "backend" {
  project_id = vercel_project.backend.id
  domain     = "barber-kong-api.vercel.app"
}
