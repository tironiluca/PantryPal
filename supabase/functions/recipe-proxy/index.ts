// Supabase Edge Function: fetches a public recipe page server-side so the app does not have to
// send recipe URLs through third-party CORS proxies (IMPLEMENTATION_PLAN.md A4).
//
// POST { "url": "https://..." }  ->  200 { "html": "...", "finalUrl": "https://..." }
//                                    400 { "error": "..." } for URLs it refuses to fetch
//                                    502 { "error": "..." } when the site cannot be fetched
//
// Deploy: supabase functions deploy recipe-proxy
// JWT verification stays on (the default), so only signed-in users can call it.
import {
  BlockedUrlError,
  FETCH_TIMEOUT_MS,
  MAX_REDIRECTS,
  MAX_RESPONSE_BYTES,
  isAcceptableContentType,
  isIpLiteral,
  isPrivateAddress,
  parseRecipeUrl,
} from './validate.ts';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

/** Refuse hostnames that resolve to private addresses (blocks DNS names pointing inside). */
async function assertPublicHost(url: URL): Promise<void> {
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (isIpLiteral(host)) {
    if (isPrivateAddress(host)) throw new BlockedUrlError('Local network addresses are not supported');
    return;
  }
  const addresses: string[] = [];
  for (const type of ['A', 'AAAA'] as const) {
    try {
      addresses.push(...(await Deno.resolveDns(host, type)));
    } catch {
      // No records of this type.
    }
  }
  if (addresses.length === 0) throw new BlockedUrlError('That website could not be found');
  if (addresses.some(isPrivateAddress)) throw new BlockedUrlError('Local network addresses are not supported');
}

async function readCapped(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return '';
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_RESPONSE_BYTES) {
      await reader.cancel();
      throw new Error('The page is too large to import');
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

/** Fetch with manual redirects so every hop is validated, a timeout, and a size cap. */
async function fetchRecipePage(start: URL): Promise<{ html: string; finalUrl: string }> {
  let url = start;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublicHost(url);
    const response = await fetch(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: {
        'Accept': 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5',
        'User-Agent': 'PantryPal-RecipeImport/1.0',
      },
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      await response.body?.cancel();
      if (!location) throw new Error('The website sent an invalid redirect');
      url = parseRecipeUrl(new URL(location, url).toString());
      continue;
    }
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error(`The website responded with HTTP ${response.status}`);
    }
    if (!isAcceptableContentType(response.headers.get('content-type'))) {
      await response.body?.cancel();
      throw new Error('That address is not a web page');
    }
    return { html: await readCapped(response), finalUrl: url.toString() };
  }
  throw new Error('Too many redirects');
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });

  let body: { url?: unknown };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: 'Expected a JSON body with a url' });
  }

  try {
    const url = parseRecipeUrl(body.url);
    return json(200, await fetchRecipePage(url));
  } catch (error) {
    if (error instanceof BlockedUrlError) return json(400, { error: error.message });
    const message = error instanceof Error ? error.message : 'Fetch failed';
    return json(502, { error: message.includes('timed out') || message.includes('aborted') ? 'The website took too long to respond' : message });
  }
});
