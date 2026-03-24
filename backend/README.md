# SplitNaira Backend

Express + TypeScript API scaffold for SplitNaira.

## Scripts
- `npm install`
- `npm run dev`
- `npm run build`
- `npm run start`

## Notes
- Dependencies use the `latest` tag so installs always pick current versions.
- Copy `.env.example` to `.env` and fill in Stellar config before wiring endpoints.

## Deployment
- CI/CD workflow: `../.github/workflows/backend-deploy.yml`
- Deployment configuration and required secrets: [`../docs/backend-deploy.md`](../docs/backend-deploy.md)

## Structure
- `src/index.ts` - App entry
- `src/routes` - HTTP routes
- `src/services` - Stellar/Soroban integrations
- `src/middleware` - Error handling
