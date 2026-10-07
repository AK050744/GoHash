import bcrypt from 'bcryptjs'
import { connectDB, disconnectDB } from '../src/config/db'
import { env } from '../src/config/env'
import { User, UserRole } from '../src/models/User'

const BCRYPT_SALT_ROUNDS = 12

interface SeedUserSpec {
  name: string
  email: string
  password: string
  role: UserRole
}

const seedUsers: SeedUserSpec[] = [
  {
    name: env.SEED_ADMIN_NAME,
    email: env.SEED_ADMIN_EMAIL.toLowerCase(),
    password: env.SEED_ADMIN_PASSWORD,
    role: 'ADMIN',
  },
  {
    name: env.SEED_NOTARY_NAME,
    email: env.SEED_NOTARY_EMAIL.toLowerCase(),
    password: env.SEED_NOTARY_PASSWORD,
    role: 'NOTARY',
  },
]

async function seed() {
  console.log('🌱 Starting GoHash database seed...')
  await connectDB()

  for (const spec of seedUsers) {
    const existing = await User.findOne({ email: spec.email }).select('+passwordHash')

    if (existing) {
      console.log(`ℹ️  User ${spec.email} already exists (role: ${existing.role}). Ensuring role & active status...`)
      existing.role = spec.role
      existing.isActive = true
      existing.name = spec.name
      // Update password hash to guarantee match with seed env
      existing.passwordHash = await bcrypt.hash(spec.password, BCRYPT_SALT_ROUNDS)
      await existing.save()
      console.log(`   Updated ${spec.email} as ${spec.role}.`)
    } else {
      const passwordHash = await bcrypt.hash(spec.password, BCRYPT_SALT_ROUNDS)
      await User.create({
        name: spec.name,
        email: spec.email,
        passwordHash,
        role: spec.role,
        isActive: true,
      })
      console.log(`✅ Created seeded ${spec.role} user: ${spec.email}`)
    }
  }

  console.log('🎉 Seeding completed successfully.')
}

seed()
  .catch((err) => {
    console.error('❌ Error during seeding:', err)
    process.exitCode = 1
  })
  .finally(async () => {
    await disconnectDB()
    process.exit(process.exitCode || 0)
  })
