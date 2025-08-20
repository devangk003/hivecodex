FROM node:20.11.1-slim

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

RUN npm run build

ENV NODE_ENV=production

EXPOSE 5000

CMD ["node", "dist/server.js"]