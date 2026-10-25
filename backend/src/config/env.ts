import dotenv from 'dotenv'
import { z } from 'zod'

dotenv.config()

// Support MONGO_URI fallback if MONGODB_URI is not set
const rawMongoUri = process.env.MONGODB_URI || process.env.MONGO_URI

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(5000),
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required').default(rawMongoUri || 'mongodb://localhost:27017/gohash'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters').default(process.env.JWT_SECRET || 'gohash_super_secret_jwt_key_default_dev'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  CORS_ORIGIN: z.string().default('http://localhost:5173,http://localhost:8080'),
  MAX_FILE_SIZE_MB: z.coerce.number().positive().default(10),

  // Rate limiting for auth endpoints (POST /auth/login and /auth/register)
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),
  AUTH_RATE_LIMIT_WINDOW_MIN: z.coerce.number().int().positive().default(15),

  // Seed credentials (for idempotent script seeding)
  SEED_ADMIN_NAME: z.string().default('GoHash Administrator'),
  SEED_ADMIN_EMAIL: z.string().email().default('admin@gohash.io'),
  SEED_ADMIN_PASSWORD: z.string().min(8).default('AdminPassword123!'),
  SEED_NOTARY_NAME: z.string().default('GoHash Official Notary'),
  SEED_NOTARY_EMAIL: z.string().email().default('notary@gohash.io'),
  SEED_NOTARY_PASSWORD: z.string().min(8).default('NotaryPassword123!'),

  // Blockchain — read-only RPC provider (no private key or mnemonic)
  RPC_URL: z.string().default('http://127.0.0.1:8545'),
  CHAIN_ID: z.coerce.number().int().positive().default(31337),
  // Path to blockchain/deployments/localhost.json written by the deploy script
  DEPLOYMENT_FILE: z.string().default('../blockchain/deployments/localhost.json'),

  // Rate limiting for public verify endpoint (requests per minute per IP)
  VERIFY_RATE_LIMIT_PER_MIN: z.coerce.number().int().positive().default(30),

  // Google Authentication (ID-token flow, optional)
  GOOGLE_CLIENT_ID: z.string().optional().default(''),
})

const rawGoogleClientId = process.env.GOOGLE_CLIENT_ID?.trim()
if (rawGoogleClientId && !rawGoogleClientId.endsWith('.apps.googleusercontent.com')) {
  console.error('❌ [ENV] GOOGLE_CLIENT_ID must end in ".apps.googleusercontent.com"')
  throw new Error('GOOGLE_CLIENT_ID must end in ".apps.googleusercontent.com"')
}

const parseResult = envSchema.safeParse({
  ...process.env,
  MONGODB_URI: rawMongoUri,
  GOOGLE_CLIENT_ID: rawGoogleClientId || '',
})

if (!parseResult.success) {
  const formattedErrors = parseResult.error.issues
    .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
    .join('\n')
  console.error(`❌ [ENV] Environment configuration validation failed:\n${formattedErrors}`)
  throw new Error(`Environment validation failed:\n${formattedErrors}`)
}

export const env = parseResult.data
export type Env = z.infer<typeof envSchema>
