import type { AnyDocumentDTO, DocType } from '../types/dto'

export type GetDocumentParams = {
  docType: DocType
  recordId: string
}

export interface OdooProvider {
  getDocumentDTO(params: GetDocumentParams): Promise<AnyDocumentDTO>
}


