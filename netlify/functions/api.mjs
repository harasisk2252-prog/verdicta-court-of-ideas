import { Readable } from 'node:stream';
import { api } from '../../server.js';

// Adapt the existing API without starting an HTTP listener or writing local JSON.
export default async function handler(request) {
  let status = 200;
  let headers = {};
  let payload = '';
  const response = {
    writeHead(code, values) { status = code; headers = values; },
    end(value = '') { payload = value; },
  };
  const incoming = request.body ? Readable.fromWeb(request.body) : Readable.from([]);
  incoming.method = request.method;
  try {
    await api(incoming, response, new URL(request.url));
  } catch (error) {
    status = error.message === 'Request too large' ? 413 : error instanceof SyntaxError ? 400 : 500;
    headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
    payload = JSON.stringify({ error: status === 413 ? 'Request too large' : status === 400 ? 'Invalid JSON request' : 'Something went wrong. Please try again.' });
  }
  return new Response(payload, { status, headers });
}

export const config = {
  path: '/api/*',
  rateLimit: { windowLimit: 30, windowSize: 60, aggregateBy: ['ip', 'domain'] },
};
