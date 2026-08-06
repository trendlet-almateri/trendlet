/**
 * Guards the DHL presets against the shipment spec. These values go onto a real
 * customs label, so a silent typo is expensive.
 * Run: npx tsx scripts/check-dhl-presets.mts
 */
import assert from "node:assert/strict";
import {
  PACKAGE_PRESETS,
  SHIPPER_PRESET,
  RECEIVER_PRESET,
  ITEM_PRESET,
} from "../lib/shipping/dhl-presets.ts";

// Package dimensions, exactly as MyDHL+ shows them (L x W x H cm).
assert.deepEqual(
  { ...PACKAGE_PRESETS.large, label: undefined },
  { label: undefined, weightKg: 10, lengthCm: 60.96, widthCm: 40.64, heightCm: 25.4 },
);
assert.deepEqual(
  { ...PACKAGE_PRESETS.xl, label: undefined },
  { label: undefined, weightKg: 20, lengthCm: 66.04, widthCm: 40.64, heightCm: 38.1 },
);

// Shipper is the NEW Wayne address — the spec explicitly retired the old
// Riverdale one, and shipping from the wrong origin is a real-world failure.
assert.equal(SHIPPER_PRESET.addressLine1, "1455 Valley Road");
assert.equal(SHIPPER_PRESET.cityName, "Wayne");
assert.equal(SHIPPER_PRESET.postalCode, "07470");
assert.ok(!/Riverdale/i.test(JSON.stringify(SHIPPER_PRESET)), "old Riverdale address must not return");

// Saudi National Address: all three lines are mandatory for TGA.
assert.equal(RECEIVER_PRESET.addressLine3, "RNMA7049");
assert.equal(RECEIVER_PRESET.countryCode, "SA");
assert.ok(RECEIVER_PRESET.addressLine1 && RECEIVER_PRESET.addressLine2);

// Phones must be E.164 — DHL rejects spaces/dashes.
for (const [who, phone] of [["shipper", SHIPPER_PRESET.phone], ["receiver", RECEIVER_PRESET.phone]]) {
  assert.match(phone, /^\+\d{8,15}$/, `${who} phone must be E.164, got "${phone}"`);
}

// Value is USD per the spec, not SAR.
assert.equal(ITEM_PRESET.currency, "USD");
assert.equal(ITEM_PRESET.declaredValue, 150);

// Fields the spec never defined must stay blank — a guessed HS code or origin
// country clears typecheck and then fails at customs.
assert.equal(ITEM_PRESET.commodityCode, "", "HS code must not be guessed");
assert.equal(ITEM_PRESET.manufacturerCountry, "", "manufacturer country must not be guessed");
assert.equal(RECEIVER_PRESET.postalCode, "", "receiver postal code must not be guessed");

console.log("ok — DHL presets match the spec");
