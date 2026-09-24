FROM node:24-alpine@sha256:ebfe2f90462722a7a4de65e91990e97fe0d401c70e0e762c5b53302f905ec1c1 AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY angular.json tsconfig*.json .postcssrc.json ./
COPY src/ src/
COPY public/ public/
RUN npm run build -- --configuration production

FROM nginx:stable-alpine@sha256:73c75df4075c918f91017fdda46ad81e55e5af77ba3a64ca3d5014bd9244fe7f
COPY nginx.conf /etc/nginx/nginx.conf
COPY --from=build /app/dist/japanese-learning/browser/ /usr/share/nginx/html/
USER 101:101
EXPOSE 8080
ENTRYPOINT ["nginx", "-g", "daemon off;"]
