/**
 * Guards the Twilio ContentVariables sanitizer: newlines in a product title
 * used to 400 the whole notification ("Content Variables parameter is invalid").
 * Run: npx tsx scripts/check-content-variables.mts
 */
import assert from "node:assert/strict";
import { contentVariables } from "../lib/integrations/twilio.ts";

// The real offender: sub-orders 1520-01, 1504-01, 1202-01, 1257-01.
assert.equal(
  contentVariables({ "1": "1520-01", "2": "Tory Burch Britten\nMicro Satchel" }),
  '{"1":"1520-01","2":"Tory Burch Britten Micro Satchel"}',
);

// Signed-URL path (invoice template {{2}}) must survive untouched.
const path = "storage/v1/object/sign/invoices/1514-01.pdf?token=abc.def-ghi_jkl";
assert.equal(JSON.parse(contentVariables({ "1": "1514-01", "2": path }))["2"], path);

// Tabs, CRLF and outer padding all collapse.
assert.equal(JSON.parse(contentVariables({ "1": "  a\r\n\tb  " }))["1"], "a b");

console.log("ok — contentVariables");
