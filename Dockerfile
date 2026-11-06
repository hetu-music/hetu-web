FROM node:26-alpine AS builder

WORKDIR /app

RUN npm install -g pnpm@12

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

ENV SUPABASE_URL=placeholder
ENV SUPABASE_SECRET_API=placeholder
ENV NEXT_PUBLIC_TURNSTILE_SITE_KEY=0x4AAAAAACFYZvRbKjlgehcx

COPY . .

RUN pnpm build

FROM node:26-alpine AS runner

WORKDIR /app

# 安装 curl (用于 start.sh 中的就绪探测与 revalidate 请求)
RUN apk add --no-cache curl

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# 只复制独立构建所需的文件，并直接归属运行用户
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/scripts ./scripts

# ISR 再生会写入 .next/cache，该目录必须对运行用户可写
RUN mkdir -p .next/cache \
    && chown -R node:node .next \
    && chmod +x ./scripts/start.sh

# 以非 root 运行
USER node

EXPOSE 3000

CMD ["./scripts/start.sh"]
