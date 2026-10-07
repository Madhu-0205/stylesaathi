import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  handleNeedleWorkerMessage,
  resetWorkerState,
  getWorkerCurrentStatus,
} from '../needleWorker';
import { NeedleWorkerOutboundMessage } from '../needleTypes';
import { NEEDLE_TOOLS_JSON } from '../needleSchemas';
import { setCachedModel, clearCachedModel } from '../needleModelCache';

describe('needleWorker', () => {
  beforeEach(async () => {
    resetWorkerState();
    await clearCachedModel();
    vi.restoreAllMocks();
  });

  it('reports initial status via GET_STATUS', async () => {
    const outbound: NeedleWorkerOutboundMessage[] = [];
    const post = (msg: NeedleWorkerOutboundMessage) => outbound.push(msg);

    await handleNeedleWorkerMessage({ type: 'GET_STATUS' }, post);

    expect(outbound.length).toBe(1);
    expect(outbound[0].type).toBe('STATUS_UPDATE');
    if (outbound[0].type === 'STATUS_UPDATE') {
      expect(outbound[0].payload.status).toBe('uninitialized');
    }
  });

  it('initializes model from cache and reaches ready status', async () => {
    // Cache a dummy buffer
    const dummyBuffer = new Uint8Array([67, 65, 67, 84, 1, 2, 3]).buffer;
    await setCachedModel(dummyBuffer);

    const outbound: NeedleWorkerOutboundMessage[] = [];
    const post = (msg: NeedleWorkerOutboundMessage) => outbound.push(msg);

    await handleNeedleWorkerMessage({ type: 'INIT_MODEL' }, post);

    const statusUpdates = outbound.filter((m) => m.type === 'STATUS_UPDATE');
    expect(statusUpdates.length).toBeGreaterThan(0);
    const lastStatus = statusUpdates[statusUpdates.length - 1];
    if (lastStatus.type === 'STATUS_UPDATE') {
      expect(lastStatus.payload.status).toBe('ready');
    }
    expect(getWorkerCurrentStatus()).toBe('ready');
  }, 15000);

  it('runs inference for "Show me something casual for college."', async () => {
    const dummyBuffer = new Uint8Array([67, 65, 67, 84, 1, 2, 3]).buffer;
    await setCachedModel(dummyBuffer);

    const outbound: NeedleWorkerOutboundMessage[] = [];
    const post = (msg: NeedleWorkerOutboundMessage) => outbound.push(msg);

    await handleNeedleWorkerMessage({ type: 'INIT_MODEL' }, post);
    outbound.length = 0;

    await handleNeedleWorkerMessage(
      {
        type: 'INFER',
        payload: {
          id: 'query-1',
          query: 'Show me something casual for college.',
          toolsJson: NEEDLE_TOOLS_JSON,
        },
      },
      post
    );

    expect(outbound.length).toBe(1);
    expect(outbound[0].type).toBe('INFER_RESULT');
    if (outbound[0].type === 'INFER_RESULT') {
      expect(outbound[0].payload.id).toBe('query-1');
      expect(outbound[0].payload.success).toBe(true);
      expect(outbound[0].payload.toolCall?.name).toBe('recommend_outfit');
      expect(outbound[0].payload.toolCall?.arguments.occasion).toBe('college');
      expect(outbound[0].payload.toolCall?.arguments.style).toBe('casual');
      expect(outbound[0].payload.confidence).toBeGreaterThanOrEqual(0.8);
    }
  });

  it('runs inference for wardrobe search "Find my black jeans"', async () => {
    const outbound: NeedleWorkerOutboundMessage[] = [];
    const post = (msg: NeedleWorkerOutboundMessage) => outbound.push(msg);

    await handleNeedleWorkerMessage(
      {
        type: 'INFER',
        payload: {
          id: 'query-2',
          query: 'Find my black jeans',
          toolsJson: NEEDLE_TOOLS_JSON,
        },
      },
      post
    );

    const inferResult = outbound.find((m) => m.type === 'INFER_RESULT');
    expect(inferResult).toBeDefined();
    if (inferResult && inferResult.type === 'INFER_RESULT') {
      expect(inferResult.payload.toolCall?.name).toBe('search_wardrobe');
      expect(inferResult.payload.toolCall?.arguments.color).toBe('black');
      expect(inferResult.payload.toolCall?.arguments.subcategory).toBe('jeans');
      expect(inferResult.payload.confidence).toBeGreaterThanOrEqual(0.8);
    }
  });

  it('runs inference for recording wear "I wore my blue kurta today"', async () => {
    const outbound: NeedleWorkerOutboundMessage[] = [];
    const post = (msg: NeedleWorkerOutboundMessage) => outbound.push(msg);

    await handleNeedleWorkerMessage(
      {
        type: 'INFER',
        payload: {
          id: 'query-3',
          query: 'I wore my blue kurta today',
          toolsJson: NEEDLE_TOOLS_JSON,
        },
      },
      post
    );

    const inferResult = outbound.find((m) => m.type === 'INFER_RESULT');
    expect(inferResult).toBeDefined();
    if (inferResult && inferResult.type === 'INFER_RESULT') {
      expect(inferResult.payload.toolCall?.name).toBe('record_wear');
      expect(inferResult.payload.toolCall?.arguments.itemName).toBe('blue kurta');
      expect(inferResult.payload.confidence).toBeGreaterThanOrEqual(0.8);
    }
  });

  it('assigns medium confidence to ambiguous styling queries', async () => {
    const outbound: NeedleWorkerOutboundMessage[] = [];
    const post = (msg: NeedleWorkerOutboundMessage) => outbound.push(msg);

    await handleNeedleWorkerMessage(
      {
        type: 'INFER',
        payload: {
          id: 'query-4',
          query: 'maybe something nice for later',
          toolsJson: NEEDLE_TOOLS_JSON,
        },
      },
      post
    );

    const inferResult = outbound.find((m) => m.type === 'INFER_RESULT');
    expect(inferResult).toBeDefined();
    if (inferResult && inferResult.type === 'INFER_RESULT') {
      expect(inferResult.payload.confidence).toBeGreaterThanOrEqual(0.5);
      expect(inferResult.payload.confidence).toBeLessThan(0.8);
    }
  });

  it('assigns low confidence to unrecognized queries', async () => {
    const outbound: NeedleWorkerOutboundMessage[] = [];
    const post = (msg: NeedleWorkerOutboundMessage) => outbound.push(msg);

    await handleNeedleWorkerMessage(
      {
        type: 'INFER',
        payload: {
          id: 'query-5',
          query: 'xyzzy 1234 foobar quantum rocket',
          toolsJson: NEEDLE_TOOLS_JSON,
        },
      },
      post
    );

    const inferResult = outbound.find((m) => m.type === 'INFER_RESULT');
    expect(inferResult).toBeDefined();
    if (inferResult && inferResult.type === 'INFER_RESULT') {
      expect(inferResult.payload.confidence).toBeLessThan(0.5);
    }
  });
});
