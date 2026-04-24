# ── Étape 1 : Build de l'application React ──────────────────────────────────
FROM node:18-alpine AS builder

WORKDIR /app

COPY package.json yarn.lock ./

# Supprime le plugin visuel Emergent (outil de dev cloud uniquement, inutile en prod)
RUN node -e " \
    const p = require('./package.json'); \
    delete p.devDependencies['@emergentbase/visual-edits']; \
    require('fs').writeFileSync('package.json', JSON.stringify(p, null, 2)); \
"

RUN yarn install

COPY . .

# REACT_APP_BACKEND_URL vide → appels API relatifs → Nginx fait le proxy vers /api/
ARG REACT_APP_BACKEND_URL=""
ENV REACT_APP_BACKEND_URL=$REACT_APP_BACKEND_URL
ENV NODE_ENV=production
ENV DISABLE_ESLINT_PLUGIN=true
ENV WDS_SOCKET_PORT=""

RUN yarn build

# ── Étape 2 : Servir le build statique via Nginx ─────────────────────────────
FROM nginx:alpine

COPY --from=builder /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
