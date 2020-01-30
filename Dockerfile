FROM node:12.14-alpine AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.json /app/

RUN npm install
COPY src /app/src

RUN npm run build

FROM node:12.14-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

COPY package.json package-lock.json /app/

RUN npm ci

COPY --from=build /app/dist /app/dist
# COPY public public

EXPOSE 3000
CMD ["npm", "start"]
