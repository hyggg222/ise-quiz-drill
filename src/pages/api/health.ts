import type { APIRoute } from 'astro';

export const GET: APIRoute = async () => {
  const healthData = {
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  };

  return new Response(JSON.stringify(healthData), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
    },
  });
};
