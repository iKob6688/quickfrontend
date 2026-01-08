export {
  agentOcr,
  agentAutoPostExpense,
  agentCreateQuotation,
  agentCreateContact,
  agentCreateInvoice,
  getAgentStatus,
  fileToBase64,
} from '@/api/services/agent.service'

export type {
  OcrResponse,
  OcrRequest,
  ExpenseAutoPostResponse,
  ExpenseAutoPostRequest,
  QuotationCreateResponse,
  QuotationCreateRequest,
  QuotationLineRequest,
  ContactCreateResponse,
  ContactCreateRequest,
  InvoiceCreateResponse,
  InvoiceCreateRequest,
  InvoiceLineRequest,
  AgentStatusResponse,
} from '@/api/services/agent.service'

