FROM node:22-alpine

WORKDIR /app

# Install dependencies cleanly
COPY package.json package-lock.json* bun.lock* ./
RUN npm install --no-audit --no-fund

# Copy source code and build production bundle
COPY . .
RUN npm run build

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["npm", "start"]
