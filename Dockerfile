# Ghostrun public demo: the app, the test games and the headless Chromium the ghosts play in.
# The base image ships the browsers for this exact Playwright version (package.json: playwright 1.65.1).
FROM mcr.microsoft.com/playwright:v1.65.1-noble

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev && mkdir -p runs && chown -R pwuser:pwuser /app/runs

# Public demo protections (src/guard.mjs), behind the platform's proxy. The API key is a secret set on
# the platform (MODEL_API_KEY), never in this file. GHOST_BUDGET_USD caps the spending of this server.
ENV NODE_ENV=production \
    GHOSTRUN_PUBLIC=1 \
    TRUST_PROXY=1 \
    PORT=7860 \
    GHOST_BUDGET_USD=5

USER pwuser
EXPOSE 7860
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://localhost:'+(process.env.PORT||7860)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "src/server.mjs"]
