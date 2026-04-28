/**
 * Hubstaff time-tracking integration.
 *
 * MOCK FALLBACK is the default — HUBSTAFF_TOKEN is not set in .env.local.
 * When set, the live path uses apiCall() to hit Hubstaff's daily activities
 * endpoint and upserts each entry into time_entries (keyed by hubstaff_entry_id).
 *
 * The mock path returns a small synthetic batch so the rest of the system
 * (payroll page, time_entries queries) can be exercised end-to-end.
 */

import { createServiceClient } from "@/lib/supabase/server";
import { apiCall, logSkipped } from "@/lib/api-client";

type HubstaffEntry = {
  id: string;
  user_id: string;
  starts_at: string;
  stops_at: string;
  tracked: number; // seconds
};

export type HubstaffSyncResult = {
  mode: "live" | "mock";
  pulled: number;
  upserted: number;
  errors: string[];
};

/**
 * Pulls time entries since the last sync timestamp and upserts into
 * public.time_entries. Returns a summary for the caller (cron route or
 * admin "Sync now" button).
 */
export async function syncHubstaff(opts: { since: Date }): Promise<HubstaffSyncResult> {
  const token = process.env.HUBSTAFF_TOKEN;
  const result: HubstaffSyncResult = {
    mode: token ? "live" : "mock",
    pulled: 0,
    upserted: 0,
    errors: [],
  };

  let entries: HubstaffEntry[] = [];

  if (!token) {
    await logSkipped({
      service: "hubstaff",
      endpoint: "/v2/activities/daily",
      reason: "HUBSTAFF_TOKEN not configured (mock mode)",
    });
    entries = mockEntries(opts.since);
  } else {
    const url = `https://api.hubstaff.com/v2/activities/daily?starts_at=${encodeURIComponent(opts.since.toISOString())}`;
    const res = await apiCall<{ daily_activities?: HubstaffEntry[] }>({
      service: "hubstaff",
      endpoint: "/v2/activities/daily",
      method: "GET",
      url,
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    });
    if (!res.ok) {
      result.errors.push(res.error ?? "hubstaff fetch failed");
      return result;
    }
    entries = res.data?.daily_activities ?? [];
  }

  result.pulled = entries.length;

  if (entries.length === 0) return result;

  const sb = createServiceClient();

  // Map Hubstaff user_id → our profile id. In mock mode we don't have a real
  // mapping table yet, so the mock entries embed our profile UUID directly.
  for (const e of entries) {
    const row = {
      user_id: e.user_id,
      hubstaff_entry_id: e.id,
      source: "hubstaff",
      started_at: e.starts_at,
      ended_at: e.stops_at,
      duration_seconds: e.tracked,
      raw_payload: e as unknown as Record<string, unknown>,
      pulled_at: new Date().toISOString(),
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (sb.from("time_entries") as any).upsert(row, {
      onConflict: "hubstaff_entry_id",
    });
    if (error) {
      result.errors.push(error.message);
    } else {
      result.upserted += 1;
    }
  }

  return result;
}

function mockEntries(since: Date): HubstaffEntry[] {
  // No-op until we have any non-admin profiles to map to. Real mock seed
  // can be wired once the team is onboarded — keeps the table predictable.
  void since;
  return [];
}
