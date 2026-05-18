# API routes

All route handlers in this directory **must** be exported through
`withErrorReporting` from `@/lib/with-error-reporting`. The wrapper:

- captures uncaught throws into the error tracker (Sentry) with a scope tag,
- emits a low-severity marker when a handler returns a 5xx response, and
- returns a generic 500 JSON body on throw so the client still sees a
  well-formed response.

## Convention

Write the handler as a local `async function`, then export it through the
wrapper at the bottom of the file:

```ts
import { NextRequest } from "next/server";
import { withErrorReporting } from "@/lib/with-error-reporting";

async function getHandler(req: NextRequest) {
  // ...
}

async function postHandler(req: NextRequest) {
  // ...
}

export const GET = withErrorReporting("api:<bucket>:GET", getHandler);
export const POST = withErrorReporting("api:<bucket>:POST", postHandler);
```

Pick `<bucket>` to match the folder path so on-call can grep Sentry by route
(e.g. `api:tasks:POST`, `api:projects/id:DELETE`, `api:clickup/import:POST`).

## Guardrail

`tests/unit/api-routes-wrapped.test.ts` scans this folder on every
`pnpm --filter @workspace/up-flow test:unit` run and fails if any new
`route.ts` exports a bare `GET` / `POST` / ... without going through
`withErrorReporting`. If you see that test fail, refactor the handler as
shown above — don't disable the check.
