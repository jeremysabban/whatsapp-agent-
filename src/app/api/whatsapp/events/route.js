import { addListener, getStatus } from '@/lib/whatsapp-client';

export const dynamic = 'force-dynamic';

export async function GET() {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const status = getStatus();
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'status', data: status, timestamp: Date.now() })}\n\n`));

      const pingInterval = setInterval(() => {
        try { controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'ping', timestamp: Date.now() })}\n\n`)); }
        catch { clearInterval(pingInterval); }
      }, 15000);

      const removeListener = addListener((event) => {
        try { controller.enqueue(encoder.encode(`data: ${event}\n\n`)); }
        catch { removeListener(); clearInterval(pingInterval); }
      });

      controller._cleanup = () => { removeListener(); clearInterval(pingInterval); };
    },
    cancel() { if (this._cleanup) this._cleanup(); },
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive', 'X-Accel-Buffering': 'no' },
  });
}
