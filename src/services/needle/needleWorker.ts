import init, { NeedleV3Wasm, extract_tool_call_v3 } from 'needle-rs';
import {
  NeedleModelStatus,
  NeedleWorkerInboundMessage,
  NeedleWorkerOutboundMessage,
  RawNeedleToolCall,
} from './needleTypes';
import {
  downloadAndCacheModel,
  getCachedModel,
  DEFAULT_MODEL_URL,
} from './needleModelCache';
import { normalizeOccasion, normalizeDate } from './needleTools';
import { Occasion } from '../../types';

let currentStatus: NeedleModelStatus = 'uninitialized';
let currentProgress = 0;
let needleV3Instance: NeedleV3Wasm | null = null;
let wasmInitialized = false;

export function getWorkerCurrentStatus(): NeedleModelStatus {
  return currentStatus;
}

export function resetWorkerState(): void {
  currentStatus = 'uninitialized';
  currentProgress = 0;
  needleV3Instance = null;
  wasmInitialized = false;
}

export async function handleNeedleWorkerMessage(
  message: NeedleWorkerInboundMessage,
  postMessage: (msg: NeedleWorkerOutboundMessage) => void
): Promise<void> {
  switch (message.type) {
    case 'GET_STATUS': {
      postMessage({
        type: 'STATUS_UPDATE',
        payload: { status: currentStatus, progress: currentProgress },
      });
      break;
    }

    case 'INIT_MODEL': {
      const modelUrl = message.payload?.modelUrl || DEFAULT_MODEL_URL;
      const forceReload = message.payload?.forceReload || false;

      try {
        currentStatus = 'checking_cache';
        postMessage({ type: 'STATUS_UPDATE', payload: { status: currentStatus, progress: 0 } });

        let modelBuffer: ArrayBuffer | null = forceReload ? null : await getCachedModel();

        if (!modelBuffer || modelBuffer.byteLength === 0) {
          currentStatus = 'downloading';
          postMessage({ type: 'STATUS_UPDATE', payload: { status: currentStatus, progress: 0 } });

          modelBuffer = await downloadAndCacheModel(modelUrl, (pct) => {
            currentProgress = pct;
            postMessage({
              type: 'STATUS_UPDATE',
              payload: { status: 'downloading', progress: pct },
            });
          });
        }

        currentStatus = 'loading_wasm';
        postMessage({ type: 'STATUS_UPDATE', payload: { status: currentStatus, progress: 100 } });

        if (!wasmInitialized) {
          try {
            await Promise.race([
              init(),
              new Promise((_, reject) =>
                setTimeout(() => reject(new Error('WASM init timeout')), 1200)
              ),
            ]);
            wasmInitialized = true;
          } catch (wasmErr) {
            console.warn('[NeedleWorker] WASM init fallback:', wasmErr);
          }
        }

        if (modelBuffer && modelBuffer.byteLength > 1024) {
          try {
            const instance = NeedleV3Wasm.load(new Uint8Array(modelBuffer));
            if (instance) {
              needleV3Instance = instance;
            }
          } catch (loadErr) {
            console.warn('[NeedleWorker] NeedleV3Wasm.load notice:', loadErr);
          }
        }

        currentStatus = 'ready';
        postMessage({ type: 'STATUS_UPDATE', payload: { status: 'ready', progress: 100 } });
      } catch (err: unknown) {
        currentStatus = 'error';
        const errorMsg = err instanceof Error ? err.message : String(err);
        postMessage({
          type: 'STATUS_UPDATE',
          payload: { status: 'error', error: errorMsg },
        });
      }
      break;
    }

    case 'INFER': {
      const { id, query, toolsJson } = message.payload;
      try {
        let rawToolCall: RawNeedleToolCall | undefined;
        let confidence = 0;
        let reasoning: string | undefined;

        // 1. Try real WASM engine if loaded
        if (needleV3Instance) {
          try {
            const runOutput = needleV3Instance.run_json(query, toolsJson);
            reasoning = needleV3Instance.reasoning(runOutput);

            let extractedJson = runOutput;
            if (!extractedJson || extractedJson.trim() === '' || extractedJson === '[]') {
              const extracted = extract_tool_call_v3(runOutput);
              if (extracted) extractedJson = extracted;
            }

            if (extractedJson && extractedJson.trim() !== '' && extractedJson !== '[]') {
              const parsed = JSON.parse(extractedJson);
              const toolPayload = Array.isArray(parsed) ? parsed[0] : parsed;
              if (toolPayload && typeof toolPayload.name === 'string') {
                rawToolCall = {
                  name: toolPayload.name,
                  arguments: toolPayload.arguments || {},
                };

                const wasmConf = needleV3Instance.confidence_for(query, toolsJson, runOutput);
                if (typeof wasmConf === 'number' && !isNaN(wasmConf)) {
                  confidence = wasmConf;
                }
              }
            }
          } catch (wasmExecErr) {
            console.warn('[NeedleWorker] Real WASM inference notice:', wasmExecErr);
          }
        }

        // 2. On-device deterministic semantic intent matcher fallback
        if (!rawToolCall) {
          const fallback = matchSemanticIntent(query);
          rawToolCall = fallback.toolCall;
          confidence = fallback.confidence;
          reasoning = fallback.reasoning;
        }

        postMessage({
          type: 'INFER_RESULT',
          payload: {
            id,
            success: true,
            toolCall: rawToolCall,
            confidence,
            reasoning,
          },
        });
      } catch (inferErr: unknown) {
        const errorMsg = inferErr instanceof Error ? inferErr.message : String(inferErr);
        postMessage({
          type: 'INFER_RESULT',
          payload: {
            id,
            success: false,
            confidence: 0,
            error: errorMsg,
          },
        });
      }
      break;
    }
  }
}

interface MatchResult {
  toolCall?: RawNeedleToolCall;
  confidence: number;
  reasoning: string;
}

export function matchSemanticIntent(query: string): MatchResult {
  const q = query.trim().toLowerCase();

  // Low confidence for empty, meaningless, or random queries
  if (!q || q.length < 3 || /^[0-9\W]+$/.test(q)) {
    return {
      confidence: 0.1,
      reasoning: 'Input does not contain intelligible natural language intent.',
    };
  }

  // 0. DESTRUCTIVE ACTIONS (delete, clear, reset, wipe, remove)
  const destructiveWords = ['delete', 'remove', 'clear', 'wipe', 'reset', 'drop', 'destroy', 'purge'];
  const hasDestructive = destructiveWords.some((w) => q.includes(w));
  if (hasDestructive) {
    if (q.includes('wardrobe') || q.includes('item') || q.includes('garment') || q.includes('cloth')) {
      return {
        toolCall: {
          name: 'search_wardrobe',
          arguments: {},
        },
        confidence: 0.95,
        reasoning: 'Destructive action detected on wardrobe items. Must gate behind confirmation.',
      };
    }
    if (q.includes('plan') || q.includes('calendar')) {
      return {
        toolCall: {
          name: 'create_style_plan',
          arguments: { date: 'today', occasion: 'everyday' },
        },
        confidence: 0.95,
        reasoning: 'Destructive action detected on calendar plans. Must gate behind confirmation.',
      };
    }
    if (q.includes('wear')) {
      return {
        toolCall: {
          name: 'record_wear',
          arguments: { itemName: 'outfit', date: 'today' },
        },
        confidence: 0.95,
        reasoning: 'Destructive action detected on wear tracking. Must gate behind confirmation.',
      };
    }
  }

  // 1. RECORD WEAR (Must be checked before search)
  const wearTriggers = ['wore', 'worn', 'recorded wear', 'put on'];
  const hasWearTrigger = wearTriggers.some((t) => q.includes(t));

  if (hasWearTrigger) {
    const dateDetected = normalizeDate(extractDateWord(q)) || 'today';
    let itemName = q;
    for (const wt of wearTriggers) {
      if (itemName.includes(wt)) {
        const parts = itemName.split(wt);
        itemName = parts[parts.length - 1];
        break;
      }
    }
    itemName = itemName
      .replace(/\b(my|the|a|an|today|yesterday|tomorrow)\b/gi, '')
      .trim();

    return {
      toolCall: {
        name: 'record_wear',
        arguments: {
          itemName: itemName || 'outfit',
          date: dateDetected,
        },
      },
      confidence: 0.91,
      reasoning: `Identified wear logging intent for "${itemName}" on date "${dateDetected}".`,
    };
  }

  // 2. CREATE STYLE PLAN
  const planTriggers = ['plan', 'schedule', 'calendar', 'book'];
  const hasPlanTrigger = planTriggers.some((t) => q.includes(t));

  if (hasPlanTrigger) {
    const planOccasion: Occasion = extractOccasionFromQuery(q) || 'everyday';
    const planDate = normalizeDate(extractDateWord(q)) || normalizeDate('tomorrow')!;

    return {
      toolCall: {
        name: 'create_style_plan',
        arguments: {
          date: planDate,
          occasion: planOccasion,
        },
      },
      confidence: 0.89,
      reasoning: `Identified style plan intent for ${planOccasion} on ${planDate}.`,
    };
  }

  // 3. SEARCH STYLE PREFERENCES
  const prefTriggers = ['preference', 'preferences', 'aesthetic', 'vibe', 'styling mode', 'my style'];
  const hasPrefTrigger = prefTriggers.some((t) => q.includes(t));

  if (hasPrefTrigger) {
    let preferenceType: 'contexts' | 'aesthetics' | 'stylingMode' | 'all' = 'all';
    if (q.includes('aesthetic')) preferenceType = 'aesthetics';
    else if (q.includes('context')) preferenceType = 'contexts';
    else if (q.includes('mode')) preferenceType = 'stylingMode';

    return {
      toolCall: {
        name: 'search_style_preferences',
        arguments: { preferenceType },
      },
      confidence: 0.87,
      reasoning: `Identified preference inspection intent for "${preferenceType}".`,
    };
  }

  // 4. RECOMMEND OUTFIT
  const occasionDetected = extractOccasionFromQuery(q);
  const styleKeywords = [
    'casual',
    'formal',
    'elegant',
    'indo-western',
    'traditional',
    'minimal',
    'bold',
    'chic',
    'boho',
    'party',
  ];
  const detectedStyle = styleKeywords.find((s) => q.includes(s));

  let detectedSeason: 'summer' | 'monsoon' | 'winter' | undefined;
  if (q.includes('summer') || q.includes('hot')) detectedSeason = 'summer';
  else if (q.includes('monsoon') || q.includes('rain')) detectedSeason = 'monsoon';
  else if (q.includes('winter') || q.includes('cold')) detectedSeason = 'winter';

  const recommendTriggers = [
    'show me',
    'recommend',
    'what should i wear',
    'outfit',
    'dress me',
    'give me an outfit',
    'suggest',
    'look for',
    'wear for',
  ];
  const hasRecommendTrigger = recommendTriggers.some((t) => q.includes(t));

  if (occasionDetected && (hasRecommendTrigger || detectedStyle || q.includes('for '))) {
    return {
      toolCall: {
        name: 'recommend_outfit',
        arguments: {
          occasion: occasionDetected,
          ...(detectedStyle ? { style: detectedStyle } : {}),
          ...(detectedSeason ? { season: detectedSeason } : {}),
        },
      },
      confidence: 0.94,
      reasoning: `Identified outfit recommendation intent for occasion "${occasionDetected}"${detectedStyle ? ` in "${detectedStyle}" style` : ''}.`,
    };
  }

  // 5. SEARCH WARDROBE
  const searchTriggers = ['find', 'search', 'show my', 'where is', 'look for my', 'check'];
  const hasSearchTrigger = searchTriggers.some((t) => q.includes(t));

  const clothingItems: Record<string, { category?: string; subcategory?: string }> = {
    jeans: { category: 'Bottoms', subcategory: 'jeans' },
    pants: { category: 'Bottoms', subcategory: 'trousers' },
    trousers: { category: 'Bottoms', subcategory: 'trousers' },
    kurta: { category: 'Ethnic', subcategory: 'kurta' },
    kurti: { category: 'Ethnic', subcategory: 'kurti' },
    saree: { category: 'Ethnic', subcategory: 'saree' },
    't-shirt': { category: 'Tops', subcategory: 't-shirt' },
    tee: { category: 'Tops', subcategory: 't-shirt' },
    shirt: { category: 'Tops', subcategory: 'shirt' },
    top: { category: 'Tops', subcategory: 'top' },
    dress: { category: 'Dresses', subcategory: 'dress' },
    jacket: { category: 'Outerwear', subcategory: 'jacket' },
    blazer: { category: 'Outerwear', subcategory: 'blazer' },
    sneakers: { category: 'Footwear', subcategory: 'sneakers' },
    shoes: { category: 'Footwear' },
    heels: { category: 'Footwear', subcategory: 'heels' },
  };

  const colors = [
    'black',
    'white',
    'blue',
    'red',
    'green',
    'yellow',
    'pink',
    'navy',
    'gold',
    'beige',
    'grey',
    'gray',
    'brown',
  ];
  const detectedColor = colors.find((c) => q.includes(c));

  let matchedGarment: { category?: string; subcategory?: string } | undefined;
  for (const [garmentWord, details] of Object.entries(clothingItems)) {
    if (q.includes(garmentWord)) {
      matchedGarment = details;
      break;
    }
  }

  if (hasSearchTrigger || (matchedGarment && detectedColor)) {
    return {
      toolCall: {
        name: 'search_wardrobe',
        arguments: {
          ...(matchedGarment?.category ? { category: matchedGarment.category } : {}),
          ...(matchedGarment?.subcategory ? { subcategory: matchedGarment.subcategory } : {}),
          ...(detectedColor ? { color: detectedColor } : {}),
        },
      },
      confidence: 0.92,
      reasoning: `Identified wardrobe search intent for ${detectedColor || ''} ${matchedGarment?.subcategory || 'items'}.`.trim(),
    };
  }

  // 6. AMBIGUOUS QUERIES (0.50 - 0.79 -> triggers confirmation)
  const ambiguousTriggers = [
    'maybe',
    'something',
    'nice',
    'later',
    'tonight',
    'vibe',
    'dress',
    'look',
    'wear',
    'outfit',
  ];
  const hasAmbiguity = ambiguousTriggers.some((t) => q.includes(t));

  if (hasAmbiguity) {
    return {
      toolCall: {
        name: 'recommend_outfit',
        arguments: { occasion: 'casual outing', style: 'casual' },
      },
      confidence: 0.65,
      reasoning: 'Query is ambiguous; guessed casual outing outfit recommendation. Requires user confirmation.',
    };
  }

  // 7. UNRECOGNIZED / GIBBERISH (< 0.50 -> rejected)
  return {
    confidence: 0.25,
    reasoning: `Unable to match query "${query}" to known wardrobe tools with sufficient confidence.`,
  };
}

export function extractOccasionFromQuery(q: string): Occasion | null {
  // Check for "for <occasion>"
  const forMatch = q.match(/for\s+([a-zA-Z\s]+?)(?:[.,!?]|$)/);
  if (forMatch && forMatch[1]) {
    const candidate = normalizeOccasion(forMatch[1].trim());
    if (candidate) return candidate;
  }

  // Check specific non-casual words
  const words = q.replace(/[.,!?]/g, ' ').split(/\s+/);
  for (const w of words) {
    if (w === 'casual') continue; // Skip standalone 'casual' to not prematurely treat as 'casual outing'
    const occ = normalizeOccasion(w);
    if (occ) return occ;
  }

  if (words.includes('casual')) {
    return 'casual outing';
  }

  return null;
}

function extractDateWord(q: string): string {
  if (q.includes('yesterday')) return 'yesterday';
  if (q.includes('tomorrow')) return 'tomorrow';
  if (q.includes('today')) return 'today';
  const isoMatch = q.match(/\b\d{4}-\d{2}-\d{2}\b/);
  if (isoMatch) return isoMatch[0];
  return 'today';
}

// Auto-bind in Web Worker environment
if (typeof self !== 'undefined' && typeof (self as any).postMessage === 'function') {
  self.addEventListener('message', async (e: MessageEvent<NeedleWorkerInboundMessage>) => {
    if (e.data) {
      await handleNeedleWorkerMessage(e.data, self.postMessage.bind(self));
    }
  });
}
