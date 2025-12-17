import { Router } from 'express';
import { NetworkInsightsService } from '../services/NetworkInsightsService';
import type { APIResponse } from '@browserleaks/types';
import { log } from '../middleware/logger';
import { getErrorMessage } from '../utils/errors';

const router = Router();
const networkInsightsService = new NetworkInsightsService();

router.get('/network/insights', async (req, res) => {
  try {
    const useMock = req.query.mock === 'true';
    const data = useMock
      ? networkInsightsService.getMockInsights()
      : await networkInsightsService.getInsights();

    const response: APIResponse<typeof data> = {
      success: true,
      data,
    };

    res.json(response);
  } catch (error: unknown) {
    log.error('Network insights error', { error });
    res.status(500).json({
      success: false,
      error: {
        code: 'NETWORK_INSIGHTS_ERROR',
        message: getErrorMessage(error) || 'Failed to load network insights',
      },
    });
  }
});

export default router;
