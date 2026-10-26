terraform {
  required_version = ">= 1.6"

  required_providers {
    vercel = {
      source  = "vercel/vercel"
      version = "~> 0.3"
    }
    supabase = {
      source  = "supabase/supabase"
      version = "~> 1.0"
    }
  }
}

# Autenticación de los providers (NO se pone acá, se pone en variables de entorno
# al correr terraform, para no dejar tokens en el repositorio):
#
#   export VERCEL_API_TOKEN="<token de Vercel, con permisos sobre el equipo>"
#   export SUPABASE_ACCESS_TOKEN="<access token personal de Supabase>"
#
# Con esas dos variables de entorno puestas, no hace falta declarar "provider"
# bloques con credenciales — ambos providers las leen solos.
provider "vercel" {
  team = var.vercel_team_id
}

provider "supabase" {}
