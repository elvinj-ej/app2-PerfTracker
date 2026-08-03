FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY . .
# nginx serves this build at "/" (see nginx.conf), unlike the standalone SQLite
# deployment which defaults to /PerfTracker - keep in sync with docker-compose.yml's
# backend URL_PREFIX.
ENV VITE_BASE_PATH=/
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
