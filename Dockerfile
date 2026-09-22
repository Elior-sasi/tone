FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production FFMPEG_PATH=/usr/bin/ffmpeg NEXT_TELEMETRY_DISABLED=1
COPY package*.json ./
COPY scripts ./scripts
RUN npm ci --include=dev
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
