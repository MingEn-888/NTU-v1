"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.supabaseAdmin = void 0;
exports.createSupabaseUserClient = createSupabaseUserClient;
const supabase_js_1 = require("@supabase/supabase-js");
const env_js_1 = require("./env.js");
if (!env_js_1.ENV.SUPABASE_URL) {
    console.warn("[Backend Supabase Warning]: SUPABASE_URL is not set in environment variables.");
}
/**
 * Supabase Admin Client (Service Role)
 * CAUTION: Bypasses Row Level Security (RLS). Use strictly for server-side trusted operations,
 * such as background task execution, webhooks, or system audit logging.
 */
exports.supabaseAdmin = (0, supabase_js_1.createClient)(env_js_1.ENV.SUPABASE_URL || "https://placeholder-project.supabase.co", env_js_1.ENV.SUPABASE_SERVICE_ROLE_KEY || env_js_1.ENV.SUPABASE_ANON_KEY || "placeholder-key", {
    auth: {
        persistSession: false,
        autoRefreshToken: false,
    },
});
/**
 * Creates a user-scoped Supabase client that forwards the user's Auth Bearer Token (JWT).
 * This ensures all queries respect Row Level Security (RLS) policies defined in PostgreSQL.
 *
 * @param token - Bearer JWT from Authorization header
 */
function createSupabaseUserClient(token) {
    return (0, supabase_js_1.createClient)(env_js_1.ENV.SUPABASE_URL || "https://placeholder-project.supabase.co", env_js_1.ENV.SUPABASE_ANON_KEY || "placeholder-key", {
        global: {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
        },
        auth: {
            persistSession: false,
            autoRefreshToken: false,
        },
    });
}
