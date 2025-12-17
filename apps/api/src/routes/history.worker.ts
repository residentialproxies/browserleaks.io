/**
 * History Routes (Hono Worker)
 *
 * Endpoints for scan history and comparison features.
 * Uses D1 database for persistent storage.
 *
 * GET /v1/history - Get scan history for a visitor
 * POST /v1/history - Save a scan to history
 * POST /v1/history/compare - Compare multiple scans
 * GET /v1/history/:scanId - Get a specific scan
 * DELETE /v1/history/:scanId - Delete a scan
 * DELETE /v1/history - Clear all history
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { AppContext, Env } from '../types/env';
import type { APIResponse, RiskLevel } from '@browserleaks/types';

// Validation schemas
const getHistoryQuerySchema = z.object({
  visitorId: z.string().min(16).max(64),
  limit: z.coerce.number().min(1).max(100).default(10),
  offset: z.coerce.number().min(0).default(0),
});

const saveScanSchema = z.object({
  visitorId: z.string().min(16).max(64),
  scan: z.object({
    privacyScore: z
      .object({
        total: z.number().optional(),
        riskLevel: z.string().optional(),
      })
      .optional(),
    fingerprint: z
      .object({
        uniquenessScore: z.number().optional(),
        combinedHash: z.string().optional(),
      })
      .optional(),
    ip: z
      .object({
        address: z.string().optional(),
        privacy: z
          .object({
            isVpn: z.boolean().optional(),
            isProxy: z.boolean().optional(),
            isTor: z.boolean().optional(),
          })
          .optional(),
      })
      .optional(),
    dns: z
      .object({
        isLeak: z.boolean().optional(),
        leakType: z.string().optional(),
      })
      .optional(),
    webrtc: z
      .object({
        isLeak: z.boolean().optional(),
      })
      .optional(),
  }),
});

const compareSchema = z.object({
  scanIds: z.array(z.string()).min(2).max(5),
});

// Database row types
interface ScanHistoryRow {
  id: string;
  visitor_id: string;
  scan_data: string; // JSON string
  privacy_score: number | null;
  risk_level: string | null;
  created_at: string;
}

interface StoredScan {
  id: string;
  timestamp: string;
  privacyScore?: { total?: number; riskLevel?: string };
  fingerprint?: { uniquenessScore?: number; combinedHash?: string };
  ip?: { address?: string; privacy?: { isVpn?: boolean; isProxy?: boolean; isTor?: boolean } };
  dns?: { isLeak?: boolean; leakType?: string };
  webrtc?: { isLeak?: boolean };
}

interface ComparisonResult {
  scans: Array<{ id: string; timestamp: string; privacyScore?: number; riskLevel?: string }>;
  changes: string[];
  trends: {
    privacyScore?: {
      direction: 'improved' | 'declined' | 'stable';
      change: number;
      firstScore: number;
      lastScore: number;
    };
  };
}

/**
 * Create history routes
 */
export function createHistoryRoutes() {
  const router = new Hono<AppContext>();

  /**
   * GET /history
   * Get scan history for a visitor
   */
  router.get('/', async (c) => {
    try {
      const query = c.req.query();
      const parsed = getHistoryQuerySchema.safeParse(query);

      if (!parsed.success) {
        return c.json(
          {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid query parameters',
              details: parsed.error.format(),
            },
          },
          400
        );
      }

      const { visitorId, limit, offset } = parsed.data;
      const env = c.env as Env;

      // Query D1 for scan history
      const result = await env.DB.prepare(
        `SELECT id, visitor_id, scan_data, privacy_score, risk_level, created_at
         FROM scan_history
         WHERE visitor_id = ?
         ORDER BY created_at DESC
         LIMIT ? OFFSET ?`
      )
        .bind(visitorId, limit, offset)
        .all<ScanHistoryRow>();

      // Get total count
      const countResult = await env.DB.prepare(
        `SELECT COUNT(*) as count FROM scan_history WHERE visitor_id = ?`
      )
        .bind(visitorId)
        .first<{ count: number }>();

      const total = countResult?.count || 0;

      // Parse scan data
      const scans = (result.results || []).map((row) => ({
        id: row.id,
        timestamp: row.created_at,
        ...JSON.parse(row.scan_data),
      }));

      const response: APIResponse<{
        scans: StoredScan[];
        pagination: { total: number; limit: number; offset: number; hasMore: boolean };
      }> = {
        success: true,
        data: {
          scans,
          pagination: {
            total,
            limit,
            offset,
            hasMore: offset + limit < total,
          },
        },
      };

      return c.json(response);
    } catch (error) {
      console.error('History fetch error:', error);

      return c.json(
        {
          success: false,
          error: {
            code: 'HISTORY_FETCH_ERROR',
            message: error instanceof Error ? error.message : 'Failed to fetch history',
          },
        },
        500
      );
    }
  });

  /**
   * POST /history
   * Save a scan to history
   */
  router.post('/', zValidator('json', saveScanSchema), async (c) => {
    try {
      const { visitorId, scan } = c.req.valid('json');
      const env = c.env as Env;

      // Generate scan ID
      const scanId = `scan_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

      // Extract privacy score for indexing
      const privacyScore = scan.privacyScore?.total || null;
      const riskLevel = scan.privacyScore?.riskLevel || null;

      // Insert into D1
      await env.DB.prepare(
        `INSERT INTO scan_history (id, visitor_id, scan_data, privacy_score, risk_level, created_at)
         VALUES (?, ?, ?, ?, ?, datetime('now'))`
      )
        .bind(scanId, visitorId, JSON.stringify(scan), privacyScore, riskLevel)
        .run();

      // Cleanup old scans (keep only last 100 per visitor)
      await env.DB.prepare(
        `DELETE FROM scan_history
         WHERE visitor_id = ? AND id NOT IN (
           SELECT id FROM scan_history
           WHERE visitor_id = ?
           ORDER BY created_at DESC
           LIMIT 100
         )`
      )
        .bind(visitorId, visitorId)
        .run();

      const response: APIResponse<{ scanId: string; message: string }> = {
        success: true,
        data: {
          scanId,
          message: 'Scan saved to history',
        },
      };

      return c.json(response, 201);
    } catch (error) {
      console.error('History save error:', error);

      return c.json(
        {
          success: false,
          error: {
            code: 'HISTORY_SAVE_ERROR',
            message: error instanceof Error ? error.message : 'Failed to save to history',
          },
        },
        500
      );
    }
  });

  /**
   * POST /history/compare
   * Compare multiple scans
   */
  router.post('/compare', zValidator('json', compareSchema), async (c) => {
    try {
      const { scanIds } = c.req.valid('json');
      const env = c.env as Env;

      // Build query with placeholders for each scan ID
      const placeholders = scanIds.map(() => '?').join(',');
      const result = await env.DB.prepare(
        `SELECT id, scan_data, created_at
         FROM scan_history
         WHERE id IN (${placeholders})`
      )
        .bind(...scanIds)
        .all<{ id: string; scan_data: string; created_at: string }>();

      if (!result.results || result.results.length < 2) {
        return c.json(
          {
            success: false,
            error: {
              code: 'SCANS_NOT_FOUND',
              message: 'Could not find enough scans to compare',
            },
          },
          404
        );
      }

      // Parse scans
      const scans: StoredScan[] = result.results.map((row) => ({
        id: row.id,
        timestamp: row.created_at,
        ...JSON.parse(row.scan_data),
      }));

      // Generate comparison
      const comparison = generateComparison(scans);

      const response: APIResponse<ComparisonResult> = {
        success: true,
        data: comparison,
      };

      return c.json(response);
    } catch (error) {
      console.error('Comparison error:', error);

      return c.json(
        {
          success: false,
          error: {
            code: 'COMPARISON_ERROR',
            message: error instanceof Error ? error.message : 'Failed to compare scans',
          },
        },
        500
      );
    }
  });

  /**
   * GET /history/:scanId
   * Get a specific scan by ID
   */
  router.get('/:scanId', async (c) => {
    try {
      const { scanId } = c.req.param();
      const env = c.env as Env;

      const result = await env.DB.prepare(
        `SELECT id, scan_data, created_at
         FROM scan_history
         WHERE id = ?`
      )
        .bind(scanId)
        .first<{ id: string; scan_data: string; created_at: string }>();

      if (!result) {
        return c.json(
          {
            success: false,
            error: {
              code: 'SCAN_NOT_FOUND',
              message: 'Scan not found',
            },
          },
          404
        );
      }

      const scan: StoredScan = {
        id: result.id,
        timestamp: result.created_at,
        ...JSON.parse(result.scan_data),
      };

      const response: APIResponse<StoredScan> = {
        success: true,
        data: scan,
      };

      return c.json(response);
    } catch (error) {
      console.error('Scan fetch error:', error);

      return c.json(
        {
          success: false,
          error: {
            code: 'SCAN_FETCH_ERROR',
            message: error instanceof Error ? error.message : 'Failed to fetch scan',
          },
        },
        500
      );
    }
  });

  /**
   * DELETE /history/:scanId
   * Delete a scan from history
   */
  router.delete('/:scanId', async (c) => {
    try {
      const { scanId } = c.req.param();
      const visitorId = c.req.query('visitorId');
      const env = c.env as Env;

      if (!visitorId) {
        return c.json(
          {
            success: false,
            error: {
              code: 'INVALID_REQUEST',
              message: 'visitorId is required',
            },
          },
          400
        );
      }

      // Check if exists and belongs to visitor
      const existing = await env.DB.prepare(
        `SELECT id FROM scan_history WHERE id = ? AND visitor_id = ?`
      )
        .bind(scanId, visitorId)
        .first();

      if (!existing) {
        return c.json(
          {
            success: false,
            error: {
              code: 'SCAN_NOT_FOUND',
              message: 'Scan not found or does not belong to this visitor',
            },
          },
          404
        );
      }

      // Delete
      await env.DB.prepare(`DELETE FROM scan_history WHERE id = ? AND visitor_id = ?`)
        .bind(scanId, visitorId)
        .run();

      const response: APIResponse<{ message: string }> = {
        success: true,
        data: {
          message: 'Scan deleted from history',
        },
      };

      return c.json(response);
    } catch (error) {
      console.error('Scan delete error:', error);

      return c.json(
        {
          success: false,
          error: {
            code: 'SCAN_DELETE_ERROR',
            message: error instanceof Error ? error.message : 'Failed to delete scan',
          },
        },
        500
      );
    }
  });

  /**
   * DELETE /history
   * Clear all history for a visitor
   */
  router.delete('/', async (c) => {
    try {
      const visitorId = c.req.query('visitorId');
      const env = c.env as Env;

      if (!visitorId) {
        return c.json(
          {
            success: false,
            error: {
              code: 'INVALID_REQUEST',
              message: 'visitorId is required',
            },
          },
          400
        );
      }

      await env.DB.prepare(`DELETE FROM scan_history WHERE visitor_id = ?`).bind(visitorId).run();

      const response: APIResponse<{ message: string }> = {
        success: true,
        data: {
          message: 'History cleared',
        },
      };

      return c.json(response);
    } catch (error) {
      console.error('History clear error:', error);

      return c.json(
        {
          success: false,
          error: {
            code: 'HISTORY_CLEAR_ERROR',
            message: error instanceof Error ? error.message : 'Failed to clear history',
          },
        },
        500
      );
    }
  });

  return router;
}

// Helper functions

function generateComparison(scans: StoredScan[]): ComparisonResult {
  // Sort by timestamp
  const sortedScans = [...scans].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  const comparison: ComparisonResult = {
    scans: sortedScans.map((scan) => ({
      id: scan.id,
      timestamp: scan.timestamp,
      privacyScore: scan.privacyScore?.total,
      riskLevel: scan.privacyScore?.riskLevel,
    })),
    changes: [],
    trends: {},
  };

  // Compare privacy scores
  if (sortedScans.length >= 2) {
    const first = sortedScans[0];
    const last = sortedScans[sortedScans.length - 1];

    const scoreDiff = (last.privacyScore?.total || 0) - (first.privacyScore?.total || 0);

    comparison.trends.privacyScore = {
      direction: scoreDiff > 0 ? 'improved' : scoreDiff < 0 ? 'declined' : 'stable',
      change: scoreDiff,
      firstScore: first.privacyScore?.total || 0,
      lastScore: last.privacyScore?.total || 0,
    };

    // Detect specific changes
    const changes: string[] = [];

    // IP changes
    if (first.ip?.address !== last.ip?.address) {
      changes.push(
        `IP changed from ${first.ip?.address || 'unknown'} to ${last.ip?.address || 'unknown'}`
      );
    }

    // VPN status changes
    if (first.ip?.privacy?.isVpn !== last.ip?.privacy?.isVpn) {
      if (last.ip?.privacy?.isVpn) {
        changes.push('VPN enabled');
      } else {
        changes.push('VPN disabled');
      }
    }

    // Fingerprint uniqueness changes
    const firstUniqueness = first.fingerprint?.uniquenessScore || 0;
    const lastUniqueness = last.fingerprint?.uniquenessScore || 0;
    const uniquenessDiff = lastUniqueness - firstUniqueness;

    if (Math.abs(uniquenessDiff) > 0.1) {
      if (uniquenessDiff > 0) {
        changes.push(`Fingerprint uniqueness increased by ${Math.round(uniquenessDiff * 100)}%`);
      } else {
        changes.push(
          `Fingerprint uniqueness decreased by ${Math.round(Math.abs(uniquenessDiff) * 100)}%`
        );
      }
    }

    // DNS leak changes
    if (first.dns?.isLeak !== last.dns?.isLeak) {
      if (last.dns?.isLeak) {
        changes.push('DNS leak detected');
      } else {
        changes.push('DNS leak fixed');
      }
    }

    // WebRTC leak changes
    if (first.webrtc?.isLeak !== last.webrtc?.isLeak) {
      if (last.webrtc?.isLeak) {
        changes.push('WebRTC leak detected');
      } else {
        changes.push('WebRTC leak fixed');
      }
    }

    comparison.changes = changes;
  }

  return comparison;
}
