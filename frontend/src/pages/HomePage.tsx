import { Link } from 'react-router-dom'
import styles from './HomePage.module.css'

export default function HomePage() {
  return (
    <div className={styles.page}>
      {/* Hero */}
      <section className={styles.hero}>
        <div className={`container ${styles.heroContent}`}>
          <span className={styles.badge}>Powered by Blockchain</span>
          <h1 className={styles.headline}>
            Tamper-Proof <br />
            <span className={styles.gradient}>Document Notary</span>
          </h1>
          <p className={styles.subheading}>
            Hash, timestamp, and certify any document on the blockchain. Get
            immutable proof-of-existence in seconds — no intermediaries needed.
          </p>
          <div className={styles.cta}>
            <Link to="/notarize" className="btn btn-primary">Notarize a Document</Link>
            <Link to="/verify"   className="btn btn-secondary">Verify a Document</Link>
          </div>
        </div>

        <div className={styles.heroGlow} />
      </section>

      {/* Feature Cards */}
      <section className={`container ${styles.features}`}>
        {FEATURES.map((f) => (
          <div key={f.title} className={`glass-card ${styles.featureCard}`}>
            <span className={styles.featureIcon}>{f.icon}</span>
            <h3>{f.title}</h3>
            <p>{f.description}</p>
          </div>
        ))}
      </section>
    </div>
  )
}

const FEATURES = [
  {
    icon: '🔒',
    title: 'SHA-256 Hashing',
    description: 'Documents are hashed client-side — your files never leave your device.',
  },
  {
    icon: '⛓️',
    title: 'On-Chain Proof',
    description: 'The hash is stored immutably on Ethereum with a block timestamp.',
  },
  {
    icon: '✅',
    title: 'Instant Verification',
    description: 'Anyone can verify any document hash against the blockchain record.',
  },
  {
    icon: '🔑',
    title: 'Wallet Ownership',
    description: 'Your MetaMask wallet proves you notarized the document.',
  },
]
