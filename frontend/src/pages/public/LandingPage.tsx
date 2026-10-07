import { Link } from 'react-router-dom'
import { Shield, Lock, Globe, CheckCircle, ArrowRight, FileCheck } from 'lucide-react'
import Button from '../../components/ui/Button'

const steps = [
  { icon: FileCheck, title: 'Upload your document', desc: 'Any PDF, image, or file. We compute its SHA-256 hash.' },
  { icon: Lock,      title: 'Hash on blockchain',   desc: 'The hash is stored on Ethereum — immutable forever.' },
  { icon: Globe,     title: 'Share & verify',        desc: 'Anyone can verify authenticity with the hash ID.' },
]

const features = [
  { icon: Shield,      title: 'Tamper-proof',    desc: 'Blockchain records cannot be altered or deleted.' },
  { icon: Lock,        title: 'Privacy first',   desc: 'Only the hash is stored on-chain, never the file.' },
  { icon: CheckCircle, title: 'Instant verify',  desc: 'Verification is immediate and costs nothing.' },
]

export default function LandingPage() {
  return (
    <div className="text-white">
      {/* Hero */}
      <section className="relative overflow-hidden px-4 pt-24 pb-32 text-center">
        <div className="absolute inset-0 bg-gradient-to-b from-primary-600/10 via-transparent to-transparent pointer-events-none" />
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-primary-500/5 blur-3xl pointer-events-none" />

        <div className="relative max-w-3xl mx-auto space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary-600/15 border border-primary-500/20 rounded-full text-xs font-medium text-primary-300">
            <Shield className="h-3.5 w-3.5" /> Blockchain-Powered Notary
          </div>

          <h1 className="text-5xl sm:text-6xl font-extrabold leading-tight bg-gradient-to-br from-white to-surface-400 bg-clip-text text-transparent">
            Notarize documents.<br />Trust the blockchain.
          </h1>

          <p className="text-lg text-surface-400 max-w-xl mx-auto">
            GoHash turns any digital document into a tamper-proof, blockchain-verified artifact — in seconds. No lawyers, no stamps, no trust issues.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
            <Link to="/register">
              <Button size="lg">
                Get started free <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link to="/verify">
              <Button size="lg" variant="secondary">
                Verify a document
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Problem / How it works */}
      <section className="max-w-5xl mx-auto px-4 pb-24">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold">How it works</h2>
          <p className="text-surface-400 mt-2">Three steps. Permanent proof.</p>
        </div>
        <div className="grid sm:grid-cols-3 gap-6">
          {steps.map(({ icon: Icon, title, desc }, i) => (
            <div key={title} className="relative bg-surface-800 border border-surface-700 rounded-2xl p-6">
              <span className="absolute -top-3 -left-3 w-7 h-7 rounded-full bg-primary-600 text-xs font-bold flex items-center justify-center">
                {i + 1}
              </span>
              <Icon className="h-8 w-8 text-primary-400 mb-3" />
              <h3 className="font-semibold text-white mb-1">{title}</h3>
              <p className="text-sm text-surface-400">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="bg-surface-800/50 border-y border-surface-700 py-20 px-4">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">Why GoHash?</h2>
          <div className="grid sm:grid-cols-3 gap-8">
            {features.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex flex-col items-center text-center gap-3">
                <div className="h-12 w-12 rounded-2xl bg-primary-600/20 flex items-center justify-center">
                  <Icon className="h-6 w-6 text-primary-400" />
                </div>
                <h3 className="font-semibold text-white">{title}</h3>
                <p className="text-sm text-surface-400">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-4 text-center">
        <h2 className="text-4xl font-extrabold mb-4">Ready to notarize?</h2>
        <p className="text-surface-400 mb-8">Join the future of document verification.</p>
        <Link to="/register">
          <Button size="lg">
            Create your account <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </section>
    </div>
  )
}
