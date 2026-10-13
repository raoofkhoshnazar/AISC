import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const authorization = request.headers.get('Authorization');
  if (!authorization) return json({ error: 'Authentication required' }, 401);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: authorization } } },
  );

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return json({ error: 'Authentication required' }, 401);

  const body = await request.json();
  const message = typeof body.message === 'string' ? body.message.trim() : '';
  if (!message || message.length > 4000) return json({ error: 'Message must be between 1 and 4000 characters' }, 400);

  let conversationId = typeof body.conversationId === 'string' ? body.conversationId : null;
  if (conversationId) {
    const { data: conversation } = await supabase
      .from('ai_conversations')
      .select('id')
      .eq('id', conversationId)
      .eq('user_id', userData.user.id)
      .maybeSingle();
    if (!conversation) conversationId = null;
  }

  if (!conversationId) {
    const { data: conversation, error: conversationError } = await supabase
      .from('ai_conversations')
      .insert({ user_id: userData.user.id })
      .select('id')
      .single();
    if (conversationError) return json({ error: 'Could not create conversation' }, 500);
    conversationId = conversation.id;
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role')
    .eq('id', userData.user.id)
    .single();
  const { data: studentProfile } = await supabase
    .from('student_profiles')
    .select('age_range, grade, weekly_time, skills, interests, audience, goal, idea')
    .eq('user_id', userData.user.id)
    .maybeSingle();
  const { data: history } = await supabase
    .from('ai_messages')
    .select('role, content')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(20);

  const { error: userMessageError } = await supabase.from('ai_messages').insert({
    conversation_id: conversationId,
    user_id: userData.user.id,
    role: 'user',
    content: message,
  });
  if (userMessageError) return json({ error: 'Could not save message' }, 500);

  const apiKey = Deno.env.get('noqte_ai_api_key');
  const model = Deno.env.get('noqte_ai_model');
  if (!apiKey || !model) return json({ error: 'AI service is not configured' }, 503);

  const system = `تو مستطاب، مربی AI پلتفرم AISC هستی. به فارسی ساده، مهربان و عملی پاسخ بده. مخاطب دانش‌آموز ۸ تا ۱۸ ساله است و دانش فنی عمیقی ندارد. پاسخ را به یک قدم کوچک و قابل انجام تبدیل کن. مسیر آموزشی AISC ثابت است؛ مسیر رسمی را تغییر نده و درباره تغییر مرحله، پیام به خانواده یا تصمیم مدیریتی ادعا نکن. از اطلاعات خصوصی دانش‌آموز فقط برای شخصی‌سازی همین پاسخ استفاده کن.\n\nپروفایل دانش‌آموز: ${JSON.stringify(profile ?? {})}\nاطلاعات شروع مسیر: ${JSON.stringify(studentProfile ?? {})}`;
  const messages = [...(history ?? []), { role: 'user', content: message }];

  const response = await fetch('https://api.noqte.ai/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({ model, max_tokens: 900, system, messages }),
  });

  if (!response.ok) return json({ error: 'AI service request failed' }, 502);
  const result = await response.json();
  const answer = result?.content?.find((item: { type?: string }) => item.type === 'text')?.text;
  if (!answer) return json({ error: 'AI service returned no answer' }, 502);

  const { error: assistantMessageError } = await supabase.from('ai_messages').insert({
    conversation_id: conversationId,
    user_id: userData.user.id,
    role: 'assistant',
    content: answer,
  });
  if (assistantMessageError) return json({ error: 'Could not save AI response' }, 500);

  await supabase.from('ai_conversations').update({ updated_at: new Date().toISOString() }).eq('id', conversationId);
  return json({ conversationId, answer });
});
