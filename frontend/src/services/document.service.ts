import { apiClient } from './apiClient'
import { NotarizedDocument, NotarizePayload, VerificationResult } from '../types'

export const documentService = {
  async notarize(payload: NotarizePayload): Promise<{ document: NotarizedDocument; tx: { hash: string; blockNumber: number } }> {
    const { data } = await apiClient.post('/documents/notarize', payload)
    return data
  },

  async verify(hash: string): Promise<VerificationResult> {
    const { data } = await apiClient.get<VerificationResult>(`/documents/verify/${hash}`)
    return data
  },

  async getMyDocuments(): Promise<NotarizedDocument[]> {
    const { data } = await apiClient.get<{ documents: NotarizedDocument[] }>('/documents')
    return data.documents
  },

  async getDocumentById(id: string): Promise<NotarizedDocument> {
    const { data } = await apiClient.get<{ document: NotarizedDocument }>(`/documents/${id}`)
    return data.document
  },
}
