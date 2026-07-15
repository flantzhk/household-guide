// household-help-api — stores Leni's daily checkbox state so Faith can see it.
// No auth: Leni's helper view writes freely, Faith's employer view just reads.
// Mirrors the meal-planner-api pattern (single KV namespace, CORS locked to GitHub Pages).

function corsHeaders(env) {
  return {
    'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function json(data, env, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(env) },
  });
}

function isValidDate(d) {
  return /^\d{4}-\d{2}-\d{2}$/.test(d);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders(env) });
    }

    const match = url.pathname.match(/^\/checks\/(.+)$/);
    if (!match) {
      return json({ error: 'Not found' }, env, 404);
    }
    const date = match[1];
    if (!isValidDate(date)) {
      return json({ error: 'Invalid date, expected YYYY-MM-DD' }, env, 400);
    }
    const key = `checks:${date}`;

    if (request.method === 'GET') {
      const stored = await env.HOUSEHOLD_DATA.get(key, { type: 'json' });
      return json(stored || {}, env);
    }

    if (request.method === 'POST') {
      let body;
      try {
        body = await request.json();
      } catch (e) {
        return json({ error: 'Invalid JSON body' }, env, 400);
      }
      const { id, checked } = body;
      if (typeof id !== 'string' || !id || typeof checked !== 'boolean') {
        return json({ error: 'Body must be { id: string, checked: boolean }' }, env, 400);
      }
      const current = (await env.HOUSEHOLD_DATA.get(key, { type: 'json' })) || {};
      current[id] = checked;
      await env.HOUSEHOLD_DATA.put(key, JSON.stringify(current));
      return json(current, env);
    }

    return json({ error: 'Method not allowed' }, env, 405);
  },
};
