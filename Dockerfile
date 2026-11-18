# The whole Ossuary gate in a clean Linux box: install from the lockfile, then run every check the repo has.
#
#   docker build -t ossuary-gate .
#   docker run --rm --ipc=host ossuary-gate
#
# The Playwright image brings Node and the Chromium build that @playwright/test expects
# (keep its tag equal to the installed Playwright version; scripts/dockerfile.test.ts checks it).
# bun is copied in from its own image.
FROM oven/bun:1.4.2 AS bun

FROM mcr.microsoft.com/playwright:v1.65.1-noble
COPY --from=bun /usr/local/bin/bun /usr/local/bin/bun
RUN ln -s /usr/local/bin/bun /usr/local/bin/bunx

WORKDIR /app
ENV CI=1
COPY . .
RUN bunx pnpm@10.34.9 install --frozen-lockfile

# One run, in the same order as the local gate. Stops at the first red step.
CMD ["sh", "-c", "bun run test && bun run typecheck && bun run hook:boundary && bun run hook:spec && bun run e2e"]
