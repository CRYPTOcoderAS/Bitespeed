# Bitespeed Backend Task: Identity Reconciliation

## Setup Instructions

1. **Install dependencies:**
   ```sh
   npm install
   ```
2. **Prisma setup:**
   ```sh
   npx prisma generate
   npx prisma migrate dev --name init
   ```
3. **Run the server:**
   ```sh
   npm run dev
   ```

## Endpoint

- **POST /identify**
  - Body: `{ "email"?: string, "phoneNumber"?: string }`
  - Returns: Consolidated contact as per the task requirements.

## Notes
- Uses SQLite for local development (see `prisma/schema.prisma`).
- See `/src/api/identify.ts` for main logic.
