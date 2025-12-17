/**
 * Share Link Routes (Hono Worker)
 *
 * Endpoints for creating and accessing shared scan reports.
 * Uses D1 database for persistent storage instead of in-memory Map.
 *
 * POST /v1/share - Create a share link
 * GET /v1/share/:code - Get shared scan by code
 * DELETE /v1/share/:code - Delete a share link
 * GET /v1/share/:code/stats - Get share link statistics
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { AppContext, Env } from '../types/env';
import type {
  APIResponse,
  SharedScan,
  SharedScanResponse,
  ShareLinkOptions,
  ShareLinkResponse,
} from '@browserleaks/types';

// Validation schemas
const privacyScoreSchema = z.object({
  total: z.number().min(0).max(100),
  riskLevel: z.enum(['low', 'medium', 'high', 'critical']),
  breakdown: z.object({
    ipPrivacy: z.number().min(0).max(20),
    dnsPrivacy: z.number().min(0).max(20),
    webrtcPrivacy: z.number().min(0).max(20),
    fingerprintResistance: z.number().min(0).max(30),
    browserConfig: z.number().min(0).max(20),
  }),
});

const shareScanSchema = z.object({
  id: z.string(),
  timestamp: z.string(),
  privacyScore: privacyScoreSchema,
  fingerprint: z
    .object({
      combinedHash: z.string(),
      uniquenessScore: z.number().min(0).max(1),
    })
    .optional(),
  ip: z
    .object({
      address: z.string().optional(),
      country: z.string().optional(),
      city: z.string().optional(),
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
      isLeak: z.boolean(),
      leakType: z.string(),
    })
    .optional(),
  webrtc: z
    .object({
      isLeak: z.boolean(),
    })
    .optional(),
  recommendations: z.array(z.string()).optional(),
});

const shareOptionsSchema = z.object({
  expiresIn: z.number().int().min(3600).max(2_592_000).optional(), // 1 hour to 30 days
  maxViews: z.number().int().min(1).max(1000).optional(),
  hideIP: z.boolean().optional(),
});

const createShareSchema = z.object({
  scan: shareScanSchema,
  options: shareOptionsSchema.optional(),
});

// Database row type
interface ShareLinkRow {
  id: string;
  code: string;
  scan_data: string; // JSON string
  expires_at: string | null;
  view_count: number;
  max_views: number | null;
  created_at: string;
}

/**
 * Create share link routes
 */
export function createShareRoutes() {
  const router = new Hono<AppContext>();

  /**
   * POST /share
   * Create a share link for a scan
   */
  router.post('/', zValidator('json', createShareSchema), async (c) => {
    try {
      const { scan, options } = c.req.valid('json');
      const env = c.env as Env;

      // Generate unique share code
      const code = generateShareCode();

      // Process scan data for sharing (optionally hide sensitive info)
      const shareScan = prepareScanForSharing(scan as SharedScan, options?.hideIP);

      // Calculate expiration
      const expiresAt = options?.expiresIn
        ? new Date(Date.now() + options.expiresIn * 1000)
        : null;

      // Store in D1 database
      const id = generateId();
      await env.DB.prepare(
        `INSERT INTO share_links (id, code, scan_data, expires_at, view_count, max_views, created_at)
         VALUES (?, ?, ?, ?, 0, ?, datetime('now'))`
      )
        .bind(
          id,
          code,
          JSON.stringify(shareScan),
          expiresAt?.toISOString() || null,
          options?.maxViews || null
        )
        .run();

      // Generate share URL
      const frontendUrl = env.CORS_ORIGIN || 'https://browserleaks.io';
      const shareUrl = `${frontendUrl}/share/${code}`;

      const response: APIResponse<ShareLinkResponse> = {
        success: true,
        data: {
          code,
          url: shareUrl,
          expiresAt: expiresAt?.toISOString() || null,
          maxViews: options?.maxViews || null,
        },
      };

      return c.json(response, 201);
    } catch (error) {
      console.error('Share link creation error:', error);

      const response: APIResponse = {
        success: false,
        error: {
          code: 'SHARE_CREATE_ERROR',
          message: error instanceof Error ? error.message : 'Failed to create share link',
        },
      };

      return c.json(response, 500);
    }
  });

  /**
   * GET /share/:code
   * Get shared scan by code
   */
  router.get('/:code', async (c) => {
    try {
      const { code } = c.req.param();
      const env = c.env as Env;

      // Fetch from D1
      const result = await env.DB.prepare(
        `SELECT id, code, scan_data, expires_at, view_count, max_views, created_at
         FROM share_links WHERE code = ?`
      )
        .bind(code)
        .first<ShareLinkRow>();

      if (!result) {
        return c.json(
          {
            success: false,
            error: {
              code: 'SHARE_NOT_FOUND',
              message: 'Share link not found or has been deleted',
            },
          },
          404
        );
      }

      // Check expiration
      if (result.expires_at && new Date(result.expires_at) < new Date()) {
        // Delete expired link
        await env.DB.prepare('DELETE FROM share_links WHERE code = ?').bind(code).run();

        return c.json(
          {
            success: false,
            error: {
              code: 'SHARE_EXPIRED',
              message: 'This share link has expired',
            },
          },
          410
        );
      }

      // Check max views
      if (result.max_views && result.view_count >= result.max_views) {
        return c.json(
          {
            success: false,
            error: {
              code: 'SHARE_MAX_VIEWS',
              message: 'This share link has reached its maximum number of views',
            },
          },
          410
        );
      }

      // Increment view count
      const newViewCount = result.view_count + 1;
      await env.DB.prepare('UPDATE share_links SET view_count = ? WHERE code = ?')
        .bind(newViewCount, code)
        .run();

      // Parse scan data
      const scan = JSON.parse(result.scan_data) as SharedScan;

      const response: APIResponse<SharedScanResponse> = {
        success: true,
        data: {
          scan,
          createdAt: result.created_at,
          viewCount: newViewCount,
          remainingViews: result.max_views ? result.max_views - newViewCount : null,
          expiresAt: result.expires_at,
        },
      };

      return c.json(response);
    } catch (error) {
      console.error('Share fetch error:', error);

      const response: APIResponse = {
        success: false,
        error: {
          code: 'SHARE_FETCH_ERROR',
          message: error instanceof Error ? error.message : 'Failed to fetch shared scan',
        },
      };

      return c.json(response, 500);
    }
  });

  /**
   * DELETE /share/:code
   * Delete a share link
   */
  router.delete('/:code', async (c) => {
    try {
      const { code } = c.req.param();
      const env = c.env as Env;

      // Check if exists
      const result = await env.DB.prepare('SELECT id FROM share_links WHERE code = ?')
        .bind(code)
        .first();

      if (!result) {
        return c.json(
          {
            success: false,
            error: {
              code: 'SHARE_NOT_FOUND',
              message: 'Share link not found',
            },
          },
          404
        );
      }

      // Delete
      await env.DB.prepare('DELETE FROM share_links WHERE code = ?').bind(code).run();

      const response: APIResponse<{ message: string }> = {
        success: true,
        data: {
          message: 'Share link deleted',
        },
      };

      return c.json(response);
    } catch (error) {
      console.error('Share delete error:', error);

      const response: APIResponse = {
        success: false,
        error: {
          code: 'SHARE_DELETE_ERROR',
          message: error instanceof Error ? error.message : 'Failed to delete share link',
        },
      };

      return c.json(response, 500);
    }
  });

  /**
   * GET /share/:code/stats
   * Get share link statistics
   */
  router.get('/:code/stats', async (c) => {
    try {
      const { code } = c.req.param();
      const env = c.env as Env;

      const result = await env.DB.prepare(
        `SELECT code, expires_at, view_count, max_views, created_at
         FROM share_links WHERE code = ?`
      )
        .bind(code)
        .first<ShareLinkRow>();

      if (!result) {
        return c.json(
          {
            success: false,
            error: {
              code: 'SHARE_NOT_FOUND',
              message: 'Share link not found',
            },
          },
          404
        );
      }

      const isExpired = result.expires_at ? new Date(result.expires_at) < new Date() : false;
      const isMaxViews = result.max_views ? result.view_count >= result.max_views : false;

      const response: APIResponse<{
        code: string;
        createdAt: string;
        expiresAt: string | null;
        viewCount: number;
        maxViews: number | null;
        isExpired: boolean;
        isMaxViews: boolean;
      }> = {
        success: true,
        data: {
          code,
          createdAt: result.created_at,
          expiresAt: result.expires_at,
          viewCount: result.view_count,
          maxViews: result.max_views,
          isExpired,
          isMaxViews,
        },
      };

      return c.json(response);
    } catch (error) {
      console.error('Share stats error:', error);

      const response: APIResponse = {
        success: false,
        error: {
          code: 'SHARE_STATS_ERROR',
          message: error instanceof Error ? error.message : 'Failed to get share statistics',
        },
      };

      return c.json(response, 500);
    }
  });

  return router;
}

// Helper functions

function generateId(): string {
  return `sl_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 10)}`;
}

function generateShareCode(): string {
  // Generate a URL-safe, unique code
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `${timestamp}-${random}`;
}

function prepareScanForSharing(scan: SharedScan, hideIP = false): SharedScan {
  const shareScan: SharedScan = { ...scan };

  // Hide sensitive IP information if requested
  if (hideIP && shareScan.ip) {
    shareScan.ip = {
      ...shareScan.ip,
      address: maskIP(shareScan.ip.address || ''),
    };
  }

  // Add share metadata
  shareScan.shared = {
    createdAt: new Date().toISOString(),
    isShared: true,
  };

  return shareScan;
}

function maskIP(ip: string): string {
  if (!ip) return 'hidden';

  // IPv4
  if (ip.includes('.')) {
    const parts = ip.split('.');
    return `${parts[0]}.${parts[1]}.*.*`;
  }

  // IPv6
  if (ip.includes(':')) {
    const parts = ip.split(':');
    return `${parts[0]}:${parts[1]}:****:****`;
  }

  return 'hidden';
}
