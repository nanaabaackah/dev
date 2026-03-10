export const DEFAULT_INVOICE_POLICY_NOTES = [
  "Payment and invoicing policy:",
  "- A 50% deposit is required to confirm new projects and reserve production time.",
  "- The remaining balance is due by the invoice due date before final delivery, launch, or handoff.",
  "- Monthly and recurring services are billed in advance unless otherwise agreed in writing.",
  "- Late payments may pause active work, delivery, and support until the balance is cleared.",
  "- Additional scope or revisions outside the agreed estimate will be invoiced separately upon approval.",
].join("\n");

export const buildInvoiceNotes = (leadNote = "") => {
  const normalizedLeadNote = String(leadNote || "").trim();
  if (!normalizedLeadNote) {
    return DEFAULT_INVOICE_POLICY_NOTES;
  }
  return `${normalizedLeadNote}\n\n${DEFAULT_INVOICE_POLICY_NOTES}`;
};
