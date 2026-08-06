/**
 * Standing DHL shipment presets — the values staff would otherwise retype into
 * MyDHL+ for every shipment. Source: "Trendlet — DHL Shipment Fields Spec".
 *
 * These are only FORM DEFAULTS. Every field stays editable on the create
 * shipment page, so a one-off shipment to a different receiver still works.
 *
 * Fields the spec does not define are deliberately left blank rather than
 * guessed — an invented HS code or postal code fails at customs, which is
 * worse than typing it.
 */

export type PackagePreset = {
  label: string;
  weightKg: number;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
};

/** Both presets ship the same goods to the same address — only size differs. */
export const PACKAGE_PRESETS: Record<"large" | "xl", PackagePreset> = {
  large: { label: "Large — 10 kg", weightKg: 10, lengthCm: 60.96, widthCm: 40.64, heightCm: 25.4 },
  xl: { label: "XL — 20 kg", weightKg: 20, lengthCm: 66.04, widthCm: 40.64, heightCm: 38.1 },
};

export const DEFAULT_PACKAGE_PRESET: keyof typeof PACKAGE_PRESETS = "xl";

/** Shipper — the US forwarding address goods are exported from. */
export const SHIPPER_PRESET = {
  fullName: "Muhammed Almutairi",
  companyName: "Commercial Sites Brokers Est",
  phone: "+12028304922",
  countryCode: "US",
  addressLine1: "1455 Valley Road",
  addressLine2: "B-246",
  addressLine3: "",
  cityName: "Wayne",
  postalCode: "07470",
} as const;

/** Receiver — Saudi National Address (TGA-mandated structure). */
export const RECEIVER_PRESET = {
  fullName: "smart access chain",
  companyName: "smart access chain",
  phone: "+966596601006",
  countryCode: "SA",
  addressLine1: "Elsamawa St, Haroon Elrasheed Way",
  addressLine2: "SULAI Dis",
  addressLine3: "RNMA7049", // short address
  cityName: "AL RIYADH",
  postalCode: "", // not in the spec — staff must supply it
} as const;

/** Customs line item / declared value. */
export const ITEM_PRESET = {
  description: "Boot, Bag, Watches",
  quantity: 1,
  declaredValue: 150,
  currency: "USD",
  commodityCode: "", // HS code not in the spec — never guess one
  manufacturerCountry: "", // not in the spec
} as const;
