import type { OccurrenceStatus, OrderStatus, Severity, StepKey, StepStatus } from "@/lib/domain/constants";
import type { Urgency } from "@/lib/domain/urgency";
import type { AppRole } from "@/lib/domain/constants";

export type Profile = {
  id: string;
  full_name: string;
  role: AppRole;
  active: boolean;
};

export type Laboratory = {
  id: string;
  name: string;
  code: string;
  color: string;
  active: boolean;
  notes: string | null;
};

export type Seller = {
  id: string;
  name: string;
  active: boolean;
  notes: string | null;
  public_code?: string;
  phone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  quick_code?: number | null;
};

export type Store = {
  id: string;
  public_code: string;
  trade_name: string;
  legal_name: string | null;
  cnpj: string | null;
  contact_name: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  active: boolean;
  quick_code?: number | null;
};

export type SellerStoreLink = {
  seller_id: string;
  store_id: string;
};

export type LensSpec = {
  od_sphere?: string;
  od_cylinder?: string;
  od_axis?: string;
  oe_sphere?: string;
  oe_cylinder?: string;
  oe_axis?: string;
  addition?: string;
  frame?: string;
  lens_notes?: string;
};

export type OrderRow = {
  id: string;
  number: string;
  client_name: string;
  seller_id: string | null;
  seller_name: string | null;
  store_id?: string | null;
  store_name?: string | null;
  store_code?: string | null;
  laboratory_id: string;
  laboratory_name: string;
  laboratory_color: string;
  laboratory_code: string;
  entered_at: string;
  due_at: string | null;
  notes: string | null;
  service_description: string;
  external_order_id: string | null;
  status: OrderStatus;
  priority: "normal" | "critica";
  lens_spec: LensSpec;
  completed_at: string | null;
  delivered_at: string | null;
  urgency: Urgency;
  created_at: string;
  lens_expected_at?: string | null;
  lens_supplier_ref?: string | null;
  lens_arrived_at?: string | null;
  /** Etapas de montagem concluídas (0 a 5), preenchido nas listagens. */
  steps_done?: number;
};

export type StepRow = {
  id: string;
  order_id: string;
  step_key: StepKey;
  status: StepStatus;
  assignee_id: string | null;
  started_at: string | null;
  completed_at: string | null;
  notes: string | null;
  measurements: Record<string, string>;
};

export type OccurrenceRow = {
  id: string;
  order_id: string;
  category_id: string;
  category_name?: string;
  step_key: StepKey | null;
  occurred_at: string;
  description: string;
  severity: Severity;
  status: OccurrenceStatus;
  corrective_action: string | null;
  closing_note: string | null;
};

export type StockRow = {
  id: string;
  public_code: string;
  manufacturer: string | null;
  brand: string | null;
  material: string | null;
  refractive_index: number | null;
  treatment: string | null;
  color: string | null;
  diameter_mm: number | null;
  sphere_cents: number;
  cylinder_cents: number;
  addition_cents: number | null;
  lens_type: string | null;
  lot_code: string | null;
  location: string | null;
  is_special: boolean;
  min_qty: number;
  ideal_qty: number;
  current_qty: number;
  unit_cost_cents: number | null;
  active: boolean;
  notes: string | null;
};

export type ActionResult = { ok: true; message?: string; id?: string } | { ok: false; message: string };
