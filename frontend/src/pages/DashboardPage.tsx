import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../store/AuthContext'
import { documentService } from '../services/document.service'
import { NotarizedDocument } from '../types'
import styles from './DashboardPage.module.css'

export default function DashboardPage() {
  const { user } = useAuth()
  const [docs,    setDocs]    = useState<NotarizedDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  useEffect(() => {
    documentService
      .getMyDocuments()
      .then(setDocs)
      .catch(() => setError('Failed to load documents'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="container">
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Dashboard</h1>
          <p className={styles.subtitle}>Welcome back, <strong>{user?.name}</strong></p>
        </div>
        <Link to="/notarize" className="btn btn-primary">+ Notarize Document</Link>
      </div>

      {loading && <p className={styles.state}>Loading your documents…</p>}
      {error   && <p className={styles.errorState}>{error}</p>}

      {!loading && !error && docs.length === 0 && (
        <div className={`glass-card ${styles.empty}`}>
          <span className={styles.emptyIcon}>📄</span>
          <p>You haven't notarized any documents yet.</p>
          <Link to="/notarize" className="btn btn-primary" style={{ marginTop: '1rem' }}>
            Notarize your first document
          </Link>
        </div>
      )}

      {docs.length > 0 && (
        <div className={styles.grid}>
          {docs.map((doc) => (
            <div key={doc._id} className={`glass-card ${styles.docCard}`}>
              <div className={styles.docTop}>
                <span className={styles.docName}>{doc.fileName}</span>
                <span className={`badge badge-${doc.status === 'notarized' ? 'success' : doc.status === 'pending' ? 'pending' : 'failed'}`}>
                  {doc.status}
                </span>
              </div>
              <p className={styles.docHash}>
                <code>{doc.documentHash.slice(0, 20)}…</code>
              </p>
              {doc.notarizedAt && (
                <p className={styles.docDate}>
                  {new Date(doc.notarizedAt).toLocaleDateString()}
                </p>
              )}
              {doc.txHash && (
                <p className={styles.txHash}>
                  Tx: <code>{doc.txHash.slice(0, 16)}…</code>
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
