import React from 'react';
import { WardrobeProvider, useWardrobeContext } from './WardrobeContext';
import { WardrobeItem } from '../types';

export { WardrobeProvider, useWardrobeContext };

// Backward-compatible AppProvider and useApp aliases
export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <WardrobeProvider>{children}</WardrobeProvider>;
};

export const useApp = () => {
  const ctx = useWardrobeContext();
  return {
    ...ctx,
    reset: ctx.resetAll,
    styles: ctx.styleVibes,
    setStyles: (action: any) => {
      if (typeof action === 'function') {
        ctx.setStyleVibes(action(ctx.styleVibes));
      } else {
        ctx.setStyleVibes(action);
      }
    },
    updateItem: (idOrItem: string | WardrobeItem, patch?: Partial<WardrobeItem>) => {
      if (typeof idOrItem === 'string') {
        return ctx.updateItem(idOrItem, patch || {});
      } else {
        return ctx.updateItem(idOrItem.id, idOrItem);
      }
    },
  };
};
