# Infraestructura como código — Barber Kongs

Este módulo de Terraform documenta, en código, la infraestructura cloud del
proyecto: el proyecto de base de datos en **Supabase** y los dos proyectos de
**Vercel** (frontend y backend), con sus variables de entorno y dominios.

## Qué hace (y qué NO hace) este código

- **Documenta** la infraestructura real: declara exactamente los mismos
  proyectos, dominios y variables de entorno que ya existen, creados a mano
  desde los dashboards de Vercel y Supabase a lo largo del proyecto.
- **No se ha aplicado todavía.** Nunca se corrió `terraform apply` contra la
  infraestructura real. Si se corriera "en frío" (sin importar primero),
  Terraform intentaría **crear proyectos nuevos** con estos nombres —
  rompiendo el despliegue que ya funciona — en vez de adoptar los que ya
  existen.
- Es el entregable de la Tarea 3 (Infraestructura como código) del checklist
  de Fase 3: sirve para demostrar que la infraestructura puede describirse,
  versionarse y reproducirse de forma declarativa, no que ya se gestiona así
  en el día a día del proyecto.

## Providers usados

| Provider | Fuente | Qué gestiona |
|---|---|---|
| Vercel | [`vercel/vercel`](https://registry.terraform.io/providers/vercel/vercel/latest) | Proyectos de frontend y backend, variables de entorno, dominios |
| Supabase | [`supabase/supabase`](https://registry.terraform.io/providers/supabase/supabase/latest) | Proyecto de base de datos Postgres |

## Antes de aplicar esto contra la infraestructura real

1. **Instalar Terraform** (>= 1.6) y correr `terraform init` en esta carpeta.
2. **Autenticación**, por variables de entorno (nunca hardcodeadas en el código):
   ```bash
   export VERCEL_API_TOKEN="<token de Vercel>"
   export SUPABASE_ACCESS_TOKEN="<access token de Supabase>"
   export TF_VAR_jwt_secret="<el JWT_SECRET real, el mismo que ya está en Vercel>"
   export TF_VAR_db_app_password="<la contraseña real del rol barberkong_app>"
   ```
3. **Importar** los recursos que ya existen, para que Terraform los adopte en
   vez de intentar crearlos de nuevo:
   ```bash
   terraform import supabase_project.barberkong <project-ref-de-supabase>
   terraform import vercel_project.frontend <project-id-del-frontend-en-vercel>
   terraform import vercel_project.backend <project-id-del-backend-en-vercel>
   ```
4. Recién después de importar, correr `terraform plan` y revisar que el plan
   salga **sin cambios** (o solo con los cambios esperados) antes de
   considerar un `terraform apply`.

## Estructura

```
infra/terraform/
├── versions.tf              # providers y su versión, configuración de autenticación
├── variables.tf              # inputs (organización de Supabase, repos de GitHub, URLs, secretos)
├── main.tf                   # supabase_project, vercel_project (frontend y backend), env vars, dominios
├── outputs.tf                 # URLs públicas y referencia del proyecto de Supabase
├── terraform.tfvars.example   # plantilla de valores no sensibles
└── .gitignore                 # excluye state, .terraform/ y el .tfvars real
```

## Relación con el resto de la Fase 3

- Los valores de las variables de entorno (`DB_HOST`, `DB_USER`, etc.) son
  los mismos documentados en la sección "Variables de entorno" del documento
  de Infraestructura, Despliegue y Backup, incluyendo el rol de mínimo
  privilegio `barberkong_app` (ver sección 4, IAM y mínimo privilegio).
- Las migraciones de base de datos siguen gestionándose aparte, con el
  workflow de GitHub Actions (`.github/workflows/migrate.yml`) — Terraform
  no corre migraciones SQL, solo aprovisiona el proyecto y las variables.
