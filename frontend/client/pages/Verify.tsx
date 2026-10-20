import { useState } from "react";
import { CircleCheck, FileText, Key, ShieldCheck, X } from "lucide-react";

import { PageContainer } from "@/components/layout/page-container";
import { DropZone } from "@/components/documents/drop-zone";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CopyButton } from "@/components/ui/copy-button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  VerifyResult,
  type VerifyOutcome,
} from "@/components/verify/verify-result";
import { api } from "@/lib/api";

type KeyRecord = {
  notaryWallet: string;
  timestamp: number;
  transactionHash: string;
  blockNumber: number;
  contractAddress: string;
};

type KeyLookupOutcome =
  | { kind: "found"; key: string; record: KeyRecord }
  | { kind: "not-found"; key: string; message?: string };

export default function Verify() {
  // File verification state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [outcome, setOutcome] = useState<VerifyOutcome | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Key lookup state
  const [lookupKey, setLookupKey] = useState("");
  const [keyOutcome, setKeyOutcome] = useState<KeyLookupOutcome | null>(null);
  const [keyLoading, setKeyLoading] = useState(false);
  const [keyError, setKeyError] = useState<string | null>(null);

  const handleVerify = async () => {
    if (!selectedFile) return;
    setLoading(true);
    setOutcome(null);
    setError(null);

    try {
      const form = new FormData();
      form.append("file", selectedFile);

      const res = await api.postForm<{
        success: true;
        status: "VERIFIED" | "NOT_VERIFIED";
        hash: string;
        record?: {
          ownerWallet: string;
          notaryWallet: string;
          timestamp: number;
          contractAddress: string;
          transactionHash: string;
          blockNumber: number;
        };
        document?: { id: string; originalName: string };
        message?: string;
      }>("/verify", form);

      if (res.status === "VERIFIED" && res.record) {
        setOutcome({
          kind: "verified",
          record: {
            documentName: res.document?.originalName ?? "Unknown document",
            hash: res.hash,
            notary: res.record.notaryWallet,
            recordedAt: new Date(res.record.timestamp * 1000).toLocaleString(),
            contractAddress: res.record.contractAddress,
            transactionHash: res.record.transactionHash,
            blockNumber: String(res.record.blockNumber),
          },
        });
      } else {
        setOutcome({
          kind: "not-verified",
          computedHash: res.hash,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyLookup = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = lookupKey.trim();
    if (!trimmed) return;

    setKeyLoading(true);
    setKeyOutcome(null);
    setKeyError(null);

    try {
      const res = await api.get<{
        status: "FOUND" | "NOT_FOUND";
        key: string;
        record?: KeyRecord;
        message?: string;
      }>(`/verify/key/${encodeURIComponent(trimmed)}`);

      if (res.status === "FOUND" && res.record) {
        setKeyOutcome({
          kind: "found",
          key: res.key,
          record: res.record,
        });
      } else {
        setKeyOutcome({
          kind: "not-found",
          key: res.key || trimmed,
          message: res.message,
        });
      }
    } catch (err) {
      setKeyError(err instanceof Error ? err.message : "Key lookup failed");
    } finally {
      setKeyLoading(false);
    }
  };

  return (
    <PageContainer className="pt-12">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
        <PageHeader
          icon={<ShieldCheck />}
          title="Verify"
          subtitle="Check whether a file matches a notarized record."
        />

        <Tabs defaultValue="file" className="flex flex-col gap-8">
          <TabsList className="grid h-auto w-full grid-cols-2 rounded-card border-[2.5px] border-navy bg-white p-1 text-navy shadow-hard-sm">
            <TabsTrigger
              value="file"
              className="cursor-pointer rounded-input py-2.5 font-bold transition-all data-[state=active]:bg-navy data-[state=active]:text-white"
            >
              Verify by file
            </TabsTrigger>
            <TabsTrigger
              value="key"
              className="cursor-pointer rounded-input py-2.5 font-bold transition-all data-[state=active]:bg-navy data-[state=active]:text-white"
            >
              Look up by key
            </TabsTrigger>
          </TabsList>

          <TabsContent value="file" className="mt-0 flex flex-col gap-8">
            <Card className="flex flex-col gap-6 p-6 md:p-8">
              <DropZone
                inputId="verify-file"
                title="Drop a document to verify"
                description="Select the file you want to check against its notarized record."
                onFileSelect={(file) => {
                  setSelectedFile(file ?? null);
                  setOutcome(null);
                  setError(null);
                }}
              />

              {selectedFile && (
                <div className="brut-border shadow-hard-sm flex flex-wrap items-center gap-3 self-start rounded-full bg-white py-1.5 pr-1.5 pl-4">
                  <FileText className="size-5 shrink-0" aria-hidden="true" />
                  <span className="font-bold break-all">{selectedFile.name}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Remove selected file"
                    onClick={() => {
                      setSelectedFile(null);
                      setOutcome(null);
                      setError(null);
                    }}
                  >
                    <X />
                  </Button>
                </div>
              )}

              {error && (
                <Alert variant="error">
                  <AlertTitle>Verification error</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div>
                <Button
                  size="lg"
                  icon={<ShieldCheck />}
                  loading={loading}
                  disabled={!selectedFile || loading}
                  onClick={handleVerify}
                >
                  Verify document
                </Button>
              </div>
            </Card>

            <div aria-live="polite">
              {outcome && <VerifyResult outcome={outcome} />}
            </div>
          </TabsContent>

          <TabsContent value="key" className="mt-0 flex flex-col gap-8">
            <Card className="flex flex-col gap-6 p-6 md:p-8">
              <div className="flex flex-col gap-1">
                <h3 className="text-xl font-extrabold text-navy">
                  Search by notarization key
                </h3>
                <p className="text-sm font-medium text-slate">
                  A key lookup shows that a record exists; uploading the file proves the file matches it.
                </p>
              </div>

              <form onSubmit={handleKeyLookup} className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <label htmlFor="verify-key" className="text-xs font-bold tracking-[0.12em] text-slate uppercase">
                    Unique Notarization Key
                  </label>
                  <Input
                    id="verify-key"
                    type="text"
                    placeholder="e.g. GH-A1B2-C3D4-E5F6-7890"
                    value={lookupKey}
                    onChange={(e) => {
                      setLookupKey(e.target.value);
                      setKeyOutcome(null);
                      setKeyError(null);
                    }}
                    className="font-mono"
                    leadingIcon={<Key />}
                  />
                  <p className="text-xs font-medium text-slate">
                    Accepts formats with or without dashes (e.g. GH-XXXX-XXXX-XXXX-XXXX or raw 16 characters).
                  </p>
                </div>

                {keyError && (
                  <Alert variant="error">
                    <AlertTitle>Lookup error</AlertTitle>
                    <AlertDescription>{keyError}</AlertDescription>
                  </Alert>
                )}

                <div>
                  <Button
                    type="submit"
                    size="lg"
                    icon={<Key />}
                    loading={keyLoading}
                    disabled={!lookupKey.trim() || keyLoading}
                  >
                    Look up key
                  </Button>
                </div>
              </form>
            </Card>

            <div aria-live="polite">
              {keyOutcome && (
                keyOutcome.kind === "found" ? (
                  <section
                    aria-labelledby="key-result-heading"
                    className="shadow-hard flex flex-col gap-6 rounded-card border-[4px] border-navy bg-green p-6 text-navy md:p-8"
                  >
                    <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-5">
                      <span
                        aria-hidden="true"
                        className="flex size-20 shrink-0 items-center justify-center rounded-card border-[2.5px] border-navy bg-white animate-stamp motion-reduce:animate-none"
                      >
                        <CircleCheck className="size-12" strokeWidth={2.5} />
                      </span>
                      <div className="flex flex-col gap-1">
                        <h2
                          id="key-result-heading"
                          className="text-3xl font-extrabold tracking-tight"
                        >
                          RECORD FOUND
                        </h2>
                        <p className="text-sm font-semibold opacity-90">
                          A key lookup shows that a record exists; uploading the file proves the file matches it.
                        </p>
                      </div>
                    </div>
                    <dl className="grid gap-6 md:grid-cols-2">
                      <div className="flex min-w-0 flex-col gap-2 md:col-span-2">
                        <dt className="text-xs font-bold tracking-[0.12em] uppercase">Unique Notarization Key</dt>
                        <dd className="flex min-w-0 items-start gap-3">
                          <span className="brut-border min-w-0 flex-1 rounded-input bg-white px-3 py-2 font-mono text-sm font-bold break-all">
                            {keyOutcome.key}
                          </span>
                          <CopyButton value={keyOutcome.key} label="unique notarization key" className="shrink-0" />
                        </dd>
                      </div>
                      <div className="flex min-w-0 flex-col gap-2">
                        <dt className="text-xs font-bold tracking-[0.12em] uppercase">Notary wallet</dt>
                        <dd className="flex min-w-0 items-start gap-3">
                          <span className="brut-border min-w-0 flex-1 rounded-input bg-white px-3 py-2 font-mono text-sm break-all">
                            {keyOutcome.record.notaryWallet}
                          </span>
                          <CopyButton value={keyOutcome.record.notaryWallet} label="notary wallet" className="shrink-0" />
                        </dd>
                      </div>
                      <div className="flex min-w-0 flex-col gap-2">
                        <dt className="text-xs font-bold tracking-[0.12em] uppercase">Recorded on-chain</dt>
                        <dd className="flex min-w-0 items-start gap-3">
                          <span className="min-w-0 flex-1 font-bold break-words">
                            {new Date(keyOutcome.record.timestamp * 1000).toLocaleString()}
                          </span>
                          <CopyButton
                            value={new Date(keyOutcome.record.timestamp * 1000).toLocaleString()}
                            label="recorded date"
                            className="shrink-0"
                          />
                        </dd>
                      </div>
                      <div className="flex min-w-0 flex-col gap-2">
                        <dt className="text-xs font-bold tracking-[0.12em] uppercase">Transaction hash</dt>
                        <dd className="flex min-w-0 items-start gap-3">
                          <span className="brut-border min-w-0 flex-1 rounded-input bg-white px-3 py-2 font-mono text-sm break-all">
                            {keyOutcome.record.transactionHash}
                          </span>
                          <CopyButton value={keyOutcome.record.transactionHash} label="transaction hash" className="shrink-0" />
                        </dd>
                      </div>
                      <div className="flex min-w-0 flex-col gap-2">
                        <dt className="text-xs font-bold tracking-[0.12em] uppercase">Block number</dt>
                        <dd className="flex min-w-0 items-start gap-3">
                          <span className="min-w-0 flex-1 font-bold break-words">
                            {String(keyOutcome.record.blockNumber)}
                          </span>
                          <CopyButton value={String(keyOutcome.record.blockNumber)} label="block number" className="shrink-0" />
                        </dd>
                      </div>
                      <div className="flex min-w-0 flex-col gap-2 md:col-span-2">
                        <dt className="text-xs font-bold tracking-[0.12em] uppercase">Contract address</dt>
                        <dd className="flex min-w-0 items-start gap-3">
                          <span className="brut-border min-w-0 flex-1 rounded-input bg-white px-3 py-2 font-mono text-sm break-all">
                            {keyOutcome.record.contractAddress}
                          </span>
                          <CopyButton value={keyOutcome.record.contractAddress} label="contract address" className="shrink-0" />
                        </dd>
                      </div>
                    </dl>
                  </section>
                ) : (
                  <section
                    aria-labelledby="key-not-found-heading"
                    className="shadow-hard flex flex-col gap-6 rounded-card border-[4px] border-navy bg-danger p-6 text-white md:p-8"
                  >
                    <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-5">
                      <span
                        aria-hidden="true"
                        className="flex size-20 shrink-0 items-center justify-center rounded-card border-[2.5px] border-navy bg-white text-danger animate-stamp motion-reduce:animate-none"
                      >
                        <X className="size-12" strokeWidth={3} />
                      </span>
                      <div className="flex flex-col gap-1">
                        <h2
                          id="key-not-found-heading"
                          className="text-3xl leading-tight font-extrabold tracking-tight text-white"
                        >
                          RECORD NOT FOUND
                        </h2>
                        <p className="text-sm font-semibold opacity-90">
                          A key lookup shows that a record exists; uploading the file proves the file matches it.
                        </p>
                      </div>
                    </div>
                    <p className="font-medium">
                      {keyOutcome.message || "No notarization matches this key. Please check the key format and try again."}
                    </p>
                    <div className="flex flex-col gap-2 rounded-card border-[2.5px] border-navy bg-white p-4 text-navy">
                      <p className="text-xs font-bold tracking-[0.12em] text-slate uppercase">
                        Searched key
                      </p>
                      <span className="font-mono text-sm font-bold break-all">{keyOutcome.key}</span>
                    </div>
                  </section>
                )
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </PageContainer>
  );
}
