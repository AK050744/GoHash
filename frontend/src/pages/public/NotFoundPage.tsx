import React from 'react'
import { useNavigate } from 'react-router-dom'
import { FileQuestion, Home } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'

export const NotFoundPage: React.FC = () => {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 bg-grid-pattern relative">
      <Card className="max-w-md w-full text-center p-8 bg-surface/90 backdrop-blur-xl border-border z-10">
        <div className="w-16 h-16 rounded-2xl bg-surface-secondary border border-border text-primary flex items-center justify-center mx-auto mb-4">
          <FileQuestion className="w-8 h-8" />
        </div>

        <span className="px-2.5 py-1 rounded-full text-xs font-mono font-semibold bg-primary/10 text-primary-light border border-primary/20">
          HTTP 404
        </span>

        <h1 className="text-2xl font-bold text-white tracking-tight mt-4 font-display">
          Page Not Found
        </h1>

        <p className="text-sm text-dark-300 mt-2 leading-relaxed">
          The requested route does not exist or has been moved to a new endpoint.
        </p>

        <div className="mt-8 flex justify-center">
          <Button variant="primary" onClick={() => navigate('/')} leftIcon={<Home className="w-4 h-4" />}>
            Back to Home
          </Button>
        </div>
      </Card>
    </div>
  )
}

export default NotFoundPage
