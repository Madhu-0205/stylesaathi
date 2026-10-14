// Supabase Edge Function: delete-account
// Secure, server-side account deletion orchestrator
//
// Invariants:
// 1. Never trusts user_id from request body. Derives target identity strictly from verified JWT.
// 2. Uses server-side admin client to purge storage objects, database rows, and GoTrue auth record.
// 3. Service role key is stored securely in Edge Function environment variables, never exposed to client.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 1. Verify user identity cryptographically via anon client + JWT
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired user session' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = user.id;

    // 2. Initialize privileged server-side admin client for cascade
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Step A: Clean up private Storage files in 'wardrobe' bucket under user's folder
    try {
      const { data: fileList, error: listError } = await adminClient.storage
        .from('wardrobe')
        .list(userId);

      if (!listError && fileList && fileList.length > 0) {
        const filePaths = fileList.map((f) => `${userId}/${f.name}`);
        const { error: removeError } = await adminClient.storage
          .from('wardrobe')
          .remove(filePaths);

        if (removeError) {
          console.warn('Storage removal encountered partial error:', removeError);
        }
      }
    } catch (storageErr) {
      console.warn('Storage cleanup non-fatal error:', storageErr);
    }

    // Step B: Clean up database tables atomically via transactional RPC in foreign-key dependency order
    const { error: rpcError } = await adminClient.rpc('delete_user_data_records', {
      target_user_id: userId,
    });
    if (rpcError) {
      return new Response(
        JSON.stringify({ error: `Database cleanup failed: ${rpcError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step C: Delete user from Supabase Auth (GoTrue)
    const { error: deleteUserError } = await adminClient.auth.admin.deleteUser(userId);
    if (deleteUserError) {
      return new Response(
        JSON.stringify({ error: `Auth deletion failed: ${deleteUserError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Account and associated records successfully erased' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err?.message || 'Internal server error during account deletion' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
