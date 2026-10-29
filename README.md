# MediVault: Blockchain-based secure EHR sharing

MediVault stores encrypted medical-document content in IPFS, stores the CID and encrypted-content hash in a smart contract, and lets a patient grant or revoke clinician access. PostgreSQL holds application accounts and non-sensitive workflow metadata.

## Current implementation

- React patient and doctor portals with registration and login.
- Express/PostgreSQL authentication using bcrypt and signed JWTs.
- Protected APIs for record metadata and the patient-to-doctor access-request lifecycle.
- `contracts/EHRAccess.sol`: patient-owned record registration and on-chain grant/revoke events.
- Local Hardhat compile and authorization tests: `npm run contract:compile` and `npm run contract:test`.

The encrypted-IPFS, MetaMask, and local-contract paths are implemented. They become operational after you provide a private Pinata JWT, start a local Hardhat network, deploy the contract, and configure its address. The present server-side encryption-key wrapping is suitable for a controlled demo; production should use per-user public-key encryption and a formal key-management design.

## Local setup

1. Create a PostgreSQL database and copy `server/.env.example` to `server/.env`.
2. Set a long, unique `JWT_SECRET`; do not use the example value in production.
3. Add `PINATA_JWT` and a 64-character hexadecimal `FILE_ENCRYPTION_MASTER_KEY` to `server/.env`.
4. For a hosted PostgreSQL database, set `DATABASE_URL` to its connection string; otherwise configure the local `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, and `DB_PASSWORD` values.
5. Run `npm run dev` from the project root and `npm start` from `server/`.

The server creates `users`, `health_records`, and `record_access_requests` on startup.

## Local blockchain and MetaMask

1. Start a local chain with `npx hardhat node`.
2. In a second terminal run `npm run contract:deploy:local`; copy its address into a root `.env` file as `VITE_EHR_CONTRACT_ADDRESS=...`.
3. Add the Hardhat local network to MetaMask and import one of the local test accounts printed by `hardhat node`.
4. Connect MetaMask in the patient portal. A successful upload then submits the encrypted CID/hash to the contract and saves its transaction hash with the record.

## API workflow

All record routes require `Authorization: Bearer <JWT>`.

- Patient: `POST /api/records` with `{ fileName, fileType, ipfsCid, recordHash, blockchainTxHash }`.
- Doctor: `POST /api/records/access-requests` with `{ recordId }`.
- Patient: `GET /api/records/requests`, then `PATCH /api/records/requests/:requestId` with `{ decision: "approve" | "decline" }`.
- Patient: `PATCH /api/records/requests/:requestId/revoke`.
- Doctor: `GET /api/records/shared-with-me`.

## Security boundary

Only encrypted file bytes may be placed on IPFS. Do not put medical data, plaintext file names that reveal diagnoses, encryption keys, or patient identifiers in a public blockchain transaction. CID visibility is not access control; encryption plus patient-managed key delivery is mandatory.
