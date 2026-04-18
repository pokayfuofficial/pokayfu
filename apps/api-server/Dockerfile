FROM node:21-alpine
WORKDIR /app

# Копируем весь монорепо
COPY ../../ .

# Устанавливаем зависимости
RUN npm install --legacy-peer-deps

# Генерируем Prisma клиент
RUN cd apps/api-server && npx prisma generate

# Собираем TypeScript
RUN cd apps/api-server && npx tsc --skipLibCheck

EXPOSE 3001

CMD ["sh", "-c", "cd apps/api-server && npx prisma migrate deploy && node dist/index.js"]
