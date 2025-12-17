/**
 * AI Chat Routes for OpenRouter integration
 *
 * Security: API key stored in Wrangler secrets (not in code)
 */

import { Hono } from 'hono';
import type { AppContext } from '../types/env';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

const chatRequestSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(['system', 'user', 'assistant']),
    content: z.string(),
  })).min(1),
  model: z.string().optional(),
});

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_MODEL = 'google/gemini-2.0-flash-exp:free';

export function createAIChatRoutes() {
  const app = new Hono<AppContext>();

  app.post('/ai/chat', zValidator('json', chatRequestSchema), async (c) => {
    const env = c.env;
    const { messages, model = DEFAULT_MODEL } = c.req.valid('json');

    // Get API key from environment
    const apiKey = env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return c.json(
        {
          success: false,
          error: {
            code: 'CONFIG_ERROR',
            message: 'OpenRouter API key not configured',
          },
        },
        500
      );
    }

    // Add system prompt
    const systemPrompt = {
      role: 'system' as const,
      content: `You are an AI assistant specialized in browser privacy, security, and fingerprinting.

You help users understand:
- IP leaks and VPN/Proxy detection
- DNS leak vulnerabilities
- WebRTC leak risks
- Browser fingerprinting techniques (Canvas, WebGL, Audio, Fonts)
- Privacy scoring and recommendations
- How to improve their online privacy

Be concise, technical when needed, but explain complex concepts clearly.
Provide actionable recommendations.`,
    };

    const finalMessages = [systemPrompt, ...messages];

    try {
      // Call OpenRouter API
      const response = await fetch(OPENROUTER_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://browserleaks.io',
          'X-Title': 'BrowserLeaks.io',
        },
        body: JSON.stringify({
          model,
          messages: finalMessages,
          temperature: 0.7,
          max_tokens: 2048,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('OpenRouter API error:', errorText);

        return c.json(
          {
            success: false,
            error: {
              code: 'AI_SERVICE_ERROR',
              message: 'AI service unavailable',
              details: response.statusText,
            },
          },
          response.status
        );
      }

      const data = await response.json();

      return c.json({
        success: true,
        data: {
          message: data.choices[0].message.content,
          model: data.model,
          usage: data.usage,
        },
      });

    } catch (error) {
      console.error('AI chat error:', error);
      return c.json(
        {
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Internal server error',
          },
        },
        500
      );
    }
  });

  return app;
}
