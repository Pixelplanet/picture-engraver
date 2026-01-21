# Build stage
FROM node:18-alpine as build
WORKDIR /app
COPY package*.json ./
RUN apk add --no-cache build-base g++ cairo-dev jpeg-dev pango-dev giflib-dev
RUN npm install
COPY . .
RUN npm run build

# Production stage
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
