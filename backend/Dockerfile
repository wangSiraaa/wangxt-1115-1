FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --production=false

COPY tsconfig.json ./
COPY src ./src

RUN npm run build

RUN mkdir -p /app/data

ENV NODE_ENV=production
ENV PORT=3001
ENV DB_PATH=/app/data/database.sqlite

EXPOSE 3001

CMD ["node", "dist/index.js"]
