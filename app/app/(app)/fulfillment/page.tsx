import { redirect } from "next/navigation";

// Permanent redirect to /eu-fulfillment.
//
// /fulfillment was the original EU page. The new /eu-fulfillment page
// supersedes it (uses the marked_done_at flag for tab routing instead
// of status alone) and the sidebar now points there. This redirect
// preserves any existing bookmarks, deep links, or stale references.
//
// The other files in this directory (sub-order-row.tsx, actions.ts,
// extract-action.ts, etc.) are still imported by other code paths and
// are NOT removed by this change.
export default function FulfillmentRedirect() {
  redirect("/eu-fulfillment");
}
