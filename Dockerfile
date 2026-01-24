# Build stage
FROM node:18-alpine as build
WORKDIR /app
COPY package*.json ./
# Build deps for canvas etc. (needed for devDeps like canvas during install/build if referenced)
RUN apk add --no-cache build-base g++ cairo-dev jpeg-dev pango-dev giflib-dev
RUN npm install
COPY . .
RUN npm run build

# Production stage (Node server)
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
# Only install production dependencies (express, morgan, etc.)
# We don't need build tools for canvas here as it's a devDep and not used in prod server
RUN npm install --omit=dev
COPY server.js .
COPY --from=build /app/dist ./dist

ENV PORT=80
EXPOSE 80
CMD ["node", "server.js"]
