/**
 * StyleSaathi BackButtonManager
 * 
 * Provides a decoupled, priority-based stack for Android hardware/gesture back buttons
 * and browser popstate navigation.
 * 
 * Hierarchy:
 * 1. Command Palette (Needle) [Priority 100]
 * 2. AI Saathi Drawer         [Priority 90]
 * 3. Add Item Sheet           [Priority 80]
 * 4. Screen-specific modals   [Priority 70]
 * 5. Screen sub-navigation    [Priority 60]
 * 6. Primary tab navigation   [Priority 50]
 * 7. Application root exit    [Priority 10]
 */

export const BackButtonPriority = {
  COMMAND_PALETTE: 100,
  AI_SAATHI: 90,
  GLOBAL_SHEET: 80,
  SCREEN_MODAL: 70,
  SUB_NAVIGATION: 60,
  PRIMARY_TAB: 50,
  ROOT_EXIT: 10,
} as const;

export type BackButtonHandler = () => boolean | Promise<boolean>;

interface RegisteredEntry {
  id: string;
  priority: number;
  handler: BackButtonHandler;
  label?: string;
}

export class BackButtonManager {
  private handlers: RegisteredEntry[] = [];
  private onRootExitCallback?: () => void;
  private isProcessing = false;

  /**
   * Registers a back-button consumer at a specific priority tier.
   * Returns an unregister function.
   */
  public register(
    priority: number,
    handler: BackButtonHandler,
    label?: string
  ): () => void {
    const id = `handler_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    this.handlers.push({ id, priority, handler, label });
    // Sort descending: highest priority first
    this.handlers.sort((a, b) => b.priority - a.priority);

    return () => {
      this.handlers = this.handlers.filter((h) => h.id !== id);
    };
  }

  /**
   * Registers an exit/minimize callback invoked only when all priority tiers pass.
   */
  public setRootExitHandler(callback: () => void): () => void {
    this.onRootExitCallback = callback;
    return () => {
      if (this.onRootExitCallback === callback) {
        this.onRootExitCallback = undefined;
      }
    };
  }

  /**
   * Dispatches a back event down the priority stack.
   * Resolves to true if handled, or false if reached root.
   */
  public async handleBack(): Promise<boolean> {
    if (this.isProcessing) return true;
    this.isProcessing = true;

    try {
      // Iterate through registered handlers in descending priority order
      for (const entry of this.handlers) {
        try {
          const handled = await entry.handler();
          if (handled) {
            return true;
          }
        } catch (err) {
          console.error(`BackButtonManager error in handler '${entry.label || entry.id}':`, err);
        }
      }

      // No overlay or secondary state consumed the back event -> invoke root exit
      if (this.onRootExitCallback) {
        this.onRootExitCallback();
        return true;
      }

      return false;
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Helper for tests to inspect registered handler count
   */
  public getRegisteredCount(): number {
    return this.handlers.length;
  }

  /**
   * Clears all registered handlers
   */
  public clear(): void {
    this.handlers = [];
    this.onRootExitCallback = undefined;
    this.isProcessing = false;
  }
}

export const backButtonManager = new BackButtonManager();
