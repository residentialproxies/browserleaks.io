/**
 * Events Routes (Hono Worker)
 *
 * Server-Sent Events (SSE) endpoint for real-time telemetry streaming.
 * Uses Web Streams API for Worker compatibility.
 *
 * GET /v1/events/stream - SSE telemetry stream
 */

import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import type { AppContext, Env } from '../types/env';
import type { RiskLevel } from '@browserleaks/types';

export interface TelemetryEvent {
  id: string;
  type: string;
  source: string;
  severity: RiskLevel;
  summary: string;
  timestamp: number;
  payload?: unknown;
}

interface LeakLogEntry {
  id: string;
  createdAt: number;
  privacyScore: number;
  entropyScore: number;
  leaks: {
    webrtc: boolean;
    dns: string;
    battery: boolean;
    motion: boolean;
  };
  apiSurface: Record<string, string>;
}

/**
 * Create events routes
 */
export function createEventsRoutes() {
  const router = new Hono<AppContext>();

  /**
   * GET /events/stream
   * Server-Sent Events stream for real-time telemetry
   */
  router.get('/events/stream', async (c) => {
    const env = c.env as Env;

    return streamSSE(c, async (stream) => {
      // Send initial seed data from D1
      try {
        const result = await env.DB.prepare(
          `SELECT id, data, event_type, created_at
           FROM telemetry_events
           ORDER BY created_at DESC
           LIMIT 15`
        ).all<{ id: string; data: string; event_type: string; created_at: string }>();

        if (result.results) {
          for (const row of result.results) {
            const entry = {
              id: row.id,
              type: row.event_type,
              data: JSON.parse(row.data),
              createdAt: row.created_at,
            };
            await stream.writeSSE({
              event: 'seed',
              data: JSON.stringify(entry),
            });
          }
        }
      } catch (error) {
        console.warn('Failed to seed telemetry events:', error);
        // Send mock seed data if D1 query fails
        const mockEvents = generateMockSeedEvents();
        for (const event of mockEvents) {
          await stream.writeSSE({
            event: 'seed',
            data: JSON.stringify(event),
          });
        }
      }

      // Heartbeat interval
      let heartbeatCount = 0;
      const maxHeartbeats = 60; // ~15 minutes at 15s intervals

      while (heartbeatCount < maxHeartbeats) {
        // Send heartbeat every 15 seconds
        await stream.sleep(15000);
        await stream.writeSSE({
          event: 'heartbeat',
          data: JSON.stringify({ timestamp: Date.now() }),
        });
        heartbeatCount++;

        // Occasionally send a simulated telemetry event for demo purposes
        if (Math.random() < 0.2) {
          const event = generateSimulatedEvent();
          await stream.writeSSE({
            event: 'telemetry',
            data: JSON.stringify(event),
          });
        }
      }
    });
  });

  /**
   * POST /events/log
   * Log a telemetry event
   */
  router.post('/events/log', async (c) => {
    try {
      const body = await c.req.json();
      const env = c.env as Env;

      const id = crypto.randomUUID();
      const eventType = body.type || 'scan';

      // Store in D1
      await env.DB.prepare(
        `INSERT INTO telemetry_events (id, event_type, visitor_id, session_id, data, user_agent, ip, country, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
      )
        .bind(
          id,
          eventType,
          body.visitorId || null,
          body.sessionId || null,
          JSON.stringify(body.data || {}),
          c.req.header('user-agent') || null,
          c.get('clientIP'),
          null // Country would need geo lookup
        )
        .run();

      return c.json({
        success: true,
        data: {
          id,
          message: 'Event logged successfully',
        },
      });
    } catch (error) {
      console.error('Telemetry log error:', error);

      return c.json(
        {
          success: false,
          error: {
            code: 'TELEMETRY_LOG_ERROR',
            message: error instanceof Error ? error.message : 'Failed to log telemetry event',
          },
        },
        500
      );
    }
  });

  return router;
}

// Helper functions

function generateMockSeedEvents(): LeakLogEntry[] {
  const events: LeakLogEntry[] = [];
  const now = Date.now();

  for (let i = 0; i < 5; i++) {
    events.push({
      id: crypto.randomUUID(),
      createdAt: now - i * 60000,
      privacyScore: Math.floor(Math.random() * 40) + 50,
      entropyScore: Math.floor(Math.random() * 30) + 60,
      leaks: {
        webrtc: Math.random() > 0.7,
        dns: Math.random() > 0.8 ? 'partial' : 'none',
        battery: Math.random() > 0.9,
        motion: Math.random() > 0.85,
      },
      apiSurface: {
        WebGL: 'enabled',
        Canvas: 'enabled',
        Audio: 'enabled',
        Fonts: 'partial',
      },
    });
  }

  return events;
}

function generateSimulatedEvent(): TelemetryEvent {
  const types = ['scan_complete', 'leak_detected', 'fingerprint_analyzed', 'config_change'];
  const sources = ['ip-detector', 'webrtc-analyzer', 'dns-checker', 'fingerprint-engine'];
  const severities: RiskLevel[] = ['low', 'medium', 'high', 'critical'];

  const type = types[Math.floor(Math.random() * types.length)];
  const source = sources[Math.floor(Math.random() * sources.length)];
  const severity = severities[Math.floor(Math.random() * severities.length)];

  const summaries: Record<string, string> = {
    scan_complete: 'Privacy scan completed successfully',
    leak_detected: `${severity === 'critical' ? 'Critical' : 'Potential'} leak detected`,
    fingerprint_analyzed: 'Browser fingerprint analysis complete',
    config_change: 'Privacy configuration updated',
  };

  return {
    id: crypto.randomUUID(),
    type,
    source,
    severity,
    summary: summaries[type],
    timestamp: Date.now(),
    payload: {
      score: Math.floor(Math.random() * 40) + 50,
      region: 'US',
    },
  };
}
