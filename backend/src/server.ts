import app from './app'
import { connectDB } from './config/db'
import { env } from './config/env'

const PORT = env.PORT

export async function bootstrap() {
  await connectDB()

  const server = app.listen(PORT, () => {
    console.log(`🚀 GoHash API running on http://localhost:${PORT}`)
    console.log(`   Environment : ${env.NODE_ENV}`)
  })

  return server
}

// Start server if this file is run directly
if (process.env.NODE_ENV !== 'test' || require.main === module) {
  bootstrap().catch((err) => {
    console.error('Fatal error during startup:', err)
    process.exit(1)
  })
}
