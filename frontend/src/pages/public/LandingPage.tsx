import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Shield,
  FileCheck2,
  Lock,
  Search,
  CheckCircle2,
  AlertCircle,
  FileText,
  Clock,
  ArrowRight,
  Sparkles,
  Layers,
  Database,
  ExternalLink,
} from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Navbar } from '../../components/layout/Navbar'

export const LandingPage: React.FC = () => {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-background text-dark-100 flex flex-col selection:bg-primary selection:text-white">
      <Navbar />

      {/* Hero Section */}
      <section className="relative pt-20 pb-28 overflow-hidden bg-grid-pattern">
        {/* Glow ambient background elements */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-primary/20 blur-[130px] rounded-full pointer-events-none" />
        <div className="absolute top-1/3 left-1/3 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[250px] bg-accent/15 blur-[120px] rounded-full pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-surface-secondary border border-border text-xs font-medium text-dark-300 mb-8 shadow-sm">
            <Sparkles className="w-3.5 h-3.5 text-accent" />
            <span>Cryptographic Proof of Existence &middot; Tamper-Evident Records</span>
          </div>

          {/* Heading */}
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-white font-display max-w-4xl mx-auto leading-[1.1]">
            Next-Generation <span className="bg-gradient-to-r from-primary via-primary-light to-accent bg-clip-text text-transparent">Digital Notary</span> System
          </h1>

          {/* Subtitle */}
          <p className="mt-6 text-lg sm:text-xl text-dark-300 max-w-2xl mx-auto leading-relaxed">
            Generate client-side SHA-256 document fingerprints, receive authorized notary certification, and verify records independently through Ethereum smart contracts.
          </p>

          {/* CTAs */}
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button
              size="lg"
              variant="primary"
              onClick={() => navigate('/register')}
              rightIcon={<ArrowRight className="w-4 h-4" />}
              className="w-full sm:w-auto"
            >
              Get Started Free
            </Button>
            <Button
              size="lg"
              variant="secondary"
              onClick={() => navigate('/verify')}
              leftIcon={<Search className="w-4 h-4 text-accent" />}
              className="w-full sm:w-auto"
            >
              Verify Any Document
            </Button>
          </div>

          {/* Key Assurance Notice */}
          <div className="mt-12 flex items-center justify-center gap-6 text-xs text-dark-400">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-accent" /> Zero Document Content Stored On-Chain
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-accent" /> Independently Verifiable
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-accent" /> Tamper-Evident Proof
            </span>
          </div>
        </div>
      </section>

      {/* The Problem Section */}
      <section className="py-20 border-t border-border/60 bg-surface/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-xs uppercase font-semibold text-primary tracking-widest">The Vulnerability</h2>
            <p className="text-3xl font-bold text-white mt-2 font-display">Why Traditional Digital Records Fall Short</p>
            <p className="text-dark-400 mt-3 text-sm">
              Standard digital documents stored in centralized databases lack cryptographic permanence and are vulnerable to post-hoc tampering.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="border-rose-500/20 bg-surface/70">
              <div className="w-12 h-12 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center mb-4">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Altered Timestamps</h3>
              <p className="text-sm text-dark-400 leading-relaxed">
                Database timestamps and file server metadata can easily be rewritten by administrators, rendering traditional audit trails disputable in legal challenges.
              </p>
            </Card>

            <Card className="border-rose-500/20 bg-surface/70">
              <div className="w-12 h-12 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center mb-4">
                <FileText className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Undetectable Modifications</h3>
              <p className="text-sm text-dark-400 leading-relaxed">
                A single changed digit or inserted clause in a PDF is imperceptible to human reviewers without strict cryptographic digest comparisons.
              </p>
            </Card>

            <Card className="border-rose-500/20 bg-surface/70">
              <div className="w-12 h-12 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center mb-4">
                <Lock className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Centralized Vendor Lock-in</h3>
              <p className="text-sm text-dark-400 leading-relaxed">
                If the document management platform goes bankrupt or offline, third parties cannot independently verify the authenticity or timestamp of certificates.
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-24 border-t border-border/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-xs uppercase font-semibold text-accent tracking-widest">Architectural Flow</h2>
            <p className="text-3xl font-bold text-white mt-2 font-display">How GoHash Proves Existence</p>
            <p className="text-dark-400 mt-3 text-sm">
              Four streamlined steps from local file hashing to decentralized blockchain attestation.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 relative">
            <Card hoverEffect className="relative bg-surface border-border">
              <div className="text-4xl font-extrabold text-primary/30 font-display mb-3">01</div>
              <h4 className="text-base font-semibold text-white mb-1.5">Client-Side Hashing</h4>
              <p className="text-xs text-dark-400 leading-relaxed">
                Your file is computed locally into an irreversible 64-character SHA-256 fingerprint. The actual document content never touches the public network.
              </p>
            </Card>

            <Card hoverEffect className="relative bg-surface border-border">
              <div className="text-4xl font-extrabold text-primary/30 font-display mb-3">02</div>
              <h4 className="text-base font-semibold text-white mb-1.5">Notary Attestation</h4>
              <p className="text-xs text-dark-400 leading-relaxed">
                An authorized notary verifies the petitioner's identity and issues an official digital certification over the cryptographic hash.
              </p>
            </Card>

            <Card hoverEffect className="relative bg-surface border-border">
              <div className="text-4xl font-extrabold text-primary/30 font-display mb-3">03</div>
              <h4 className="text-base font-semibold text-white mb-1.5">On-Chain Commitment</h4>
              <p className="text-xs text-dark-400 leading-relaxed">
                The smart contract records the document hash, notary wallet address, and block timestamp into the decentralized ledger.
              </p>
            </Card>

            <Card hoverEffect className="relative bg-surface border-border">
              <div className="text-4xl font-extrabold text-accent/40 font-display mb-3">04</div>
              <h4 className="text-base font-semibold text-white mb-1.5">Independent Verification</h4>
              <p className="text-xs text-dark-400 leading-relaxed">
                Anyone can drag-and-drop the original file to recompute the hash and check the blockchain record with zero third-party reliance.
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* Why Blockchain Section (Strict terminology: tamper-evident, independently verifiable) */}
      <section id="why-blockchain" className="py-20 border-t border-border/60 bg-surface/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-xs uppercase font-semibold text-primary tracking-widest">Decentralized Trust</h2>
              <h3 className="text-3xl font-bold text-white mt-2 font-display leading-tight">
                Tamper-Evident Records That Empower Real-World Notaries
              </h3>
              <p className="text-dark-300 mt-4 text-sm leading-relaxed">
                GoHash does not claim to magically replace licensed human notaries. Instead, our protocol provides notaries and citizens with mathematically sound, tamper-evident instruments.
              </p>

              <div className="mt-8 space-y-4">
                <div className="flex items-start gap-3.5">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary border border-primary/20 shrink-0">
                    <Shield className="w-4 h-4" />
                  </div>
                  <div>
                    <h5 className="text-sm font-semibold text-white">Tamper-Evident Permanence</h5>
                    <p className="text-xs text-dark-400 mt-0.5">
                      Once recorded on-chain, neither users nor system administrators can alter the cryptographic hash or backdate the block timestamp.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3.5">
                  <div className="p-2 rounded-lg bg-accent/10 text-accent border border-accent/20 shrink-0">
                    <Search className="w-4 h-4" />
                  </div>
                  <div>
                    <h5 className="text-sm font-semibold text-white">Independently Verifiable</h5>
                    <p className="text-xs text-dark-400 mt-0.5">
                      Third parties, courts, and counterparties can verify authenticity directly against the smart contract without trusting GoHash servers.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3.5">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary border border-primary/20 shrink-0">
                    <Database className="w-4 h-4" />
                  </div>
                  <div>
                    <h5 className="text-sm font-semibold text-white">Privacy-Preserving Fingerprints</h5>
                    <p className="text-xs text-dark-400 mt-0.5">
                      Confidential contracts, legal agreements, and patents remain private. Only mathematical digests and IPFS descriptors are notarized.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Visual Architecture Representation */}
            <div className="glass-panel p-6 sm:p-8 rounded-3xl relative overflow-hidden border border-border shadow-2xl">
              <div className="flex items-center justify-between pb-4 border-b border-border/80">
                <span className="text-xs font-mono text-dark-400">SMART CONTRACT SPECIFICATION</span>
                <span className="px-2 py-0.5 text-[10px] font-mono rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                  SOLIDITY 0.8.24
                </span>
              </div>

              <div className="mt-5 space-y-3 font-mono text-xs text-dark-300">
                <div className="p-3 rounded-xl bg-dark-900/80 border border-border/50">
                  <p className="text-primary-light font-medium">// On-Chain Document Record</p>
                  <p className="text-dark-400 mt-1">struct Record &#123;</p>
                  <p className="pl-4 text-dark-200">bytes32 documentHash;</p>
                  <p className="pl-4 text-dark-200">address owner;</p>
                  <p className="pl-4 text-accent">address notary; // Authorized Notary</p>
                  <p className="pl-4 text-dark-200">uint256 timestamp;</p>
                  <p className="pl-4 text-dark-200">string ipfsCid;</p>
                  <p className="text-dark-400">&#125;</p>
                </div>

                <div className="p-3 rounded-xl bg-dark-900/80 border border-border/50 flex items-center justify-between">
                  <span className="text-dark-400">Access Control Model:</span>
                  <span className="text-white font-semibold">2-Tier (Admin &rarr; Notary)</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-border bg-surface py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-6 text-xs text-dark-400">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-gradient-to-tr from-primary to-accent flex items-center justify-center text-dark-900 font-bold text-xs">
              G
            </div>
            <span className="text-white font-semibold">GoHash</span> &mdash; Final-Year B.Tech Capstone Project
          </div>

          <div className="flex items-center gap-6">
            <Link to="/verify" className="hover:text-white transition-colors">
              Public Verifier
            </Link>
            <Link to="/login" className="hover:text-white transition-colors">
              Client Portal
            </Link>
            <a
              href="https://github.com"
              target="_blank"
              rel="noreferrer"
              className="hover:text-white flex items-center gap-1 transition-colors"
            >
              <span>GitHub</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default LandingPage
