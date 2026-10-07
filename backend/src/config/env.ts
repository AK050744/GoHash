import dotenv from 'dotenv'
import { z } from 'zod'

dotenv.config()

// Support MONGO_URI fallback if MONGODB_URI is not set
const rawMongoUri = process.env.MONGODB_URI || process.env.MONGO_URI

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(5000),
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required').default(rawMongoUri || 'mongodb://localhost:27017/gohash'),
  JWT_SECRET: z.string().min(8, 'JWT_SECRET must be at least 8 characters').default(process.env.JWT_SECRET || 'gohash_super_secret_jwt_key_default_dev'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  MAX_FILE_SIZE_MB: z.coerce.number().positive().default(10),

  // Seed credentials (for idempotent script seeding)
  SEED_ADMIN_NAME: z.string().default('GoHash Administrator'),
  SEED_ADMIN_EMAIL: z.string().email().default('admin@gohash.io'),
  SEED_ADMIN_PASSWORD: z.string().min(8).default('AdminPassword123!'),
  SEED_NOTARY_NAME: z.string().default('GoHash Official Notary'),
  SEED_NOTARY_EMAIL: z.string().email().default('notary@gohash.io'),
  SEED_NOTARY_PASSWORD: z.string().min(8).default('NotaryPassword123!'),

  // Blockchain integration preserved from Days 1-3
  CHAIN_RPC_URL: z.string().default('http://127.0.0.1:8545'),
  NOTARY_CONTRACT_ADDRESS: z.string().default(''),
  DEPLOYER_PRIVATE_KEY: z.string().default(''),
})

const parseResult = envSchema.safeParse({
  ...process.env,
  MONGODB_URI: rawMongoUri,
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
