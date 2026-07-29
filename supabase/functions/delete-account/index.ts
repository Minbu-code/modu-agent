import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const authorization = request.headers.get("Authorization");
  if (!authorization) return new Response(JSON.stringify({ error: "로그인이 필요합니다." }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { global: { headers: { Authorization: authorization } } },
  );
  const token = authorization.replace("Bearer ", "");
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user) return new Response(JSON.stringify({ error: "사용자 인증에 실패했습니다." }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const userId = user.id;
  for (const table of ["generated_documents", "activity_logs", "case_tasks", "cases", "users_profile"]) {
    const { error } = await supabase.from(table).delete().eq("user_id", userId);
    if (error) return new Response(JSON.stringify({ error: `${table} 데이터 삭제에 실패했습니다.` }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const { error: deleteError } = await supabase.auth.admin.deleteUser(userId);
  if (deleteError) return new Response(JSON.stringify({ error: "계정 삭제에 실패했습니다." }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
