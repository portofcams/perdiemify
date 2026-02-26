import { Hono } from 'hono';
import { cors } from 'hono/cors';

type Bindings = {
  VULTR_API_ORIGIN: string;
  CLERK_SECRET_KEY: string;
  // CACHE: KVNamespace;  // uncomment after creating KV namespace
};

const app = new Hono<{ Bindings: Bindings }>();

// CORS — allow perdiemify.com
app.use('*', cors({
  origin: ['https://perdiemify.com', 'http://localhost:3000'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

// Health check
app.get('/health', (c) => {
  return c.json({ status: 'ok', service: 'perdiemify-gateway' });
});

// Proxy all /api/* requests to Vultr
app.all('/api/*', async (c) => {
  const origin = c.env.VULTR_API_ORIGIN;
  const url = new URL(c.req.url);
  const targetUrl = `${origin}${url.pathname}${url.search}`;

  const headers = new Headers(c.req.raw.headers);
  headers.delete('host');

  const response = await fetch(targetUrl, {
    method: c.req.method,
    headers,
    body: c.req.method !== 'GET' ? await c.req.raw.text() : undefined,
  });

  return new Response(response.body, {
    status: response.status,
    headers: response.headers,
  });
});

export default app;
