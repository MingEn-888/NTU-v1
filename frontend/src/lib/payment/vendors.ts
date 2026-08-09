// =============================================================================
// Business Vendor / Payee Directory
// The AI payment operations agent resolves natural-language payees against this
// directory so it can surface a real destination address in the payment request.
// =============================================================================

export interface Vendor {
  name: string;
  /** Lower-cased aliases used for matching natural-language mentions. */
  aliases: string[];
  address: string;
  notes?: string;
}

export const VENDOR_DIRECTORY: Vendor[] = [
  {
    name: "Alice Tan",
    aliases: ["alice", "alice tan", "alice t", "software vendor"],
    address: "0x71C7656EC7ab88b098defB751B7401B5f6d8976F",
    notes: "Software Vendor · Invoice INV-1024",
  },
  {
    name: "Marcus Lee",
    aliases: ["contractor", "marcus", "marcus lee"],
    address: "0x1D5C3E09A75B1dE12FfCe9B4A2bCCc8Ef0Ae3d91",
    notes: "Freelance Contractor",
  },
  {
    name: "Priya Sharma",
    aliases: ["priya", "priya sharma", "consultant", "consulting"],
    address: "0x4B2A9fC87D5e1f0aB3C6d8E9F2A4b7c1D3e5F6a0",
    notes: "Strategy Consultant",
  },
  {
    name: "Emma Wong",
    aliases: ["emma", "emma wong", "landlord", "property"],
    address: "0x8aC1dF2B3e4F5a6b7C8d9E0f1A2b3C4d5E6f7A8b",
    notes: "Office Landlord",
  },
  {
    name: "David Chen",
    aliases: ["david", "david chen", "vendor", "supplier"],
    address: "0x2F3a4B5c6D7e8F9a0B1c2D3e4F5a6B7c8D9e0F1a",
    notes: "Equipment Supplier",
  },
  {
    name: "Nadia Rahman",
    aliases: ["nadia", "nadia rahman", "marketing", "agency"],
    address: "0x6C7d8E9f0A1b2C3d4E5f6A7b8C9d0E1f2A3b4C5d",
    notes: "Marketing Agency",
  },
];

/** Reverse lookup by lower-cased address. */
export function findVendorByAddress(address: string): Vendor | null {
  const normalized = address.toLowerCase();
  return VENDOR_DIRECTORY.find((v) => v.address.toLowerCase() === normalized) || null;
}

/** Best-effort lookup by a natural-language payee mention. */
export function findVendorByMention(mention: string): Vendor | null {
  const lower = mention.toLowerCase().trim();
  if (!lower) return null;

  // Exact name or alias match first.
  const exact = VENDOR_DIRECTORY.find((v) => {
    const names = [v.name.toLowerCase(), ...v.aliases];
    return names.includes(lower);
  });
  if (exact) return exact;

  // Substring / word containment match.
  return (
    VENDOR_DIRECTORY.find((v) => {
      const names = [v.name.toLowerCase(), ...v.aliases];
      return names.some((n) => {
        if (n.includes(lower)) return true;
        if (lower.split(/\s+/).length === 1) return lower.split(/\s+/).some((w) => n.includes(w));
        return false;
      });
    }) || null
  );
}
