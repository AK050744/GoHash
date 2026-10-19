import { Link } from "react-router-dom";
import {
  ArrowRight,
  Blocks,
  Clock,
  FileText,
  Fingerprint,
  Hash,
  Lock,
  Search,
  ShieldCheck,
  Upload,
  UserCheck,
} from "lucide-react";

import { Decor } from "@/components/decor";
import { PageContainer } from "@/components/layout/page-container";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CopyButton } from "@/components/ui/copy-button";
import { SectionHeader } from "@/components/ui/section-header";
import { StatusBadge, type NotaryStatus } from "@/components/ui/status-badge";

const EXAMPLE_FINGERPRINT =
  "3f9a7c2e5b1d84a06f2c9e7b41d58a3e90c6f1b27d4e8a5c03f9b6e2d17a4c85";

const howItWorks = [
  {
    icon: Upload,
    title: "Upload",
    description: "Add the document you want to notarize.",
  },
  {
    icon: Hash,
    title: "SHA-256 hash",
    description:
      "The file is reduced to a fingerprint that changes if any byte changes.",
  },
  {
    icon: UserCheck,
    title: "Notary approval",
    description: "A notary reviews the request and approves or rejects it.",
  },
  {
    icon: Blocks,
    title: "Blockchain record",
    description: "The approved fingerprint is written on-chain with a timestamp.",
  },
  {
    icon: Search,
    title: "Public verification",
    description: "Anyone can check a document against its on-chain record.",
  },
];

const statusLegend: { status: NotaryStatus; description: string }[] = [
  {
    status: "PENDING",
    description: "Waiting for a notary to review the request.",
  },
  {
    status: "APPROVED",
    description: "A notary has approved the document.",
  },
  {
    status: "REJECTED",
    description: "A notary has declined the request.",
  },
  {
    status: "NOTARIZED",
    description: "The record is on-chain and can be verified.",
  },
];

const trustPoints = [
  {
    icon: Fingerprint,
    title: "Tamper-evident",
    description:
      "Changing a file changes its fingerprint, so edits to a notarized document are easy to detect.",
  },
  {
    icon: ShieldCheck,
    title: "Independently verifiable",
    description:
      "Anyone can check a document against its on-chain record without needing an account.",
  },
  {
    icon: Lock,
    title: "Your keys stay with you",
    description:
      "Your wallet signs each action. GoHash never asks for, displays or stores a private key or seed phrase.",
  },
];

function ExampleRecord() {
  return (
    <div className="relative">
      <Card className="p-6 md:p-7">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-bold tracking-[0.14em] text-slate uppercase">
            Example record
          </p>
          <StatusBadge status="NOTARIZED" />
        </div>

        <div className="mt-6 flex items-center gap-4">
          <span
            aria-hidden="true"
            className="brut-border flex size-14 shrink-0 items-center justify-center rounded-input bg-yellow"
          >
            <FileText className="size-7" />
          </span>
          <div className="min-w-0">
            <p className="font-extrabold break-words">Service agreement.pdf</p>
            <p className="text-sm font-medium text-slate">2 pages</p>
          </div>
        </div>

        <div className="mt-6">
          <p className="text-xs font-bold tracking-[0.14em] text-slate uppercase">
            Fingerprint
          </p>
          <p className="brut-border mt-2 rounded-input bg-cream p-3 font-mono text-sm break-all">
            {EXAMPLE_FINGERPRINT}
          </p>
          <div className="mt-3 flex justify-end">
            <CopyButton value={EXAMPLE_FINGERPRINT} label="fingerprint" />
          </div>
        </div>

        <p className="mt-6 flex items-center gap-2 border-t-[2.5px] border-navy pt-5 pr-24 text-sm font-bold md:pr-28">
          <Clock className="size-4 shrink-0" aria-hidden="true" />
          Recorded on-chain at 14:32 UTC
        </p>
      </Card>

      <div
        aria-hidden="true"
        className="brut-border shadow-hard-sm animate-stamp pointer-events-none absolute -right-3 -bottom-8 flex size-24 flex-col items-center justify-center rounded-full bg-green text-navy md:-right-6 md:size-28"
      >
        <span className="absolute inset-2 rounded-full border-2 border-dashed border-navy" />
        <ShieldCheck className="size-7" />
        <span className="mt-0.5 text-[0.65rem] font-extrabold tracking-[0.12em]">
          NOTARIZED
        </span>
      </div>
    </div>
  );
}

export default function Index() {
  return (
    <>
      <section className="relative">
        <Decor shape="shield" className="top-28 left-3" />
        <Decor shape="document" className="top-24 right-3" delay={1.2} />

        <PageContainer className="grid items-center gap-16 pt-14 pb-20 lg:grid-cols-[1.1fr_0.9fr] lg:gap-10 lg:pt-20">
          <div className="flex flex-col items-start gap-6">
            <span className="brut-border shadow-hard-sm inline-flex rounded-full bg-white px-3 py-1 text-xs font-bold tracking-[0.14em] uppercase">
              Blockchain digital notary
            </span>
            <h1 className="text-4xl leading-[1.08] font-extrabold tracking-tight text-balance sm:text-5xl lg:text-6xl">
              Notarize documents with a{" "}
              <span className="brut-border bg-yellow px-2 whitespace-nowrap">
                tamper-evident
              </span>{" "}
              on-chain record.
            </h1>
            <p className="max-w-xl text-lg leading-relaxed font-medium text-slate">
              Upload a file, have a notary review it, and receive a record that
              anyone can independently verify.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Button asChild size="lg">
                <Link to="/register">
                  Create an account
                  <ArrowRight aria-hidden="true" />
                </Link>
              </Button>
              <Button asChild variant="teal" size="lg">
                <Link to="/verify">
                  <ShieldCheck aria-hidden="true" />
                  Verify a document
                </Link>
              </Button>
            </div>
          </div>

          <ExampleRecord />
        </PageContainer>
      </section>

      <section className="relative py-20">
        <PageContainer className="flex flex-col gap-12">
          <SectionHeader
            tag="Process"
            title="From upload to on-chain record"
            description="Each step is recorded, so the history of a request is easy to follow."
          />

          <ol className="grid gap-5 md:grid-cols-2 lg:grid-cols-5">
            {howItWorks.map((step, index) => (
              <li key={step.title}>
                <Card className="flex h-full flex-col gap-4 p-5">
                  <div className="flex items-center justify-between">
                    <span className="brut-border flex size-12 items-center justify-center rounded-input bg-teal">
                      <step.icon className="size-6" aria-hidden="true" />
                    </span>
                    <span
                      aria-hidden="true"
                      className="brut-border shadow-hard-sm rounded-full bg-yellow px-2.5 py-0.5 text-sm font-extrabold"
                    >
                      {String(index + 1).padStart(2, "0")}
                    </span>
                  </div>
                  <div className="flex flex-col gap-2">
                    <h3 className="text-lg font-extrabold">{step.title}</h3>
                    <p className="text-sm font-medium text-slate">
                      {step.description}
                    </p>
                  </div>
                </Card>
              </li>
            ))}
          </ol>

          <div className="flex flex-col gap-5">
            <h3 className="text-lg font-extrabold">Request statuses</h3>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {statusLegend.map((item) => (
                <Card key={item.status} className="flex flex-col gap-4 p-5">
                  <StatusBadge status={item.status} className="self-start" />
                  <p className="text-sm font-medium text-slate">
                    {item.description}
                  </p>
                </Card>
              ))}
            </div>
          </div>
        </PageContainer>
      </section>

      <section className="relative py-20">
        <Decor shape="padlock" className="top-16 left-3" delay={0.6} />
        <Decor shape="hash" className="top-44 right-3" delay={2} />

        <PageContainer className="flex flex-col gap-12">
          <SectionHeader
            tag="Trust"
            title="Built so anyone can check a record"
            description="A notarization is only useful if the people relying on it can confirm it themselves."
          />

          <div className="grid gap-6 md:grid-cols-3">
            {trustPoints.map((point) => (
              <Card key={point.title} className="flex flex-col gap-5 p-6">
                <span
                  aria-hidden="true"
                  className="brut-border flex size-12 items-center justify-center rounded-input bg-teal"
                >
                  <point.icon className="size-6" />
                </span>
                <div className="flex flex-col gap-2">
                  <h3 className="text-xl font-extrabold">{point.title}</h3>
                  <p className="font-medium text-slate">{point.description}</p>
                </div>
              </Card>
            ))}
          </div>
        </PageContainer>
      </section>

      <section className="relative pb-12">
        <PageContainer>
          <div className="brut-border shadow-hard flex flex-col items-start gap-8 rounded-card bg-yellow p-8 md:flex-row md:items-center md:justify-between md:p-12">
            <div className="max-w-xl">
              <h2 className="text-3xl leading-tight font-extrabold md:text-4xl">
                Ready to notarize your first document?
              </h2>
              <p className="mt-3 font-medium">
                Create an account, upload a file and follow it from pending to
                on-chain.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link to="/register">Create an account</Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link to="/verify">Verify a document</Link>
              </Button>
            </div>
          </div>
        </PageContainer>
      </section>
    </>
  );
}
