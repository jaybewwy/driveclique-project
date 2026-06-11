FROM node:20-alpine

WORKDIR /app

# Copy package files first — layer cache means npm ci only reruns on dependency changes
COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:5000/ || exit 1

CMD ["node", "server.js"]
