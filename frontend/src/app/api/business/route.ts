import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isSupabaseConfigured } from "@/lib/supabase/admin";

// Lazy initialization function to prevent Next.js build-time errors when env variables are not present
function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder-project.supabase.co";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder-key";
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

// -----------------------------------------------------------------------------
// Seed fallback — mirrors supabase/seed.sql so the demo keeps working when
// Supabase is not configured or unreachable (no .env.local / offline demo).
// -----------------------------------------------------------------------------

const SEED_PROFILE = {
  id: "b2000000-0000-0000-0000-000000000001",
  owner_user_id: "b1000000-0000-0000-0000-000000000001",
  business_name: "TechCorp Solutions Sdn Bhd",
  default_chain: "polygon",
};

const SEED_WALLET = {
  id: "b3000000-0000-0000-0000-000000000001",
  business_id: SEED_PROFILE.id,
  address: "0x3c44cdd470368a0623a22d2c4022878d3f9905e5",
  ens: "techcorp-treasury.eth",
  chain_id: 137,
  native_balance: 1250.5,
};

function seedFallback(address: string, reason: string) {
  const wallet = address === SEED_WALLET.address ? SEED_WALLET : null;
  return NextResponse.json({
    success: true,
    businessProfile: SEED_PROFILE,
    wallet,
    isFallback: true,
    fallbackReason: reason,
  });
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const address = searchParams.get("address")?.toLowerCase();

  if (!address) {
    return NextResponse.json({ error: "Address query parameter is required" }, { status: 400 });
  }

  // Supabase not configured -> serve seeded demo data instead of failing.
  if (!isSupabaseConfigured()) {
    return seedFallback(address, "Supabase is not configured — serving seeded demo data");
  }

  const supabaseAdmin = getSupabaseAdmin();
  try {

    // 1. Look up user by wallet address
    const { data: user, error: userError } = await supabaseAdmin
      .from("users")
      .select("*")
      .eq("wallet_address", address)
      .maybeSingle();

    if (userError) {
      return NextResponse.json({ error: userError.message }, { status: 500 });
    }

    let businessProfile = null;
    let wallet = null;

    if (user) {
      // 2. Fetch business profile owned by this user
      const { data: profile, error: profileError } = await supabaseAdmin
        .from("business_profiles")
        .select("*")
        .eq("owner_user_id", user.id)
        .maybeSingle();

      if (profileError) {
        return NextResponse.json({ error: profileError.message }, { status: 500 });
      }

      if (profile) {
        businessProfile = profile;
        // 3. Fetch wallets associated with this business profile
        const { data: wallets, error: walletsError } = await supabaseAdmin
          .from("wallets")
          .select("*")
          .eq("business_id", profile.id)
          .eq("address", address)
          .maybeSingle();

        if (walletsError) {
          return NextResponse.json({ error: walletsError.message }, { status: 500 });
        }
        wallet = wallets;
      }
    }

    // 4. Fallback if no matching user or profile found: Return default seeded CFO user/business context
    if (!businessProfile) {
      const { data: defaultProfile, error: defaultProfErr } = await supabaseAdmin
        .from("business_profiles")
        .select("*")
        .limit(1)
        .maybeSingle();

      if (defaultProfErr || !defaultProfile) {
        return NextResponse.json({ error: "No business profiles found in database" }, { status: 404 });
      }

      businessProfile = defaultProfile;

      // Check if there is a wallet matching the requested address for this default business
      const { data: defaultWallet } = await supabaseAdmin
        .from("wallets")
        .select("*")
        .eq("business_id", defaultProfile.id)
        .eq("address", address)
        .maybeSingle();

      wallet = defaultWallet || null;
    }

    return NextResponse.json({
      success: true,
      businessProfile,
      wallet,
      isFallback: !user,
    });
  } catch (err: any) {
    // Supabase unreachable (e.g. hosted project down / no connectivity) ->
    // degrade gracefully to the seeded demo context instead of a 500.
    console.warn("[PayMaster-business] Supabase unreachable, serving seed fallback:", err?.message);
    return seedFallback(address, `Supabase unreachable: ${err?.message ?? "unknown error"}`);
  }
}

export async function POST(req: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      {
        error:
          "Supabase is not configured — wallet association is unavailable in offline demo mode. Add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to frontend/.env.local.",
      },
      { status: 503 }
    );
  }
  const supabaseAdmin = getSupabaseAdmin();
  try {
    const { businessId, address, chainId, ens, nativeBalance } = await req.json();

    if (!businessId || !address) {
      return NextResponse.json({ error: "businessId and address are required" }, { status: 400 });
    }

    const normalizedAddress = address.toLowerCase();

    // Check if the wallet entry already exists for this business
    const { data: existingWallet } = await supabaseAdmin
      .from("wallets")
      .select("*")
      .eq("business_id", businessId)
      .eq("address", normalizedAddress)
      .maybeSingle();

    let result;
    if (existingWallet) {
      // Update the wallet balance, network and update time
      const { data, error } = await supabaseAdmin
        .from("wallets")
        .update({
          chain_id: chainId,
          ens: ens || existingWallet.ens,
          native_balance: nativeBalance,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingWallet.id)
        .select()
        .single();

      if (error) throw error;
      result = data;
    } else {
      // Insert new treasury wallet entry
      const { data, error } = await supabaseAdmin
        .from("wallets")
        .insert({
          business_id: businessId,
          address: normalizedAddress,
          ens: ens || null,
          chain_id: chainId,
          native_balance: nativeBalance,
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      result = data;
    }

    // Optional audit logging: Log the wallet association event
    await supabaseAdmin.from("audit_logs").insert({
      business_id: businessId,
      event_type: "WALLET_ASSOCIATED",
      description: `Wallet ${normalizedAddress} associated with business treasury context`,
      meta: {
        address: normalizedAddress,
        chain_id: chainId,
        ens: ens || null,
      },
    });

    return NextResponse.json({ success: true, wallet: result });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
