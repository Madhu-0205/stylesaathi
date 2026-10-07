import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { NeedleConfirmationModal } from '../NeedleConfirmationModal';
import { PendingAction } from '../../../services/needle/needleTypes';

describe('NeedleConfirmationModal', () => {
  it('renders nothing when pendingAction is null', () => {
    const html = renderToString(
      <NeedleConfirmationModal
        pendingAction={null}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(html).toBe('');
  });

  it('renders modal with action details and parameters', () => {
    const action: PendingAction = {
      id: 'action-123',
      query: 'Show me something casual for college.',
      explanation: 'Recommend an outfit for college in casual style.',
      createdAt: Date.now(),
      toolCall: {
        id: 'call-1',
        name: 'recommend_outfit',
        arguments: { occasion: 'college', style: 'casual' },
        confidence: 0.68,
        confidenceLevel: 'MEDIUM',
        isDestructive: false,
        requiresConfirmation: true,
        explanation: 'Recommend an outfit for college in casual style.',
      },
    };

    const html = renderToString(
      <NeedleConfirmationModal
        pendingAction={action}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(html).toContain('Action Confirmation');
    expect(html).toContain('Show me something casual for college.');
    expect(html).toContain('Recommend an outfit for college in casual style.');
    expect(html).toContain('Confidence:');
    expect(html).toContain('68');
    expect(html).toContain('recommend_outfit');
    expect(html).toContain('occasion');
    expect(html).toContain('college');
    expect(html).toContain('Confirm &amp; Execute');
    expect(html).toContain('Cancel &amp; Dismiss');
  });

  it('displays destructive action guard when isDestructive is true', () => {
    const destructiveAction: PendingAction = {
      id: 'action-456',
      query: 'delete my entire wardrobe',
      explanation: 'Search wardrobe items with delete guard.',
      createdAt: Date.now(),
      toolCall: {
        id: 'call-2',
        name: 'search_wardrobe',
        arguments: {},
        confidence: 0.95,
        confidenceLevel: 'HIGH',
        isDestructive: true,
        requiresConfirmation: true,
        explanation: 'Search wardrobe items with delete guard.',
      },
    };

    const html = renderToString(
      <NeedleConfirmationModal
        pendingAction={destructiveAction}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(html).toContain('Confirm Destructive Action');
    expect(html).toContain('Destructive Mutation Guard');
  });
});
