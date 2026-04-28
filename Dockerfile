FROM node:20-alpine
WORKDIR /app

RUN apk add --no-cache openssl

COPY package*.json ./
RUN npm ci --ignore-scripts

COPY . .

# Generate Prisma client + build Next.js (tanpa migrate — dijalankan saat startup)
RUN npx prisma generate
RUN npx next build

EXPOSE 3000
ENV NODE_ENV=production
ENV PORT=3000

CMD ["npm", "start"]
