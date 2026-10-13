// @vitest-environment jsdom
import React, { act } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { AppErrorBoundary } from '../AppErrorBoundary';

const BombComponent: React.FC<{ shouldThrow: boolean }> = ({ shouldThrow }) => {
  if (shouldThrow) {
    throw new Error('Explosive test render failure');
  }
  return <div>Safe Child Component</div>;
};

describe('AppErrorBoundary', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('renders children normally when there is no error state', () => {
    const html = renderToString(
      <AppErrorBoundary>
        <BombComponent shouldThrow={false} />
      </AppErrorBoundary>
    );

    expect(html).toContain('Safe Child Component');
  });

  it('derives error state and renders editorial recovery UI without exposing stack trace', () => {
    const errorState = AppErrorBoundary.getDerivedStateFromError(new Error('Fatal render error'));
    expect(errorState.hasError).toBe(true);
    expect(errorState.error?.message).toBe('Fatal render error');

    const boundary = new AppErrorBoundary({ children: <div>child</div> });
    boundary.state = { hasError: true, error: new Error('Sensitive internal memory dump') };

    const rendered = boundary.render();
    const html = renderToString(rendered as React.ReactElement);

    expect(html).toContain('A wardrobe moment caught us');
    expect(html).toContain('Your saved wardrobe, plans, and preferences remain safe');
    expect(html).toContain('Try Again');
    expect(html).toContain('Restart StyleSaathi');

    // Never leak technical message to users
    expect(html).not.toContain('Sensitive internal memory dump');
  });

  it('catches render errors in real DOM and allows user to trigger Try Again reset', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    const onResetMock = vi.fn();

    await act(async () => {
      root.render(
        <AppErrorBoundary onReset={onResetMock}>
          <BombComponent shouldThrow={true} />
        </AppErrorBoundary>
      );
    });

    expect(container.textContent).toContain('A wardrobe moment caught us');

    // Find and click the Try Again button
    const buttons = container.querySelectorAll('button');
    const tryAgainBtn = Array.from(buttons).find((b) => b.textContent?.includes('Try Again'));
    expect(tryAgainBtn).toBeDefined();

    await act(async () => {
      tryAgainBtn?.click();
    });

    expect(onResetMock).toHaveBeenCalledTimes(1);

    root.unmount();
    container.remove();
  });
});
