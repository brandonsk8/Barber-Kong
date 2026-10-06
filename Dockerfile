# Imagen del backend de Barber Kong. La misma imagen sirve para dos servicios del
# docker-compose.yml: `migrate` (aplica migraciones pendientes + seed y termina) y
# `api` (levanta el servidor).
FROM node:20-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .

EXPOSE 3000

# Las variables de entorno las inyecta docker compose, no un archivo .env.* (por eso
# se llama a node directo en vez de `npm start`, que exige .env.prod).
CMD ["node", "index.js"]
