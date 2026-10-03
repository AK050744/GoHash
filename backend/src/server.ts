import app from './app'
import { connectDB } from './config/database'
import { env } from './config/env'

const PORT = env.PORT

async function bootstrap() {
  await connectDB()

  app.listen(PORT, () => {
    console.log(`🚀 GoHash API running on http://localhost:${PORT}`)
    console.log(`   Environment : ${env.NODE_ENV}`)
  })
}

bootstrap().catch((err) => {
  console.error('Fatal error during startup:', err)
  process.exit(1)
})
