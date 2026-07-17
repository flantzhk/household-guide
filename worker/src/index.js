// household-help-api — stores Leni's daily checkbox state so Faith can see it.
// No auth: Leni's helper view writes freely, Faith's employer view just reads.
// Mirrors the meal-planner-api pattern (single KV namespace, CORS locked to GitHub Pages).
//
// Three data shapes share the KV namespace:
//   checks:YYYY-MM-DD   -> { [timelineTaskId]: boolean }        resets every day
//   periodic-tasks      -> { [taskId]: { lastDone, history[] } } never resets, tracks
//                          once-in-a-while deep-clean tasks so Faith can review compliance
//   opened:YYYY-MM-DD   -> { first: "HH:MM", last: "HH:MM" }    page-open heartbeat, so the
//                          employer view can tell a real skip from a day the page was never opened

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

    const checksMatch = url.pathname.match(/^\/checks\/(.+)$/);
    if (checksMatch) {
      return handleChecks(request, env, checksMatch[1]);
    }

    const periodicMatch = url.pathname.match(/^\/periodic(?:\/([^/]+))?$/);
    if (periodicMatch) {
      return handlePeriodic(request, env, periodicMatch[1]);
    }

    const openedMatch = url.pathname.match(/^\/opened\/(.+)$/);
    if (openedMatch) {
      return handleOpened(request, env, openedMatch[1]);
    }

    return json({ error: 'Not found' }, env, 404);
  },
};

async function handleChecks(request, env, date) {
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
}

// periodic-tasks: once-in-a-while deep-clean tasks (monthly rotation, etc).
// Doesn't reset daily like checks: — each task remembers its own lastDone date
// and a short history, so the employer view can show compliance over time.
const PERIODIC_KEY = 'periodic-tasks';
const PERIODIC_HISTORY_LIMIT = 12;

async function handlePeriodic(request, env, taskId) {
  if (request.method === 'GET' && !taskId) {
    const stored = await env.HOUSEHOLD_DATA.get(PERIODIC_KEY, { type: 'json' });
    return json(stored || {}, env);
  }

  if (request.method === 'POST' && taskId) {
    let body;
    try {
      body = await request.json();
    } catch (e) {
      return json({ error: 'Invalid JSON body' }, env, 400);
    }
    const { done, date } = body;
    if (typeof done !== 'boolean' || !isValidDate(date)) {
      return json({ error: 'Body must be { done: boolean, date: "YYYY-MM-DD" }' }, env, 400);
    }
    const all = (await env.HOUSEHOLD_DATA.get(PERIODIC_KEY, { type: 'json' })) || {};
    const task = all[taskId] || { lastDone: null, history: [] };

    if (done) {
      if (!task.history.includes(date)) task.history.push(date);
      task.history.sort();
      task.history = task.history.slice(-PERIODIC_HISTORY_LIMIT);
      task.lastDone = task.history[task.history.length - 1];
    } else {
      task.history = task.history.filter(function (d) { return d !== date; });
      task.lastDone = task.history.length ? task.history[task.history.length - 1] : null;
    }

    all[taskId] = task;
    await env.HOUSEHOLD_DATA.put(PERIODIC_KEY, JSON.stringify(all));
    return json(all, env);
  }

  return json({ error: 'Method not allowed' }, env, 405);
}

// opened: page-open heartbeat. Leni's schedule page POSTs its local time on every load;
// first is set once, last updates every open. Lets the employer view separate
// "task skipped" from "the page was never opened that day".
const OPENED_TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

async function handleOpened(request, env, date) {
  if (!isValidDate(date)) {
    return json({ error: 'Invalid date, expected YYYY-MM-DD' }, env, 400);
  }
  const key = `opened:${date}`;

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
    const { time } = body;
    if (typeof time !== 'string' || !OPENED_TIME_RE.test(time)) {
      return json({ error: 'Body must be { time: "HH:MM" }' }, env, 400);
    }
    const current = (await env.HOUSEHOLD_DATA.get(key, { type: 'json' })) || {};
    if (!current.first) current.first = time;
    current.last = time;
    await env.HOUSEHOLD_DATA.put(key, JSON.stringify(current));
    return json(current, env);
  }

  return json({ error: 'Method not allowed' }, env, 405);
}
