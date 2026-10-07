import {
  NeedleState,
  NeedleExecutionResult,
  NeedleWorkerInboundMessage,
  NeedleWorkerOutboundMessage,
  PendingAction,
  ValidatedToolCall,
} from './needleTypes';
import { NEEDLE_TOOLS_JSON } from './needleSchemas';
import { validateAndNormalizeToolCall } from './needleTools';
import { handleNeedleWorkerMessage } from './needleWorker';
import {
  WardrobeItem,
  StylePreferences,
  OutfitPlan,
  GeneratedOutfit,
  Season,
} from '../../types';
import { generateOutfits } from '../../engine/outfitEngine';

export interface NeedleDomainContext {
  items: WardrobeItem[];
  preferences?: StylePreferences;
  plans?: OutfitPlan[];
  savePlan?: (
    plan: Omit<OutfitPlan, 'id' | 'createdAt' | 'updatedAt'> | OutfitPlan
  ) => Promise<OutfitPlan>;
  updateItem?: (id: string, patch: Partial<WardrobeItem>) => Promise<void>;
  markOutfitWornOnDate?: (
    outfit: GeneratedOutfit,
    dateStr: string,
    accessory?: WardrobeItem | null
  ) => Promise<void>;
}

export class NeedleService {
  private state: NeedleState = {
    modelStatus: 'uninitialized',
    serviceStatus: 'idle',
    downloadProgress: 0,
    lastQuery: null,
    lastResult: null,
    pendingConfirmation: null,
    error: null,
  };

  private listeners = new Set<(state: NeedleState) => void>();
  private worker: Worker | null = null;
  private pendingInferResolvers = new Map<
    string,
    (msg: Extract<NeedleWorkerOutboundMessage, { type: 'INFER_RESULT' }>) => void
  >();

  constructor() {
    this.setupWorker();
  }

  private setupWorker(): void {
    if (typeof window !== 'undefined' && typeof window.Worker !== 'undefined') {
      try {
        this.worker = new Worker(new URL('./needleWorker.ts', import.meta.url), {
          type: 'module',
        });
        this.worker.onmessage = (event: MessageEvent<NeedleWorkerOutboundMessage>) => {
          this.handleOutboundMessage(event.data);
        };
        this.worker.onerror = (err) => {
          console.warn('[NeedleService] Web Worker error, falling back to direct mode:', err);
          this.worker = null;
        };
      } catch (err) {
        console.warn('[NeedleService] Web Worker instantiation fallback:', err);
        this.worker = null;
      }
    }
  }

  private postToWorker(message: NeedleWorkerInboundMessage): void {
    if (this.worker) {
      this.worker.postMessage(message);
    } else {
      // Direct in-process execution fallback
      handleNeedleWorkerMessage(message, (outbound) => {
        this.handleOutboundMessage(outbound);
      });
    }
  }

  private handleOutboundMessage(msg: NeedleWorkerOutboundMessage): void {
    if (msg.type === 'STATUS_UPDATE') {
      const { status, progress, error } = msg.payload;
      this.updateState({
        modelStatus: status,
        downloadProgress: progress !== undefined ? progress : this.state.downloadProgress,
        serviceStatus:
          status === 'ready'
            ? 'ready'
            : status === 'error'
              ? 'error'
              : 'initializing',
        error: error || null,
      });
    } else if (msg.type === 'INFER_RESULT') {
      const resolver = this.pendingInferResolvers.get(msg.payload.id);
      if (resolver) {
        this.pendingInferResolvers.delete(msg.payload.id);
        resolver(msg);
      }
    }
  }

  public getState(): NeedleState {
    return { ...this.state };
  }

  public subscribe(listener: (state: NeedleState) => void): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private updateState(patch: Partial<NeedleState>): void {
    this.state = { ...this.state, ...patch };
    const current = this.getState();
    this.listeners.forEach((fn) => fn(current));
  }

  public async initialize(options?: {
    modelUrl?: string;
    forceReload?: boolean;
  }): Promise<void> {
    if (this.state.modelStatus === 'ready' && !options?.forceReload) {
      return;
    }

    this.updateState({
      serviceStatus: 'initializing',
      error: null,
    });

    return new Promise<void>((resolve, reject) => {
      const unsubscribe = this.subscribe((st) => {
        if (st.modelStatus === 'ready') {
          unsubscribe();
          resolve();
        } else if (st.modelStatus === 'error') {
          unsubscribe();
          reject(new Error(st.error || 'Failed to initialize Needle model'));
        }
      });

      this.postToWorker({
        type: 'INIT_MODEL',
        payload: options,
      });
    });
  }

  public async executeCommand(
    query: string,
    context?: NeedleDomainContext
  ): Promise<NeedleExecutionResult> {
    const trimmed = query.trim();
    if (!trimmed) {
      return {
        query,
        executionStatus: 'rejected',
        message: 'Please enter a styling command or search query.',
      };
    }

    if (this.state.modelStatus !== 'ready') {
      try {
        await this.initialize();
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        return {
          query,
          executionStatus: 'failed',
          message: `Needle model unavailable: ${errorMsg}`,
        };
      }
    }

    this.updateState({
      serviceStatus: 'inferring',
      lastQuery: trimmed,
      error: null,
    });

    const inferId = `infer_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    const inferResultPromise = new Promise<
      Extract<NeedleWorkerOutboundMessage, { type: 'INFER_RESULT' }>
    >((resolve) => {
      this.pendingInferResolvers.set(inferId, resolve);
    });

    this.postToWorker({
      type: 'INFER',
      payload: {
        id: inferId,
        query: trimmed,
        toolsJson: NEEDLE_TOOLS_JSON,
      },
    });

    const inferMsg = await inferResultPromise;
    const { success, toolCall: rawToolCall, confidence, error } = inferMsg.payload;

    if (!success || !rawToolCall) {
      const result: NeedleExecutionResult = {
        query: trimmed,
        executionStatus: 'rejected',
        message:
          confidence < 0.5
            ? "Could you clarify what you'd like to do? (Low confidence in matched intent)"
            : error || 'Unable to interpret styling intent.',
      };
      this.updateState({
        serviceStatus: 'ready',
        lastResult: result,
      });
      return result;
    }

    // Validate and normalize raw tool call
    const validation = validateAndNormalizeToolCall(rawToolCall, confidence, trimmed);
    if (!validation.valid) {
      const result: NeedleExecutionResult = {
        query: trimmed,
        executionStatus: 'rejected',
        message: validation.error,
      };
      this.updateState({
        serviceStatus: 'ready',
        lastResult: result,
      });
      return result;
    }

    const validatedCall = validation.toolCall;

    // Three-Tier Confidence and Safety Gating
    if (validatedCall.confidence < 0.5) {
      // Tier 3: LOW (< 0.50) -> Rejected / Clarification required
      const result: NeedleExecutionResult = {
        query: trimmed,
        toolCall: validatedCall,
        executionStatus: 'rejected',
        message:
          "Could you clarify what you'd like to do? Please specify an occasion or garment.",
      };
      this.updateState({
        serviceStatus: 'ready',
        lastResult: result,
      });
      return result;
    }

    if (validatedCall.requiresConfirmation) {
      // Tier 2: MEDIUM (0.50 - 0.79) OR Destructive Action -> User Confirmation Modal required
      const pending: PendingAction = {
        id: validatedCall.id,
        toolCall: validatedCall,
        query: trimmed,
        explanation: validatedCall.explanation,
        createdAt: Date.now(),
      };

      const result: NeedleExecutionResult = {
        query: trimmed,
        toolCall: validatedCall,
        executionStatus: 'pending_confirmation',
        message: validatedCall.isDestructive
          ? `Destructive action detected. Please confirm to proceed: ${validatedCall.explanation}`
          : `Moderate confidence (${Math.round(validatedCall.confidence * 100)}%). Please confirm: ${validatedCall.explanation}`,
      };

      this.updateState({
        serviceStatus: 'awaiting_confirmation',
        pendingConfirmation: pending,
        lastResult: result,
      });
      return result;
    }

    // Tier 1: HIGH (>= 0.80) & Safe -> Immediate execution
    this.updateState({ serviceStatus: 'executing' });
    const executionResult = await this.executeDomainAction(validatedCall, trimmed, context);

    this.updateState({
      serviceStatus: 'ready',
      lastResult: executionResult,
    });
    return executionResult;
  }

  public async confirmAction(
    actionId: string,
    context?: NeedleDomainContext
  ): Promise<NeedleExecutionResult> {
    const pending = this.state.pendingConfirmation;
    if (!pending || pending.id !== actionId) {
      return {
        query: '',
        executionStatus: 'failed',
        message: 'No matching pending confirmation found.',
      };
    }

    this.updateState({
      serviceStatus: 'executing',
      pendingConfirmation: null,
    });

    const executionResult = await this.executeDomainAction(
      pending.toolCall,
      pending.query,
      context
    );

    this.updateState({
      serviceStatus: 'ready',
      lastResult: executionResult,
    });
    return executionResult;
  }

  public cancelAction(actionId: string): void {
    if (this.state.pendingConfirmation?.id === actionId) {
      this.updateState({
        serviceStatus: 'ready',
        pendingConfirmation: null,
      });
    }
  }

  private async executeDomainAction(
    toolCall: ValidatedToolCall,
    query: string,
    context?: NeedleDomainContext
  ): Promise<NeedleExecutionResult> {
    const items = context?.items || [];
    const preferences = context?.preferences;

    switch (toolCall.name) {
      case 'recommend_outfit': {
        const args = toolCall.arguments as {
          occasion: string;
          style?: string;
          season?: Season;
        };
        const season = args.season || 'summer';
        const outfits = generateOutfits(
          items,
          args.occasion as any,
          season,
          4,
          Math.random(),
          preferences
        );

        return {
          query,
          toolCall,
          executionStatus: 'executed',
          data: { outfits },
          message:
            outfits.length > 0
              ? `Found ${outfits.length} outfit recommendation${outfits.length === 1 ? '' : 's'} for ${args.occasion}.`
              : `No clean outfits found in your wardrobe matching "${args.occasion}". Check your laundry or add items.`,
        };
      }

      case 'search_wardrobe': {
        const args = toolCall.arguments as {
          category?: string;
          subcategory?: string;
          color?: string;
          status?: string;
        };

        const matched = items.filter((item) => {
          if (args.category && item.category.toLowerCase() !== args.category.toLowerCase()) {
            return false;
          }
          if (
            args.subcategory &&
            item.subcategory?.toLowerCase() !== args.subcategory.toLowerCase() &&
            !item.name.toLowerCase().includes(args.subcategory.toLowerCase())
          ) {
            return false;
          }
          if (
            args.color &&
            !item.colors?.some((c) => c.toLowerCase() === args.color!.toLowerCase()) &&
            (item as any).color?.toLowerCase() !== args.color.toLowerCase() &&
            !item.name.toLowerCase().includes(args.color.toLowerCase())
          ) {
            return false;
          }
          if (args.status && item.status !== args.status) {
            return false;
          }
          return true;
        });

        return {
          query,
          toolCall,
          executionStatus: 'executed',
          data: { items: matched },
          message: `Found ${matched.length} wardrobe item${matched.length === 1 ? '' : 's'}.`,
        };
      }

      case 'record_wear': {
        const args = toolCall.arguments as { itemName: string; date: string };
        const matchingItem = items.find((i) =>
          i.name.toLowerCase().includes(args.itemName.toLowerCase())
        );

        if (matchingItem && context?.updateItem) {
          await context.updateItem(matchingItem.id, {
            wearCount: (matchingItem.wearCount || 0) + 1,
            lastWornDate: args.date,
          });
        }

        return {
          query,
          toolCall,
          executionStatus: 'executed',
          data: {
            message: `Recorded wear for "${matchingItem ? matchingItem.name : args.itemName}" on ${args.date}.`,
          },
          message: `Logged wear for "${matchingItem ? matchingItem.name : args.itemName}" on ${args.date}.`,
        };
      }

      case 'create_style_plan': {
        const args = toolCall.arguments as {
          date: string;
          occasion: string;
          notes?: string;
        };

        let savedPlan: OutfitPlan | undefined;
        if (context?.savePlan) {
          savedPlan = await context.savePlan({
            date: args.date,
            occasion: args.occasion as any,
            outfit: {
              items: [],
              score: 80,
              why: [args.notes || `Planned with Needle for ${args.occasion}`],
              aestheticMatches: [],
              contextFit: 1,
              versatilityMultiplier: 1,
              seasonScore: 1,
              balanceScore: 1,
              template: 'Everyday casual',
            },
            status: 'planned',
            notes: args.notes,
          });
        }

        return {
          query,
          toolCall,
          executionStatus: 'executed',
          data: { plan: savedPlan },
          message: `Scheduled look for ${args.occasion} on ${args.date}.`,
        };
      }

      case 'search_style_preferences': {
        const args = toolCall.arguments as { preferenceType?: string };
        return {
          query,
          toolCall,
          executionStatus: 'executed',
          data: { preferences },
          message: `Style preferences: Mode is "${preferences?.stylingMode || 'balanced'}" with aesthetics ${preferences?.aestheticPreferences?.join(', ') || 'default'}.`,
        };
      }

      default:
        return {
          query,
          toolCall,
          executionStatus: 'failed',
          message: `Unsupported tool execution: ${toolCall.name}`,
        };
    }
  }
}

export const needleService = new NeedleService();
