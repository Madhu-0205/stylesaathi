import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { NeedleCommandBar } from '../NeedleCommandBar';

// Mock useNeedle hook
vi.mock('../../../services/needle/useNeedle', () => ({
  useNeedle: () => ({
    state: {
      modelStatus: 'ready',
      serviceStatus: 'ready',
      downloadProgress: 100,
      lastQuery: null,
      lastResult: null,
      pendingConfirmation: null,
      error: null,
    },
    initialize: vi.fn(),
    execute: vi.fn(),
    confirm: vi.fn(),
    cancel: vi.fn(),
  }),
}));

describe('NeedleCommandBar', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders desktop trigger with ⌘K badge and mobile floating pill', () => {
    const html = renderToString(<NeedleCommandBar />);

    expect(html).toContain('Ask Stylist…');
    expect(html).toContain('⌘K');
    expect(html).toContain('Stylist');
  });
});
