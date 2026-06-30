"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/require-role";
import { createServiceClient } from "@/lib/supabase/server";
import { createDhlLabel, type CreateLabelInput } from "@/lib/integrations/dhl";
import { uploadShipmentDoc } from "@/lib/storage/shipment-labels";

export type CreateShipmentState = {
  ok: boolean;
  error: string | null;
  trackingNumber?: string;
};

const addrSchema = z.object({
  fullName: z.string().trim().min(1, "Name required"),
  companyName: z.string().trim().optional(),
  phone: z.string().trim().min(1, "Phone required"),
  addressLine1: z.string().trim().min(1, "Address line 1 required"),
  addressLine2: z.string().trim().optional(),
  addressLine3: z.string().trim().optional(),
  cityName: z.string().trim().min(1, "City required"),
  postalCode: z.string().trim().min(1, "Postal code required"),
  countryCode: z.string().trim().length(2, "2-letter country code"),
});

const schema = z
  .object({
    productCode: z.enum(["P", "N"]),
    plannedShippingDateAndTime: z.string().trim().min(1),
    // shipper
    s: addrSchema,
    // receiver
    r: addrSchema,
    packageWeight: z.coerce.number().positive(),
    length: z.coerce.number().positive(),
    width: z.coerce.number().positive(),
    height: z.coerce.number().positive(),
    declaredValue: z.coerce.number().nonnegative(),
    declaredValueCurrency: z.string().trim().min(1),
    description: z.string().trim().min(1),
    // single line item (covers the common case; multi-item not needed yet)
    itemDescription: z.string().trim().min(1),
    commodityCode: z.string().trim().min(1),
    quantity: z.coerce.number().int().positive(),
    priceValue: z.coerce.number().nonnegative(),
    netWeight: z.coerce.number().positive(),
    grossWeight: z.coerce.number().positive(),
    manufacturerCountry: z.string().trim().length(2),
    invoiceNumber: z.string().trim().min(1),
    invoiceDate: z.string().trim().min(1),
  })
  .refine((v) => v.grossWeight <= v.netWeight, {
    message: "Gross weight must be ≤ net weight (DHL requirement).",
    path: ["grossWeight"],
  });

/** Parse the nested addr fields (s.fullName / r.phone …) out of FormData. */
function addrFrom(fd: FormData, prefix: "s" | "r") {
  const g = (k: string) => (fd.get(`${prefix}.${k}`) as string) || "";
  return {
    fullName: g("fullName"),
    companyName: g("companyName") || undefined,
    phone: g("phone"),
    addressLine1: g("addressLine1"),
    addressLine2: g("addressLine2") || undefined,
    addressLine3: g("addressLine3") || undefined,
    cityName: g("cityName"),
    postalCode: g("postalCode"),
    countryCode: g("countryCode"),
  };
}

export async function createShipmentAction(
  _prev: CreateShipmentState,
  fd: FormData,
): Promise<CreateShipmentState> {
  await requireAdmin();

  const parsed = schema.safeParse({
    productCode: fd.get("productCode"),
    plannedShippingDateAndTime: fd.get("plannedShippingDateAndTime"),
    s: addrFrom(fd, "s"),
    r: addrFrom(fd, "r"),
    packageWeight: fd.get("packageWeight"),
    length: fd.get("length"),
    width: fd.get("width"),
    height: fd.get("height"),
    declaredValue: fd.get("declaredValue"),
    declaredValueCurrency: fd.get("declaredValueCurrency"),
    description: fd.get("description"),
    itemDescription: fd.get("itemDescription"),
    commodityCode: fd.get("commodityCode"),
    quantity: fd.get("quantity"),
    priceValue: fd.get("priceValue"),
    netWeight: fd.get("netWeight"),
    grossWeight: fd.get("grossWeight"),
    manufacturerCountry: fd.get("manufacturerCountry"),
    invoiceNumber: fd.get("invoiceNumber"),
    invoiceDate: fd.get("invoiceDate"),
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const v = parsed.data;

  const input: CreateLabelInput = {
    productCode: v.productCode,
    plannedShippingDateAndTime: v.plannedShippingDateAndTime,
    shipper: v.s,
    receiver: v.r,
    packageWeight: v.packageWeight,
    dimensions: { length: v.length, width: v.width, height: v.height },
    declaredValue: v.declaredValue,
    declaredValueCurrency: v.declaredValueCurrency,
    description: v.description,
    isCustomsDeclarable: v.productCode === "P", // international → customs
    lineItems: [
      {
        description: v.itemDescription,
        commodityCode: v.commodityCode,
        quantity: v.quantity,
        priceValue: v.priceValue,
        priceCurrency: v.declaredValueCurrency,
        netWeight: v.netWeight,
        grossWeight: v.grossWeight,
        manufacturerCountry: v.manufacturerCountry,
      },
    ],
    invoiceNumber: v.invoiceNumber,
    invoiceDate: v.invoiceDate,
  };

  const result = await createDhlLabel(input);
  if (result.error || !result.tracking_number) {
    return { ok: false, error: result.error ?? "DHL did not return a tracking number." };
  }

  // Store the returned PDFs (label + invoice). The label path goes on the row.
  let labelPath: string | null = null;
  for (const doc of result.documents) {
    try {
      const buf = Buffer.from(doc.pdfBase64, "base64");
      const path = await uploadShipmentDoc(result.tracking_number, doc.typeCode, buf);
      if (doc.typeCode === "label" || doc.typeCode === "waybillDoc") labelPath = path;
    } catch (e) {
      console.error("[createShipmentAction] doc upload", e);
    }
  }

  const sb = createServiceClient();
  const { error: insErr } = await sb.from("shipments").insert({
    tracking_number: result.tracking_number,
    // DHL's service name (matches what the tracking flow stores). productCode
    // P/N are both DHL Express products.
    shipment_type: "Express",
    origin: `${v.s.cityName}, ${v.s.countryCode}`,
    destination: `${v.r.cityName}, ${v.r.countryCode}`,
    status: "pre-transit",
    label_storage_path: labelPath,
  });
  if (insErr) {
    // The DHL shipment exists; surface the save error but don't lose the number.
    return {
      ok: false,
      error: `Shipment ${result.tracking_number} created at DHL, but saving failed: ${insErr.message}`,
      trackingNumber: result.tracking_number,
    };
  }

  revalidatePath("/shipments");
  return { ok: true, error: null, trackingNumber: result.tracking_number };
}
