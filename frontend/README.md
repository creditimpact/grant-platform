# Frontend

The Next.js app communicates with the backend through a shared Axios client defined in `src/lib/api.ts`. The client automatically prefixes requests with `/api`, so frontend code should call helpers like `getStatus` or `uploadFile` without hard‑coding that prefix.

Case state is persisted with a small [Zustand](https://github.com/pmndrs/zustand) store. The `caseId` is stored in `localStorage` and rehydrated on load so users can refresh without losing their progress.

Run tests with:

```bash
npm test
```
