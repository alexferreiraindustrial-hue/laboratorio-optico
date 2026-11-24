export type ClientDelivery = {
  id: string;
  order_id: string;
  client_delivered_at: string;
  followup_due_at: string;
  client_phone: string | null;
  contacted_at: string | null;
  outcome: string | null;
  feedback_note: string | null;
  updated_at: string;
};
export type ClientFollowupRow = ClientDelivery & {
  number: string;
  client_name: string;
  seller_name: string | null;
  seller_id: string | null;
};
export function feedbackPending(row: ClientDelivery, now: Date) {
  return !row.contacted_at && Date.parse(row.followup_due_at) <= now.getTime();
}
export function matchesFollowup(
  row: ClientFollowupRow,
  seller: string,
  mode: string,
  now: Date,
) {
  if (seller && row.seller_id !== seller) return false;
  switch (mode) {
    case "all":
      return true;
    case "pending":
      return feedbackPending(row, now);
    case "await":
      return (
        !row.contacted_at && Date.parse(row.followup_due_at) > now.getTime()
      );
    case "help":
      return row.outcome === "precisa_ajuda";
    case "contacted":
      return !!row.contacted_at;
    default:
      return false;
  }
}
export function feedbackMessage(client: string) {
  return `Olá, ${client}! Aqui é da ótica. Estamos entrando em contato para saber como você está se adaptando aos óculos. Está conseguindo enxergar bem? Está tudo confortável? Se precisar de ajuda, avise a gente.`;
}
