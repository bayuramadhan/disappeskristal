FROM node:20-alpine
WORKDIR /app

RUN apk add --no-cache openssl

# Install ALL deps (termasuk dev) agar prisma CLI + ts-node tersedia saat startup
COPY package*.json ./
RUN npm ci --ignore-scripts

COPY . .

RUN npx prisma generate
RUN npm run build

# Copy static assets ke standalone output agar ter-serve dengan benar
RUN cp -r .next/static .next/standalone/.next/static

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV NODE_ENV=production

CMD ["node", ".next/standalone/server.js"]
