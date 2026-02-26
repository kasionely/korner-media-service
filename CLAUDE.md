# korner-media-service

File storage service. Handles S3 uploads/downloads, image compression, private content access control.

## Commands

```bash
npm run build     # tsc
npm run dev       # ts-node-dev --respawn --transpile-only src/main.ts
npm run start     # node dist/main.js
npm run lint      # eslint 'src/**/*.ts' --fix
```

## Port

**3003** (default)

## Modules

| Module | Description |
|--------|-------------|
| `s3` | Public file upload/download, image compression, file management |
| `s3-private` | Private/paid content with subscription/purchase access checks |
| `storage` | File storage management, listing, deletion |

## Middleware

- `authMiddleware` / `optionalAuthMiddleware` — JWT Bearer auth
- `subscription.middleware.ts` — Cross-service access control:
  - `authenticateUser` — verifies user via main-service
  - `requireSubscription` — checks subscription via billing-service
  - `checkContentAccess` — verifies content purchase/subscription access

## Key Utilities

- `src/utils/s3.ts` — AWS S3 client and operations
- `src/utils/ys3.ts` — Yandex Cloud S3 client
- `src/utils/imageCompressor.ts` — Image quality/size optimization
- `src/utils/fileTransfer.ts` — File transfer utilities
- `src/utils/mainServiceClient.ts` — HTTP client to korner-main-service
- `src/utils/billingServiceClient.ts` — HTTP client to korner-billing-service

## Environment Variables

```
PORT=3003
ACCESS_TOKEN_SECRET
KORNER_MAIN_URL=http://localhost:3001
KORNER_BILLING_URL=http://localhost:3002
ACTIVE_ENV=dev
AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_BUCKET=korner-lol
YC_ACCESS_KEY_ID, YC_SECRET_ACCESS_KEY
REDIS_URL
IMAGE_QUALITY=80
```

## Dependencies on Other Services

- **korner-main-service** — user verification via `mainServiceClient`
- **korner-billing-service** — subscription/purchase checks via `billingServiceClient`
