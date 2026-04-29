/**
 * Phase 5: shared processor that pulls fresh Zoho inbound messages,
 * persists each PDF attachment as a supplier_invoices row, and
 * idempotently records seen messages in zoho_inbound_messages.
 *
 * Used by:
 *   - app/api/cron/poll-zoho-inbound/route.ts (daily cron)
 *   - app/(app)/admin/invoice-settings/poll-now-action.ts (admin button)
 *
 * The function is service-role-only (writes to zoho_inbound_messages
 * which is admin-RLS, plus storage upload). Callers MUST gate access
 * before invoking (cron secret OR admin requireAdmin()).
 */

import { createServiceClient } from "@/lib/supabase/server";
import {
  isZohoInboundConfigured,
  listInboundMessages,
  fetchMessageAttachments,
} from "@/lib/integrations/zoho-mail-inbound";

export type ProcessSummary = {
  mode: "live" | "mock";
  messagesScanned: number;
  messagesProcessed: number;
  messagesSkipped: number;
  messagesFailed: number;
  invoicesCreated: number;
  errors: string[];
};

const ACCOUNT_ID = process.env.ZOHO_ACCOUNT_ID ?? "";

export async function processZohoInbound(opts?: {
  lookbackHours?: number;
}): Promise<ProcessSummary> {
  const summary: ProcessSummary = {
    mode: isZohoInboundConfigured() ? "live" : "mock",
    messagesScanned: 0,
    messagesProcessed: 0,
    messagesSkipped: 0,
    messagesFailed: 0,
    invoicesCreated: 0,
    errors: [],
  };

  const list = await listInboundMessages({
    lookbackHours: opts?.lookbackHours,
  });
  if (list.error) {
    summary.errors.push(`list: ${list.error}`);
    return summary;
  }
  summary.messagesScanned = list.messages.length;

  if (list.messages.length === 0) {
    return summary;
  }

  const sb = createServiceClient();

  // Pre-load already-seen message ids to skip in one query.
  const ids = list.messages.map((m) => m.message_id);
  const { data: seenRows } = await sb
    .from("zoho_inbound_messages")
    .select("message_id")
    .in("message_id", ids);
  const seen = new Set((seenRows ?? []).map((r) => r.message_id));

  for (const msg of list.messages) {
    if (seen.has(msg.message_id)) {
      summary.messagesSkipped += 1;
      continue;
    }
    if (!msg.has_attachments) {
      // Track it so we don't re-evaluate every poll, even though we don't act.
      await sb.from("zoho_inbound_messages").insert({
        message_id: msg.message_id,
        account_id: ACCOUNT_ID,
        from_address: msg.from_address,
        subject: msg.subject,
        received_at: msg.received_at,
        attachment_count: 0,
        status: "skipped",
        error_message: "no attachments",
      });
      summary.messagesSkipped += 1;
      continue;
    }

    const att = await fetchMessageAttachments({ messageId: msg.message_id });
    if (att.error) {
      await sb.from("zoho_inbound_messages").insert({
        message_id: msg.message_id,
        account_id: ACCOUNT_ID,
        from_address: msg.from_address,
        subject: msg.subject,
        received_at: msg.received_at,
        attachment_count: 0,
        status: "failed",
        error_message: att.error,
      });
      summary.messagesFailed += 1;
      summary.errors.push(`${msg.message_id}: ${att.error}`);
      continue;
    }

    if (att.attachments.length === 0) {
      await sb.from("zoho_inbound_messages").insert({
        message_id: msg.message_id,
        account_id: ACCOUNT_ID,
        from_address: msg.from_address,
        subject: msg.subject,
        received_at: msg.received_at,
        attachment_count: 0,
        status: "skipped",
        error_message: "no PDF attachments",
      });
      summary.messagesSkipped += 1;
      continue;
    }

    let createdForThisMessage = 0;
    for (const a of att.attachments) {
      // Path: zoho-inbound/{yyyy-mm}/{message_id}-{idx}-{safe_filename}
      const yyyymm = new Date().toISOString().slice(0, 7);
      const safeName = a.filename
        .replace(/[^a-zA-Z0-9._-]/g, "_")
        .slice(0, 120);
      const storagePath = `zoho-inbound/${yyyymm}/${msg.message_id}-${a.attachment_id}-${safeName}`;

      const { error: upErr } = await sb.storage
        .from("supplier-invoices")
        .upload(storagePath, a.bytes, {
          contentType: "application/pdf",
          upsert: false,
        });
      if (upErr) {
        summary.errors.push(`upload ${msg.message_id}/${a.attachment_id}: ${upErr.message}`);
        continue;
      }

      // Inbound supplier_invoices rows have no human uploader. The
      // 20260429000009 migration relaxed uploaded_by NOT NULL with a
      // CHECK constraint that allows null only when source != 'manual'.
      const { error: insErr } = await sb.from("supplier_invoices").insert({
        uploaded_by: null,
        storage_path: storagePath,
        original_filename: a.filename,
        file_size_bytes: a.bytes.length,
        mime_type: "application/pdf",
        source: "inbound_email",
        notes:
          `Auto-imported from Zoho mail. From: ${msg.from_address ?? "?"}. ` +
          `Subject: ${msg.subject ?? "(no subject)"}. ` +
          `Message id: ${msg.message_id}.`,
      });
      if (insErr) {
        await sb.storage.from("supplier-invoices").remove([storagePath]).catch(() => {});
        summary.errors.push(
          `insert ${msg.message_id}/${a.attachment_id}: ${insErr.message}`,
        );
        continue;
      }
      createdForThisMessage += 1;
      summary.invoicesCreated += 1;
    }

    await sb.from("zoho_inbound_messages").insert({
      message_id: msg.message_id,
      account_id: ACCOUNT_ID,
      from_address: msg.from_address,
      subject: msg.subject,
      received_at: msg.received_at,
      attachment_count: createdForThisMessage,
      status: createdForThisMessage > 0 ? "processed" : "failed",
      error_message:
        createdForThisMessage === 0 ? "no attachments persisted" : null,
    });

    if (createdForThisMessage > 0) {
      summary.messagesProcessed += 1;
    } else {
      summary.messagesFailed += 1;
    }
  }

  return summary;
}
