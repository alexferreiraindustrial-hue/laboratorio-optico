export const ORDER_STATUSES = [
  "aguardando_lentes",
  "aguardando_montagem",
  "em_montagem",
  "em_correcao",
  "em_conferencia",
  "pronto",
  "entregue",
  "cancelado",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const STATUS_LABEL: Record<OrderStatus, string> = {
  aguardando_lentes: "Aguardando lentes",
  aguardando_montagem: "Aguardando montagem",
  em_montagem: "Em montagem",
  em_correcao: "Em correção",
  em_conferencia: "Em conferência de qualidade",
  pronto: "Pronto",
  entregue: "Entregue",
  cancelado: "Cancelado",
};

export const APP_ROLES = [
  "admin",
  "gestor",
  "montador",
  "estoquista",
  "consulta",
] as const;

export type AppRole = (typeof APP_ROLES)[number];

export const ROLE_LABEL: Record<AppRole, string> = {
  admin: "Administrador",
  gestor: "Gestor",
  montador: "Operador de montagem",
  estoquista: "Estoquista",
  consulta: "Consulta",
};

export const STEP_KEYS = [
  "conferencia_inicial",
  "lensometria",
  "blocagem",
  "facetadora",
  "conferencia_qualidade",
] as const;

export type StepKey = (typeof STEP_KEYS)[number];

export const STEP_LABEL: Record<StepKey, string> = {
  conferencia_inicial: "Conferência inicial",
  lensometria: "Lensometria",
  blocagem: "Blocagem",
  facetadora: "Facetadora",
  conferencia_qualidade: "Conferência de qualidade",
};

export const STEP_STATUSES = [
  "pendente",
  "em_andamento",
  "concluida",
  "reprovada",
] as const;

export type StepStatus = (typeof STEP_STATUSES)[number];

export const STEP_STATUS_LABEL: Record<StepStatus, string> = {
  pendente: "Pendente",
  em_andamento: "Em andamento",
  concluida: "Concluída",
  reprovada: "Reprovada",
};

export const OCCURRENCE_STATUSES = [
  "aberta",
  "em_tratamento",
  "resolvida",
  "dispensada",
] as const;

export type OccurrenceStatus = (typeof OCCURRENCE_STATUSES)[number];

export const OCCURRENCE_STATUS_LABEL: Record<OccurrenceStatus, string> = {
  aberta: "Aberta",
  em_tratamento: "Em tratamento",
  resolvida: "Resolvida",
  dispensada: "Dispensada",
};

export const SEVERITIES = ["baixa", "media", "alta", "critica"] as const;
export type Severity = (typeof SEVERITIES)[number];

export const SEVERITY_LABEL: Record<Severity, string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
  critica: "Crítica",
};

export const MOVEMENT_TYPES = [
  "entrada",
  "saida",
  "ajuste",
  "devolucao",
  "correcao",
  "consumo",
] as const;

export type MovementType = (typeof MOVEMENT_TYPES)[number];

export const MOVEMENT_LABEL: Record<MovementType, string> = {
  entrada: "Entrada",
  saida: "Saída",
  ajuste: "Ajuste de inventário",
  devolucao: "Devolução",
  correcao: "Correção de divergência",
  consumo: "Consumo por OS",
};

export const DEFAULT_QUALITY_CATEGORIES = [
  "Lente riscada",
  "Lente com dano externo",
  "Antirreflexo craquelado",
  "Lente sem tratamento devido",
  "Grau divergente do pedido",
  "Lente incorreta",
  "Erro de blocagem",
  "Erro de facetamento ou corte",
  "Problema identificado na conferência final",
  "Outros",
] as const;

export const TIME_ZONE = "America/Sao_Paulo";

export const CLOSED_STATUSES: OrderStatus[] = ["entregue", "cancelado"];

export const QUEUE_STATUSES: OrderStatus[] = [
  "aguardando_lentes",
  "aguardando_montagem",
  "em_montagem",
  "em_correcao",
  "em_conferencia",
  "pronto",
];
