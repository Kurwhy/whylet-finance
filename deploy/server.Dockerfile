FROM node:24-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY server/package*.json ./
RUN npm ci
COPY server/prisma ./prisma
COPY server/prisma.config.ts ./
# Hanya generate; URL build ini tidak mempunyai kredensial dan tidak pernah dihubungi.
RUN DATABASE_URL=mysql://build-only.invalid/unused npm run generate
COPY server/src ./src
ENV NODE_ENV=production PORT=5001
USER node
EXPOSE 5001
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://127.0.0.1:5001/api/v1/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "src/server.js"]
