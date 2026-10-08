# GoHash Project Progress

## Done

### 1. Blockchain Foundation (Days 1–3)
- Deployed and tested `DocumentNotary.sol` smart contract on Hardhat local network.
- Implemented document registration, verification, status tracking, and event emission.
- Comprehensive unit tests passing on Windows environment.

### 2. Backend Foundation (Day 4)
- Express + TypeScript architecture with Zod environment validation and Mongoose models (`User`, `Document`, `Notarization`).
- JWT authentication (`/api/auth/register`, `/api/auth/login`, `/api/auth/me`).
- Role-based authorization (`USER`, `NOTARY`, `ADMIN`).
- Docker Compose configuration for MongoDB (`gohash-mongo`).
- Global error handling, Helmet, CORS, and request logging with Morgan.

### 3. Frontend Foundation & Auth Integration (Task 2A / 2B)
- Vite + React 18 + TypeScript + Tailwind CSS (v3.4.19) foundation.
- Central typed API wrapper (`frontend/src/lib/api.ts`) supporting envelope parsing, automatic JWT bearer attachment, and 401 token wipe with redirect to `/login`.
- Authentication Context (`AuthContext`) with session rehydration (`/api/auth/me`), login/register handling, and token management in localStorage.
- Protected route guards (`ProtectedRoute` and `RoleRoute`) with HTTP 403 access control (`/403`).
- Role-based redirection and access control:
  - `USER`: `/dashboard`
  - `NOTARY`: `/notary/dashboard` (restricted strictly to `NOTARY` role)
  - `ADMIN`: `/admin/dashboard` (restricted strictly to `ADMIN` role)
- Public routes: Landing page (`/`), Login (`/login`), Register (`/register`), Verify placeholder (`/verify`), 403 Unauthorized (`/403`), 404 Not Found (`*`).
- Core UI kit: `Button`, `Card`, `StatCard`, `StatusBadge`, `EmptyState`, `Spinner`, `Alert`.
- Production build (`npm run build`) and ESLint (`npm run lint`) clean with zero errors and zero warnings.

### 4. Document Management & Notarization Request (Task 3A - Day 6)
- **Multer Memory Storage Upload**: Configured memory-based multipart upload with size limits derived from `MAX_FILE_SIZE_MB`.
- **Validation**: Enforced strict MIME checking (`application/pdf`) and binary magic byte validation (starts with `"%PDF-"`), rejecting text files or non-PDFs with `400 INVALID_FILE`.
- **SHA-256 Hashing**: Computed cryptographic hash with Node crypto buffer hashing (`services/hash.service.ts`).
- **Disk Storage Security**: Saved files to `backend/uploads/<documentId>.pdf` without exposing user-supplied filenames in file paths; user filename preserved in `originalName`.
- **Duplicate Document Guard**: Rejected identical uploads by the same owner with `409 DUPLICATE_DOCUMENT`.
- **Document Stats**: Implemented `GET /api/documents/stats` registered before `/:id` returning `{ total, pending, notarized }`.
- **Ownership Isolation**: `GET /api/documents/:id` and `GET /api/documents/:id/file` restrict access to owner, NOTARY, or ADMIN, returning `404 NOT_FOUND` to unauthorized callers to avoid leaking document existence.
- **Inline Streaming**: `GET /api/documents/:id/file` streams PDF inline with proper `Content-Disposition`.
- **Notarization Request**: `POST /api/notarization/request` allows document owners to submit `PENDING` documents for attestation, creating `Notarization` records with status `REQUESTED` and rejecting duplicates with `409 DUPLICATE_REQUEST`.
- **Smoke Tests**: Extended `backend/scripts/smoke-test.ts` to 27 automated tests passing with 0 failures, covering upload, hash verification, MIME validation, cross-user isolation, file streaming, and notarization requests.
- **Contract & Docs**: Synchronized [docs/API_CONTRACT.md](file:///c:/Users/anshv/OneDrive/Desktop/GoHash/docs/API_CONTRACT.md) with updated request/response definitions.

---

## How to Run

### Prerequisites
- Node.js (v18+ or v20+)
- Docker Desktop (for MongoDB)

### 1. Start MongoDB
```powershell
docker compose up -d
```

### 2. Run Backend
```powershell
cd backend
npm install
npm run dev
```
Backend runs at `http://localhost:5000` (API endpoint: `http://localhost:5000/api`).

### 3. Run Frontend
```powershell
cd frontend
npm install
npm run dev
```
Frontend runs at `http://localhost:5173`.

### 4. Build & Lint Verification
```powershell
cd frontend
npm run lint
npm run build
```

---

## Environment Variables

### Frontend (`frontend/.env`)
| Variable | Description | Default |
| :--- | :--- | :--- |
| `VITE_API_URL` | Base URL for backend Express API | `http://localhost:5000/api` |

*(Sample template provided in `frontend/.env.example`)*

### Backend (`backend/.env`)
| Variable | Description | Default |
| :--- | :--- | :--- |
| `PORT` | API Server port | `5000` |
| `NODE_ENV` | Environment mode (`development` / `production`) | `development` |
| `MONGODB_URI` | MongoDB connection string | `mongodb://localhost:27017/gohash` |
| `JWT_SECRET` | Secret key for signing JWT tokens | *(configured)* |
| `JWT_EXPIRES_IN` | Token expiration time | `7d` |
| `CORS_ORIGIN` | Allowed client origin | `http://localhost:5173` |

---

## Known Issues & Notes

- **Headless Browser Driver in Sandbox**: Playwright driver binary auto-download failed from Azure CDN within the restricted sandbox; manual browser testing at `http://localhost:5173` should be used instead of automated headless browser subagent runs.
- **LocalStorage JWT Tradeoff**: Storing JWT in `localStorage` makes it vulnerable to hypothetical XSS attacks (mitigated by strict avoidance of `dangerouslySetInnerHTML`). For production deployment, httpOnly cookies with CSRF protection are recommended.

---

## Next Steps

1. **Document Upload & Client-Side Hashing (Task 3)**:
   - Implement file dropzone and client-side SHA-256 calculation using Web Crypto API.
   - Wire document upload to `POST /api/documents/upload`.
2. **Notarization Requests**:
   - Enable users to submit uploaded documents for notary review (`POST /api/notarization/request`).
   - Implement notary review queue (`/notary/dashboard`) and approval/rejection workflows.
3. **Smart Contract Integration**:
   - Connect ethers.js provider/signer for notary blockchain transaction signing upon approval.
