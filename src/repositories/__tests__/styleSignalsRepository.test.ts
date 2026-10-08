import { describe, it, expect, beforeEach } from 'vitest';
import { LocalStorageStyleSignalsRepository } from '../LocalStorageStyleSignalsRepository';
import { StyleSignalEvent } from '../../types';

describe('LocalStorageStyleSignalsRepository', () => {
  let repo: LocalStorageStyleSignalsRepository;

  beforeEach(async () => {
    repo = new LocalStorageStyleSignalsRepository();
    await repo.clear();
  });

  it('returns empty array on fresh repository', async () => {
    const signals = await repo.getSignals();
    expect(signals).toEqual([]);
  });

  it('adds and retrieves a behavioral style signal', async () => {
    const signal: StyleSignalEvent = {
      id: 'sig-101',
      userId: 'user-test',
      signalType: 'worn',
      itemIds: ['item-1', 'item-2'],
      occasion: 'college',
      season: 'summer',
      createdAt: 1700000000000,
    };

    await repo.addSignal(signal);
    const stored = await repo.getSignals();
    expect(stored.length).toBe(1);
    expect(stored[0]).toEqual(signal);
  });

  it('enforces idempotency: adding the same signal ID twice does NOT create duplicates', async () => {
    const signal: StyleSignalEvent = {
      id: 'sig-dup',
      userId: 'user-test',
      signalType: 'saved',
      itemIds: ['item-1'],
      createdAt: 1700000000000,
    };

    await repo.addSignal(signal);
    await repo.addSignal(signal);
    await repo.addSignal(signal);

    const stored = await repo.getSignals();
    expect(stored.length).toBe(1);
  });

  it('adds batch signals idempotently', async () => {
    const s1: StyleSignalEvent = {
      id: 's-batch-1',
      userId: 'user-test',
      signalType: 'worn',
      itemIds: ['item-1'],
      createdAt: 1700000000000,
    };
    const s2: StyleSignalEvent = {
      id: 's-batch-2',
      userId: 'user-test',
      signalType: 'skipped',
      itemIds: ['item-2'],
      createdAt: 1700000001000,
    };

    await repo.addSignal(s1);
    await repo.addSignals([s1, s2]);

    const stored = await repo.getSignals();
    expect(stored.length).toBe(2);
    expect(stored.map((s) => s.id)).toEqual(['s-batch-1', 's-batch-2']);
  });

  it('filters signals for a specific wardrobe item ID', async () => {
    const s1: StyleSignalEvent = {
      id: 's-filt-1',
      userId: 'user-test',
      signalType: 'worn',
      itemIds: ['item-alpha', 'item-beta'],
      createdAt: 1700000000000,
    };
    const s2: StyleSignalEvent = {
      id: 's-filt-2',
      userId: 'user-test',
      signalType: 'rejected',
      itemIds: ['item-gamma'],
      rejectionReason: 'too_hot',
      createdAt: 1700000001000,
    };

    await repo.addSignals([s1, s2]);

    const forAlpha = await repo.getSignalsForItem('item-alpha');
    expect(forAlpha.length).toBe(1);
    expect(forAlpha[0].id).toBe('s-filt-1');

    const forGamma = await repo.getSignalsForItem('item-gamma');
    expect(forGamma.length).toBe(1);
    expect(forGamma[0].id).toBe('s-filt-2');

    const forNone = await repo.getSignalsForItem('item-nonexistent');
    expect(forNone).toEqual([]);
  });

  it('clears all signals cleanly', async () => {
    await repo.addSignal({
      id: 's-clear',
      userId: 'u',
      signalType: 'viewed',
      itemIds: ['1'],
      createdAt: 1700000000000,
    });
    expect((await repo.getSignals()).length).toBe(1);

    await repo.clear();
    expect((await repo.getSignals()).length).toBe(0);
  });
});
