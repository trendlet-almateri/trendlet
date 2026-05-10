"use client";

import { openDB, type IDBPDatabase } from "idb";

/**
 * KSA offline write queue.
 *
 * Drivers in dead zones tap "Mark delivered" / "Out for delivery" / "Returned".
 * If the network call fails (offline or 5xx), the mutation is parked in
 * IndexedDB and replayed on the next `online` event or page focus.
 *
 * Scope is intentionally tiny: one store, one record per pending mutation,
 * keyed by sub_order id (a second tap on the same row replaces the queued
 * status — the latest tap wins).
 */

const DB_NAME = "optify-offline";
const DB_VERSION = 1;
const STORE = "delivery-mutations";

export type QueuedMutation = {
  subOrderId: string;
  status: "arrived_in_ksa" | "out_for_delivery" | "delivered" | "returned";
  queuedAt: number;
};

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb() {
  if (typeof window === "undefined") {
    throw new Error("offline queue is browser-only");
  }
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: "subOrderId" });
        }
      },
    });
  }
  return dbPromise;
}

export async function enqueueMutation(m: QueuedMutation): Promise<void> {
  const db = await getDb();
  await db.put(STORE, m);
}

export async function listQueuedMutations(): Promise<QueuedMutation[]> {
  const db = await getDb();
  return (await db.getAll(STORE)) as QueuedMutation[];
}

export async function removeMutation(subOrderId: string): Promise<void> {
  const db = await getDb();
  await db.delete(STORE, subOrderId);
}

/**
 * Try to flush every queued mutation. Each calls `runner` (the server action
 * wrapped in a fetch, since server actions can't be called from a SW context).
 * On success, the entry is removed; failures stay queued for the next attempt.
 *
 * Returns the count of mutations that were successfully flushed.
 */
export async function flushQueue(
  runner: (m: QueuedMutation) => Promise<{ ok: boolean }>,
): Promise<number> {
  const queued = await listQueuedMutations();
  let flushed = 0;
  for (const m of queued) {
    try {
      const res = await runner(m);
      if (res.ok) {
        await removeMutation(m.subOrderId);
        flushed += 1;
      }
    } catch {
      // network still down; leave it queued
    }
  }
  return flushed;
}
