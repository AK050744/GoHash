import dotenv from 'dotenv'

dotenv.config()

function required(key: string): string {
  const value = process.env[key]
  if (!value) throw new Error(`Missing required environment variable: ${key}`)
  return value
}

export const env = {
  NODE_ENV:                process.env.NODE_ENV || 'development',
  PORT:                    parseInt(process.env.PORT || '5000', 10),
  MONGO_URI:               required('MONGO_URI'),
  JWT_SECRET:              required('JWT_SECRET'),
  JWT_EXPIRES_IN:          process.env.JWT_EXPIRES_IN || '7d',
  CHAIN_RPC_URL:           process.env.CHAIN_RPC_URL || 'http://127.0.0.1:8545',
  NOTARY_CONTRACT_ADDRESS: process.env.NOTARY_CONTRACT_ADDRESS || '',
  DEPLOYER_PRIVATE_KEY:    process.env.DEPLOYER_PRIVATE_KEY || '',
  CORS_ORIGIN:             process.env.CORS_ORIGIN || 'http://localhost:5173',
}
