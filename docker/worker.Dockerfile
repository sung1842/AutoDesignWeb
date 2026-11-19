# worker 이미지(06장 6.10, 09장 9.1.2). 베이스 버전은 package.json의 @playwright/test(1.63.0)와 일치해야 한다(CI 비교).
# 로컬 환경에는 Docker가 없어 빌드·실행은 needs_ci(worker-image-build).
FROM mcr.microsoft.com/playwright:v1.63.0-noble
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/worker/package.json apps/worker/
COPY packages ./packages
RUN pnpm install --frozen-lockfile --filter @tastefit/worker-app...
COPY apps/worker ./apps/worker
RUN pnpm --filter @tastefit/worker-app... build
EXPOSE 8081
CMD ["node", "apps/worker/dist/index.js"]
