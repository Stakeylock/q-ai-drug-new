FROM node:20-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001
ENV HOSTNAME="0.0.0.0"

# Copy pre-built standalone server and static assets from host
COPY public ./public
COPY .next/standalone ./
COPY .next/static ./.next/static

EXPOSE 3001

CMD ["node", "server.js"]
