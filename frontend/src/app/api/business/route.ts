import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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

export async function GET(req: NextRequest) {
  const supabaseAdmin = getSupabaseAdmin();
  try {
    const { searchParams } = new URL(req.url);
    const address = searchParams.get("address")?.toLowerCase();

    if (!address) {
      return NextResponse.json({ error: "Address query parameter is required" }, { status: 400 });
    }

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
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
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
