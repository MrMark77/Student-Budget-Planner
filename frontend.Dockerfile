FROM node:22-alpine

WORKDIR /app

COPY frontend/package.json frontend/tsconfig.json frontend/vite.config.ts ./
COPY frontend/src ./src

RUN npm install

EXPOSE 3000

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]


