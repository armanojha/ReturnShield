/**
 * Local development server for the health Lambda.
 *
 * This is a thin adapter, not a second implementation: it converts a Node HTTP
 * request into the same proxy event the deployed function receives and returns
 * the handler's own response verbatim. Running the web application against this
 * exercises the real handler and the real frozen envelope.
 *
 * It is a development convenience only. It is not deployed and is never
 * presented as deployment evidence.
 */
import { createServer } from 'node:http';

import { errorEnvelope, newCorrelationId } from '@returnshield/contracts';

import { handler } from './handler.js';
import { logger } from './logger.js';

const port = Number(process.env['HEALTH_PORT'] ?? 3001);

const server = createServer((request, reply) => {
  void (async () => {
    const url = request.url ?? '/';

    // Permissive CORS for local development only. The deployed API restricts
    // origins through API Gateway configuration in infra/.
    const cors: Record<string, string> = {
      'access-control-allow-origin': '*',
      'access-control-allow-headers': 'content-type,x-correlation-id',
      'access-control-allow-methods': 'GET,OPTIONS',
      'access-control-expose-headers': 'x-correlation-id',
    };

    if (request.method === 'OPTIONS') {
      reply.writeHead(204, cors);
      reply.end();
      return;
    }

    if (request.method !== 'GET' || url.split('?')[0] !== '/v1/health') {
      const correlationId = newCorrelationId();
      logger.warn({
        event: 'health.route_not_found',
        correlation_id: correlationId,
        outcome: 'failure',
        status_code: 404,
      });
      reply.writeHead(404, { 'content-type': 'application/json', ...cors });
      reply.end(
        JSON.stringify(errorEnvelope(correlationId, 'NOT_FOUND', 'No such route in this service.')),
      );
      return;
    }

    const result = await handler({ headers: request.headers as Record<string, string> });
    reply.writeHead(result.statusCode, { ...(result.headers as Record<string, string>), ...cors });
    reply.end(result.body);
  })();
});

server.listen(port, () => {
  logger.info({
    event: 'health.local_server_started',
    correlation_id: newCorrelationId(),
    outcome: 'success',
    port,
  });
});
