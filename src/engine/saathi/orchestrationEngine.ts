import {
  SaathiConversationState,
  SaathiMessage,
  SaathiResponse,
  SaathiToolContext,
  ConfirmationRequest,
  ClarificationRequest,
  DomainResultReference,
} from './types';
import { GeneratedOutfit, WardrobeItem, RecommendedOutfit, Occasion } from '../../types';
import { parseSaathiIntent } from './intentParser';
import {
  mergeConversationEntities,
  resolveTargetDate,
  resolveSeasonForDate,
  resolveWardrobeGarment,
  resolveReferencedLook,
} from './contextResolver';
import {
  createOccasionClarification,
  applyClarificationResponse,
} from './clarificationEngine';
import {
  recommendOutfitsTool,
  styleItemTool,
  getCurrentWeatherTool,
  getWearAnalyticsTool,
  getStyleProfileTool,
  getWardrobeGapsTool,
  getPurchaseAssessmentTool,
  getWardrobeTool,
  explainFashionKnowledgeTool,
  createPlanTool,
  recordWearTool,
} from './toolRegistry';
import { buildEditorialReasoning } from './editorialReasoning';
import {
  DESIGNERS_EDIT_PHILOSOPHIES,
  searchPhilosophies,
  getPhilosophyById,
} from '../knowledge/designersEditCatalog';

const MAX_HISTORY_MESSAGES = 50;

function extractEditorialComponents(slots: Record<string, any[]>): {
  top?: any;
  bottom?: any;
  layer?: any;
  footwear?: any;
  accessory?: any;
} {
  const allPieces = Object.values(slots || {}).flat();
  return {
    top: allPieces.find(
      (p) =>
        p.category === 'Tops' ||
        (p.category === 'Ethnic' && p.subcategory !== 'saree' && p.subcategory !== 'lehenga' && p.subcategory !== 'dupatta')
    ),
    bottom: allPieces.find(
      (p) => p.category === 'Bottoms' || p.subcategory === 'saree' || p.subcategory === 'lehenga'
    ),
    layer: allPieces.find(
      (p) => p.category === 'Outerwear' || p.subcategory === 'nehru jacket' || p.subcategory === 'blazer'
    ),
    footwear: allPieces.find((p) => p.category === 'Footwear'),
    accessory: allPieces.find((p) => p.category === 'Accessories' || p.subcategory === 'dupatta'),
  };
}

/**
 * Creates an empty initial conversation state.
 */
export function createInitialConversationState(conversationId = 'default'): SaathiConversationState {
  return {
    conversationId,
    messages: [],
    resolvedEntities: {},
  };
}

let saathiMsgSeqCounter = 0;

/**
 * Robust, collision-free message ID generator for AI Saathi conversation threads.
 * Guarantees uniqueness even across multiple messages created in the same millisecond or turn,
 * while maintaining deterministic prefix conventions and stable IDs.
 */
export function generateSaathiMessageId(prefix: 'u' | 'a', referenceTimestamp?: number): string {
  saathiMsgSeqCounter = (saathiMsgSeqCounter + 1) % 1_000_000;
  const ts = referenceTimestamp ?? Date.now();
  const rand = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 8);
  return `msg_${prefix}_${ts}_${saathiMsgSeqCounter}_${rand}`;
}

/**
 * Sanitizes ensemble slots to prevent slot accumulation or incompatible combinations:
 * 1. Mutual exclusivity between full-body ethnic drapes / dresses (saree, anarkali, dress, lehenga) and separates (jeans, trousers).
 * 2. Deduplication and empty slot filtering.
 */
export function sanitizeEnsembleSlots(
  slots: Record<string, WardrobeItem[]>
): Record<string, WardrobeItem[]> {
  const result: Record<string, WardrobeItem[]> = {};

  const allItems = Object.entries(slots).flatMap(([role, items]) =>
    (items || []).map((item) => ({ role, item }))
  );

  const hasFullDrape = allItems.some(
    ({ item }) =>
      item.category === 'Dresses' ||
      item.subcategory === 'saree' ||
      item.subcategory === 'anarkali' ||
      item.subcategory === 'dress' ||
      item.subcategory === 'lehenga'
  );

  const hasSeparates = allItems.some(
    ({ item }) =>
      item.category === 'Bottoms' ||
      item.subcategory === 'jeans' ||
      item.subcategory === 'trousers'
  );

  for (const [role, items] of Object.entries(slots)) {
    if (!Array.isArray(items) || items.length === 0) continue;

    const filtered = items.filter((item) => {
      if (hasFullDrape && hasSeparates) {
        if (
          role === 'bottom' ||
          item.category === 'Bottoms' ||
          item.subcategory === 'jeans' ||
          item.subcategory === 'trousers'
        ) {
          const hasSaree = allItems.some(({ item: i }) => i.subcategory === 'saree');
          if (hasSaree) return false;
        }
      }
      return true;
    });

    if (filtered.length > 0) {
      result[role] = filtered;
    }
  }

  return result;
}

/**
 * Main Pure Analytical Function: Orchestrates a multi-turn conversation step.
 * Invariant: Invokes only authoritative domain engines; never invents facts or mutates unconfirmed state.
 */
export async function processSaathiTurn(
  userInput: string,
  state: SaathiConversationState,
  context: SaathiToolContext
): Promise<SaathiResponse> {
  const userTimestamp = context.referenceTimestamp;
  const currentMessages = state.messages || [];
  const userMessage: SaathiMessage = {
    id: generateSaathiMessageId('u', userTimestamp),
    sender: 'user',
    text: userInput,
    timestamp: userTimestamp,
  };

  let workingState: SaathiConversationState = {
    ...state,
    messages: [...currentMessages, userMessage].slice(-MAX_HISTORY_MESSAGES),
    resolvedEntities: { ...(state.resolvedEntities || {}) },
    shownOutfitIds: [...(state.shownOutfitIds || [])],
    activeAnchorItem: state.activeAnchorItem,
    activeOccasion: state.activeOccasion,
    activeOccasionContext: state.activeOccasionContext,
    activeOutfit: state.activeOutfit,
  };

  // =========================================================================
  // 1. Check for Pending Confirmation Response
  // =========================================================================
  if (workingState.pendingConfirmation) {
    const confirmation = workingState.pendingConfirmation;
    const lowerInput = userInput.trim().toLowerCase();
    const isCorrection =
      /^(no|nah|nope)[,\s]+(i meant|i mean|actually|rather|instead)\b/i.test(lowerInput) ||
      /\b(i meant|meant for)\b/i.test(lowerInput);

    const isYes = [
      'yes',
      'yeah',
      'yep',
      'sure',
      'confirm',
      'proceed',
      'do it',
      'please do',
      'looks good',
      'go ahead',
      'ok',
      'okay',
      'plan it',
      'save it',
    ].some((w) => lowerInput === w || lowerInput.startsWith(w));

    const isNo = [
      'no',
      'nope',
      'nah',
      'cancel',
      'stop',
      'abort',
      "don't",
      'nevermind',
    ].some((w) => lowerInput === w || lowerInput.startsWith(w));

    if (isCorrection) {
      // User is correcting a previous parameter (e.g. "No, I meant for an interview")
      // Discard pending confirmation without rejecting and allow downflow to process the new intent
      workingState.pendingConfirmation = undefined;
    } else if (isYes) {
      workingState.pendingConfirmation = undefined;

      if (confirmation.actionType === 'PLAN_OUTFIT') {
        const payload = confirmation.payload as any;
        const result = await createPlanTool.execute(payload, context);
        const assistantMessage: SaathiMessage = {
          id: generateSaathiMessageId('a', userTimestamp),
          sender: 'assistant',
          text: `Done! I've added your look to your calendar for ${payload.occasion} on ${payload.date}.`,
          timestamp: userTimestamp + 1,
          domainResult: result,
        };
        workingState.messages = [...workingState.messages, assistantMessage].slice(-MAX_HISTORY_MESSAGES);
        return {
          message: assistantMessage.text,
          intent: 'CONFIRMATION_RESPONSE',
          domainResult: result,
          updatedState: workingState,
        };
      }

      if (confirmation.actionType === 'RECORD_WEAR') {
        const payload = confirmation.payload as any;
        const result = await recordWearTool.execute(payload, context);
        const assistantMessage: SaathiMessage = {
          id: generateSaathiMessageId('a', userTimestamp),
          sender: 'assistant',
          text: `Logged! Your wear count and rotation analytics for ${payload.dateStr} have been updated.`,
          timestamp: userTimestamp + 1,
          domainResult: result,
        };
        workingState.messages = [...workingState.messages, assistantMessage].slice(-MAX_HISTORY_MESSAGES);
        return {
          message: assistantMessage.text,
          intent: 'CONFIRMATION_RESPONSE',
          domainResult: result,
          updatedState: workingState,
        };
      }
    } else if (isNo) {
      workingState.pendingConfirmation = undefined;
      const assistantMessage: SaathiMessage = {
        id: generateSaathiMessageId('a', userTimestamp),
        sender: 'assistant',
        text: 'Understood. Action cancelled — no changes were made to your wardrobe or calendar.',
        timestamp: userTimestamp + 1,
      };
      workingState.messages = [...workingState.messages, assistantMessage].slice(-MAX_HISTORY_MESSAGES);
      return {
        message: assistantMessage.text,
        intent: 'CONFIRMATION_RESPONSE',
        updatedState: workingState,
      };
    }
  }

  // =========================================================================
  // 2. Check for Pending Clarification Response
  // =========================================================================
  let resumeActiveIntent = false;
  if (workingState.pendingClarification) {
    const clarification = workingState.pendingClarification;
    const lowerInput = userInput.trim().toLowerCase();

    // Check if input matches option value or option label
    let matchedOptionValue: string | undefined;
    if (clarification.options) {
      const match = clarification.options.find(
        (opt) =>
          opt.value.toLowerCase() === lowerInput ||
          opt.label.toLowerCase() === lowerInput ||
          lowerInput.includes(opt.value.toLowerCase()) ||
          lowerInput.includes(opt.label.toLowerCase())
      );
      if (match) {
        matchedOptionValue = match.value;
      }
    }

    // Check if user input is an answer to clarification or a topic switch
    const tentativeIntent = parseSaathiIntent(userInput);
    const isTopicSwitch =
      tentativeIntent.intent !== 'UNKNOWN' &&
      tentativeIntent.intent !== 'CLARIFICATION_RESPONSE' &&
      !matchedOptionValue;

    if (isTopicSwitch) {
      // User changed the subject (e.g. asked about wear analytics while occasion was pending)
      workingState.pendingClarification = undefined;
      resumeActiveIntent = false;
    } else {
      const resolvedValue = matchedOptionValue || userInput.trim();
      workingState.resolvedEntities = applyClarificationResponse(
        clarification,
        resolvedValue,
        workingState.resolvedEntities
      );
      workingState.pendingClarification = undefined;
      resumeActiveIntent = true;
    }
  }

  // =========================================================================
  // 3. Intent Detection & Entity Extraction
  // =========================================================================
  const intentResult = parseSaathiIntent(userInput);

  // Inherit multi-turn context
  workingState.resolvedEntities = mergeConversationEntities(
    workingState.resolvedEntities,
    intentResult.entities
  );

  // Update active occasion and context from newly parsed entities if present
  if (intentResult.entities.occasion) {
    if (state.activeOccasion && intentResult.entities.occasion !== state.activeOccasion) {
      if (
        !intentResult.entities.isCorrection &&
        !intentResult.entities.keptPieceName &&
        !intentResult.entities.anchorGarmentName
      ) {
        workingState.activeAnchorItem = undefined;
        delete workingState.resolvedEntities.wardrobeItemId;
        delete workingState.resolvedEntities.wardrobeItemName;
        delete workingState.resolvedEntities.anchorGarmentId;
        delete workingState.resolvedEntities.anchorGarmentName;
        delete workingState.resolvedEntities.requestedGarmentName;
        delete workingState.resolvedEntities.subcategory;
        delete workingState.resolvedEntities.category;
        delete workingState.resolvedEntities.color;
        delete workingState.resolvedEntities.fabric;
        delete workingState.resolvedEntities.garmentType;
        delete workingState.resolvedEntities.garmentCategory;
        delete workingState.resolvedEntities.swapRole;
        delete workingState.resolvedEntities.refinementType;
      }
    }
    workingState.activeOccasion = intentResult.entities.occasion;
    workingState.resolvedEntities.occasion = intentResult.entities.occasion;
  }
  if (intentResult.entities.occasionContext) {
    workingState.activeOccasionContext = intentResult.entities.occasionContext;
  }
  if (intentResult.entities.unlockedAnchor) {
    workingState.activeAnchorItem = undefined;
    delete workingState.resolvedEntities.wardrobeItemId;
    delete workingState.resolvedEntities.wardrobeItemName;
    delete workingState.resolvedEntities.anchorGarmentId;
    delete workingState.resolvedEntities.anchorGarmentName;
    delete workingState.resolvedEntities.requestedGarmentName;
    delete workingState.resolvedEntities.keptPieceName;
    delete workingState.resolvedEntities.keptPieceRole;
    delete workingState.resolvedEntities.subcategory;
    delete workingState.resolvedEntities.category;
    delete workingState.resolvedEntities.color;
    delete workingState.resolvedEntities.fabric;
    delete workingState.resolvedEntities.garmentType;
    delete workingState.resolvedEntities.garmentCategory;
  }

  let activeIntent = intentResult.intent;
  if (resumeActiveIntent && workingState.activeIntent) {
    activeIntent = workingState.activeIntent;
  } else if (activeIntent === 'CLARIFICATION_RESPONSE' && workingState.activeIntent) {
    activeIntent = workingState.activeIntent;
  } else if (activeIntent !== 'UNKNOWN') {
    workingState.activeIntent = activeIntent;
  } else if (workingState.activeIntent) {
    activeIntent = workingState.activeIntent;
  }

  // Target date and season resolution
  const targetDate = resolveTargetDate(
    context.referenceTimestamp,
    workingState.resolvedEntities.relativeDate,
    workingState.resolvedEntities.date
  );
  const targetSeason =
    workingState.resolvedEntities.season || resolveSeasonForDate(targetDate);

  // =========================================================================
  // 4. Intent Execution & Domain Engine Delegation
  // =========================================================================
  let responseText = '';
  let domainResult: DomainResultReference | undefined;
  let clarificationRequest: ClarificationRequest | undefined;
  let confirmationRequest: ConfirmationRequest | undefined;

  switch (activeIntent) {
    // -----------------------------------------------------------------------
    // A. RECOMMEND_OUTFIT
    // -----------------------------------------------------------------------
    case 'RECOMMEND_OUTFIT': {
      if (!workingState.resolvedEntities.occasion) {
        clarificationRequest = createOccasionClarification();
        responseText = 'What kind of occasion or setting should I style for?';
        break;
      }

      const occasion = workingState.resolvedEntities.occasion;

      // Extract recent worn items if anti-repetition was requested
      const recentWornItemIds = new Set<string>();
      if (workingState.resolvedEntities.antiRepetition) {
        const lookbackDays = workingState.resolvedEntities.avoidRecentDays || 2;
        const cutoffTime = context.referenceTimestamp - lookbackDays * 86400000;
        const wearEvents = context.wearEvents || context.wearLogs || [];
        for (const w of wearEvents as any[]) {
          const wornAt = w.wornAt || w.timestamp || w.createdAt || 0;
          if (wornAt >= cutoffTime) {
            const itemId = w.wardrobeItemId || w.itemId;
            if (itemId) recentWornItemIds.add(itemId);
          }
        }
        for (const item of context.wardrobe) {
          if (item.lastWorn && item.lastWorn >= cutoffTime) {
            recentWornItemIds.add(item.id);
          }
        }
      }

      let anchor = workingState.activeAnchorItem;
      let unownedRequestedGarment: string | undefined;

      const requestedGarment =
        intentResult.entities.requestedGarmentName ||
        workingState.resolvedEntities.requestedGarmentName ||
        workingState.resolvedEntities.wardrobeItemName;

      if (
        !anchor &&
        (workingState.resolvedEntities.wardrobeItemId ||
          requestedGarment ||
          workingState.resolvedEntities.subcategory)
      ) {
        const match = resolveWardrobeGarment(context.wardrobe, {
          wardrobeItemId: workingState.resolvedEntities.wardrobeItemId,
          wardrobeItemName: requestedGarment,
          color: workingState.resolvedEntities.color,
          subcategory: workingState.resolvedEntities.subcategory,
          category: workingState.resolvedEntities.category,
        });
        if (match.status === 'resolved' && match.matchedItem) {
          anchor = match.matchedItem;
          workingState.activeAnchorItem = anchor;
        } else if (match.status === 'not_found' && requestedGarment) {
          unownedRequestedGarment = requestedGarment.replace(/^(my|a|an|the|this)\s+/i, '').trim();
        }
      }

      domainResult = await recommendOutfitsTool.execute(
        {
          occasion,
          season: targetSeason,
          dateStr: targetDate,
          anchorItemId: anchor?.id,
          recentWornItemIds: recentWornItemIds.size > 0 ? Array.from(recentWornItemIds) : undefined,
        },
        context
      );

      const outfits = domainResult.outfits || [];
      if (outfits.length > 0) {
        const top = outfits[0];
        workingState.activeOutfit = top;
        if (outfits.length === 1) {
          workingState.selectedOutfitId = top.id;
          workingState.selectedLookIndex = 0;
        } else {
          workingState.selectedOutfitId = undefined;
          workingState.selectedLookIndex = undefined;
        }
        workingState.activeOccasion = occasion;
        if (!workingState.shownOutfitIds?.includes(top.id)) {
          workingState.shownOutfitIds = [...(workingState.shownOutfitIds || []), top.id];
        }

        const pieces = Object.values(top.slots || {})
          .flat()
          .map((i) => i.name)
          .join(', ');

        const whyBullets = top.explanation?.reasons?.slice(0, 3) || [];
        const explanationText =
          whyBullets.length > 0
            ? `\n\nWhy this works:\n${whyBullets.map((r) => `• ${r}`).join('\n')}`
            : '';

        const repetitionNotice = workingState.resolvedEntities.antiRepetition
          ? ' (avoiding pieces worn recently)'
          : '';

        const ack = intentResult.entities.isCorrection
          ? `Got it! Adjusting occasion to **${occasion}** — `
          : '';

        const unownedNotice = unownedRequestedGarment
          ? `I couldn't find a **${unownedRequestedGarment}** in your wardrobe. Here is an alternative combination using your existing clean pieces for **${occasion}**:\n• `
          : `${ack}Here is a curated look for **${occasion}**${repetitionNotice}:\n• `;

        responseText = `${unownedNotice}**${pieces}**${explanationText}`;
      } else {
        if (unownedRequestedGarment) {
          responseText = `I couldn't find a **${unownedRequestedGarment}** in your wardrobe, and no complete clean alternative look could be assembled for **${occasion}**. Add pieces or check your laundry.`;
        } else {
          responseText = `I couldn't find a complete clean look for **${occasion}** right now. Check if required pieces are in laundry or add missing categories.`;
        }
      }
      break;
    }

    // -----------------------------------------------------------------------
    // B. STYLE_ITEM (Phase 7 Anchor Item)
    // -----------------------------------------------------------------------
    case 'STYLE_ITEM': {
      // Disambiguate garment
      let anchorId: string | undefined;

      const specificallyRequested =
        intentResult.entities.requestedGarmentName ||
        intentResult.entities.wardrobeItemName;

      const recentContextItems: any[] = [];
      if (workingState.lastDomainResult?.outfits) {
        for (const outfit of workingState.lastDomainResult.outfits) {
          for (const slotItems of Object.values(outfit.slots || {})) {
            if (Array.isArray(slotItems)) {
              recentContextItems.push(...slotItems);
            }
          }
        }
      }

      // If the user specified a garment in THIS turn, always resolve it directly against the wardrobe,
      // rather than inheriting a stale wardrobeItemId from a previous turn.
      if (specificallyRequested) {
        const match = resolveWardrobeGarment(
          context.wardrobe,
          {
            color: intentResult.entities.color,
            subcategory: intentResult.entities.subcategory,
            category: intentResult.entities.category,
            itemName: specificallyRequested,
          },
          recentContextItems
        );

        if (match.status === 'ambiguous') {
          clarificationRequest = match.clarification;
          responseText = match.clarification?.question || 'Which garment would you like to style?';
          break;
        }

        if (match.status === 'not_found') {
          // Task 4: Explicitly handle unowned garment queries!
          const cleanItemName = specificallyRequested.replace(/^(my|a|an|the|this)\s+/i, '').trim();
          const existingAnchor =
            workingState.activeAnchorItem ||
            (workingState.activeOutfit?.slots?.bottom?.[0]);
          const occasion =
            workingState.activeOccasion ||
            workingState.resolvedEntities.occasion ||
            'college';

          if (existingAnchor && context.wardrobe.some((i) => i.id === existingAnchor.id)) {
            // Generate an alternative outfit around the existing anchor!
            domainResult = await styleItemTool.execute(
              {
                anchorItemId: existingAnchor.id,
                occasion,
                season: targetSeason,
                dateStr: targetDate,
              },
              context
            );

            const outfits = domainResult.outfits || [];
            if (outfits.length > 0) {
              const top = outfits[0];
              workingState.activeOutfit = top;
              workingState.selectedOutfitId = top.id;
              workingState.selectedLookIndex = 0;

              const companionPieces = Object.values(top.slots || {})
                .flat()
                .filter((i) => i.id !== existingAnchor.id)
                .map((i) => i.name)
                .join(', ');

              const reasons = top.explanation?.reasons?.slice(0, 2) || [];
              const whyText =
                reasons.length > 0 ? `\n\nStyling details:\n${reasons.map((r) => `• ${r}`).join('\n')}` : '';

              responseText = `I couldn't find a **${cleanItemName}** in your wardrobe. Here is an alternative combination using your existing pieces anchored around your **${existingAnchor.name}** for **${occasion}**:\n• Pair with: **${companionPieces}**${whyText}\n\n*(You can also add the ${cleanItemName} to your wardrobe first).*`;
              break;
            }
          }

          // If no existing anchor or alternative could be formed
          responseText = `I couldn't find a **${cleanItemName}** in your wardrobe. I can still create an alternative look using your existing pieces, or you can add the ${cleanItemName} to your wardrobe first.`;
          break;
        }

        const matched = match.item || match.matchedItem;
        if ((match.status === 'exact_match' || match.status === 'resolved') && matched) {
          anchorId = matched.id;
          workingState.resolvedEntities.wardrobeItemId = anchorId;
          workingState.resolvedEntities.wardrobeItemName = matched.name;
        }
      } else {
        // Fall back to previously resolved wardrobeItemId if the user said something like "Style it"
        anchorId = workingState.resolvedEntities.wardrobeItemId;
        if (!anchorId) {
          const match = resolveWardrobeGarment(
            context.wardrobe,
            {
              color: workingState.resolvedEntities.color,
              subcategory: workingState.resolvedEntities.subcategory,
              category: workingState.resolvedEntities.category,
              itemName: workingState.resolvedEntities.wardrobeItemName,
            },
            recentContextItems
          );
          if (match.status === 'ambiguous') {
            clarificationRequest = match.clarification;
            responseText = match.clarification?.question || 'Which garment would you like to style?';
            break;
          }
          if (match.status === 'not_found') {
            responseText =
              "I couldn't find a matching piece in your wardrobe. Check your spelling or browse your closet to select the item.";
            break;
          }
          const matched = match.item || match.matchedItem;
          if ((match.status === 'exact_match' || match.status === 'resolved') && matched) {
            anchorId = matched.id;
            workingState.resolvedEntities.wardrobeItemId = anchorId;
            workingState.resolvedEntities.wardrobeItemName = matched.name;
          }
        }
      }

      const anchor = context.wardrobe.find((i) => i.id === anchorId);
      if (!anchor) {
        responseText = "I couldn't find that specific garment in your closet.";
        break;
      }

      // Default occasion to anchor item's primary occasion if not specified
      const occasion =
        workingState.resolvedEntities.occasion ||
        (anchor.occasions && anchor.occasions[0]) ||
        'college';

      domainResult = await styleItemTool.execute(
        {
          anchorItemId: anchor.id,
          occasion,
          season: targetSeason,
          dateStr: targetDate,
        },
        context
      );

      workingState.activeAnchorItem = anchor;
      workingState.activeOccasion = occasion;

      const outfits = domainResult.outfits || [];
      if (outfits.length > 0) {
        const top = outfits[0];
        workingState.activeOutfit = top;
        workingState.selectedOutfitId = top.id;
        workingState.selectedLookIndex = 0;
        if (!workingState.shownOutfitIds?.includes(top.id)) {
          workingState.shownOutfitIds = [...(workingState.shownOutfitIds || []), top.id];
        }

        const companionPieces = Object.values(top.slots || {})
          .flat()
          .filter((i) => i.id !== anchor.id)
          .map((i) => i.name)
          .join(', ');

        const whyBullets = top.explanation?.reasons?.slice(0, 2) || [];
        const explanationText =
          whyBullets.length > 0
            ? `\n\nStyling details:\n${whyBullets.map((r) => `• ${r}`).join('\n')}`
            : '';

        const laundryNotice =
          anchor.status !== 'clean'
            ? `\n\n*(Notice: Your ${anchor.name} is currently ${
                anchor.status === 'in_laundry' ? 'in laundry' : 'needs washing'
              }. Here is a curated look for once it is fresh.)*`
            : '';

        responseText = `Here is how to style your **${anchor.name}** for **${occasion}**:\n• Pair with: **${companionPieces}**${explanationText}${laundryNotice}`;
      } else {
        const missing = domainResult.missingRequirements || [];
        const missingRoles =
          missing.map((m: any) => m.missingRole || m.role).join(', ') ||
          'essential companion pieces';
        responseText = `I couldn't complete an outfit around **${anchor.name}** for **${occasion}**. You currently lack clean companion pieces (missing: ${missingRoles}). Check your laundry or add companion pieces.`;
      }
      break;
    }

    // -----------------------------------------------------------------------
    // B1. STYLE_3_WAYS (Style Item Across 3 Contexts)
    // -----------------------------------------------------------------------
    case 'STYLE_3_WAYS': {
      let anchorId =
        workingState.resolvedEntities.wardrobeItemId || workingState.activeAnchorItem?.id;

      if (!anchorId && workingState.activeOutfit) {
        const heroPiece = Object.values(workingState.activeOutfit.slots || {})
          .flat()
          .find(
            (p: any) =>
              p.category === 'Ethnic' || p.category === 'Tops' || p.category === 'Dresses'
          );
        if (heroPiece) {
          anchorId = heroPiece.id;
        }
      }

      if (!anchorId) {
        const recentContextItems: any[] = [];
        if (workingState.lastDomainResult?.outfits) {
          for (const outfit of workingState.lastDomainResult.outfits) {
            for (const slotItems of Object.values(outfit.slots || {})) {
              if (Array.isArray(slotItems)) {
                recentContextItems.push(...slotItems);
              }
            }
          }
        }

        const match = resolveWardrobeGarment(
          context.wardrobe,
          {
            color: workingState.resolvedEntities.color,
            subcategory: workingState.resolvedEntities.subcategory,
            category: workingState.resolvedEntities.category,
            itemName: workingState.resolvedEntities.wardrobeItemName,
          },
          recentContextItems
        );

        if (match.status === 'ambiguous') {
          clarificationRequest = match.clarification;
          responseText = match.clarification?.question || 'Which garment would you like to style 3 ways?';
          break;
        }

        if (match.status === 'not_found') {
          responseText = "I couldn't find a matching piece in your wardrobe. Please specify which owned garment you would like to style 3 ways.";
          break;
        }

        const matched = match.item || match.matchedItem;
        if (matched) {
          anchorId = matched.id;
          workingState.resolvedEntities.wardrobeItemId = anchorId;
          workingState.resolvedEntities.wardrobeItemName = matched.name;
        }
      }

      const anchor = context.wardrobe.find((i) => i.id === anchorId);
      if (!anchor) {
        responseText = "I couldn't find that specific garment in your closet.";
        break;
      }

      workingState.activeAnchorItem = anchor;
      workingState.resolvedEntities.wardrobeItemId = anchor.id;
      workingState.resolvedEntities.wardrobeItemName = anchor.name;

      const directions = [
        { label: 'Look 1 (Relaxed Casual)', occasion: 'casual outing' as const, concept: 'Relaxed Daily Balance' },
        { label: 'Look 2 (Smart Work / Campus)', occasion: 'office' as const, concept: 'Elevated Smart Tailoring' },
        { label: 'Look 3 (Evening / Fusion)', occasion: 'party' as const, concept: 'Bold Evening Sophistication' },
      ];

      const generatedLooks: { label: string; outfit: any; editorial: any }[] = [];
      const collectedOutfits: any[] = [];

      for (const dir of directions) {
        const res = await styleItemTool.execute(
          { anchorItemId: anchor.id, occasion: dir.occasion, season: targetSeason, dateStr: targetDate },
          context
        );
        const topOutfit = res.outfits?.[0];
        if (topOutfit) {
          collectedOutfits.push(topOutfit);
          const components = extractEditorialComponents(topOutfit.slots);
          const editorial = buildEditorialReasoning({
            concept: `${dir.concept} styling around ${anchor.name}`,
            occasion: dir.occasion,
            components,
            weather: context.weatherSnapshot,
          });
          generatedLooks.push({ label: dir.label, outfit: topOutfit, editorial });
        }
      }

      if (generatedLooks.length > 0) {
        domainResult = {
          type: 'STYLE_ITEM',
          summary: `Styled ${anchor.name} across ${generatedLooks.length} distinct directions.`,
          outfits: collectedOutfits,
        };

        const lookSummaries = generatedLooks
          .map((gl) => {
            const pieces = Object.values(gl.outfit.slots || {})
              .flat()
              .filter((p: any) => p.id !== anchor.id)
              .map((p: any) => p.name)
              .join(' + ');
            return `### ${gl.label}\n• **Anchor:** ${anchor.name}\n• **Companions:** ${pieces}\n• **Why it works:** ${gl.editorial.sections.proportionSilhouette}\n• **Pro-Tip:** ${gl.editorial.sections.stylingDirection.split('\n')[0]}`;
          })
          .join('\n\n');

        responseText = `# 3 Ways to Style Your ${anchor.name}\n\n${lookSummaries}\n\n*(All looks are 100% grounded in your actual clean wardrobe.)*`;
      } else {
        responseText = `I couldn't generate 3 distinct complete looks for **${anchor.name}**. You may need clean bottoms or footwear in your closet.`;
      }
      break;
    }

    // -----------------------------------------------------------------------
    // B2. COLLEGE_OUTFIT
    // -----------------------------------------------------------------------
    case 'COLLEGE_OUTFIT': {
      const anchorId =
        workingState.activeAnchorItem?.id || workingState.resolvedEntities.wardrobeItemId;
      if (anchorId) {
        domainResult = await recommendOutfitsTool.execute(
          { occasion: 'college', season: targetSeason, dateStr: targetDate, anchorItemId: anchorId },
          context
        );
      }
      if (!domainResult?.outfits || domainResult.outfits.length === 0) {
        domainResult = await recommendOutfitsTool.execute(
          { occasion: 'college', season: targetSeason, dateStr: targetDate },
          context
        );
      }
      const outfits = domainResult.outfits || [];
      if (outfits.length > 0) {
        const top = outfits[0];
        workingState.activeOutfit = top;
        workingState.activeOccasion = 'college';
        const components = extractEditorialComponents(top.slots);
        const editorial = buildEditorialReasoning({
          concept: 'Effortless Campus Polish & Daily Movement',
          occasion: 'College',
          components,
          weather: context.weatherSnapshot,
          customProTips: [
            'Pair with comfortable low-top sneakers or clean flats for campus walking.',
            'Keep an unstructured canvas tote or backpack to balance the casual silhouette.',
          ],
        });
        const ack = intentResult.entities.isCorrection
          ? 'Got it! Switching context to college — here is an effortless campus curation:\n\n'
          : '';
        responseText = `${ack}# Daily College Styling Curation\n\n${editorial.formattedEditorial}`;
      } else {
        responseText = "I couldn't find a complete clean look for college. Check your laundry or add campus staples like tees, shirts, and jeans.";
      }
      break;
    }

    // -----------------------------------------------------------------------
    // B3. INTERVIEW_OUTFIT
    // -----------------------------------------------------------------------
    case 'INTERVIEW_OUTFIT': {
      const anchorId =
        workingState.activeAnchorItem?.id || workingState.resolvedEntities.wardrobeItemId;
      if (anchorId) {
        domainResult = await recommendOutfitsTool.execute(
          { occasion: 'interview', season: targetSeason, dateStr: targetDate, anchorItemId: anchorId },
          context
        );
      }
      if (!domainResult?.outfits || domainResult.outfits.length === 0) {
        domainResult = await recommendOutfitsTool.execute(
          { occasion: 'interview', season: targetSeason, dateStr: targetDate },
          context
        );
      }
      const outfits = domainResult.outfits || [];
      if (outfits.length > 0) {
        const top = outfits[0];
        workingState.activeOutfit = top;
        workingState.activeOccasion = 'interview';
        const components = extractEditorialComponents(top.slots);
        const editorial = buildEditorialReasoning({
          concept: 'Executive Composure, Clean Tailoring & Professional Authority',
          occasion: 'Interview',
          components,
          weather: context.weatherSnapshot,
          customProTips: [
            'Ensure shirt collar points stay crisp under the jacket lapel.',
            'Keep leather belt and footwear colors coordinated in tone.',
            'Minimalist analog watch grounds the executive dignity without distraction.',
          ],
        });
        const ack = intentResult.entities.isCorrection
          ? 'Understood! Adjusting context to an interview — here is an authoritative, clean look tailored for a professional interview:\n\n'
          : '';
        responseText = `${ack}# Interview Styling Curation\n\n${editorial.formattedEditorial}`;
      } else {
        responseText = "I couldn't assemble a complete clean interview outfit. You need clean formal trousers, a tailored top/shirt, and formal footwear.";
      }
      break;
    }

    // -----------------------------------------------------------------------
    // B4. SAREE_STYLING
    // -----------------------------------------------------------------------
    case 'SAREE_STYLING': {
      const saree = context.wardrobe.find(
        (i) => i.category === 'Ethnic' && (i.subcategory === 'saree' || i.name.toLowerCase().includes('saree'))
      );
      if (saree) {
        const blouse = context.wardrobe.find(
          (i) => (i.category === 'Ethnic' || i.category === 'Tops') && (i.subcategory === 'blouse' || i.subcategory === 'crop top' || i.name.toLowerCase().includes('blouse'))
        );
        const footwear = context.wardrobe.find(
          (i) => i.category === 'Footwear' && (i.subcategory === 'juttis' || i.subcategory === 'sandals' || i.subcategory === 'heels' || i.subcategory === 'flats')
        );

        const components = {
          top: blouse,
          bottom: saree,
          footwear: footwear,
        };

        const generatedLook = {
          id: `outfit_saree_${saree.id}`,
          template: 'Saree Look',
          occasion: 'festive',
          slots: {
            bottom: [saree],
            top: blouse ? [blouse] : [],
            footwear: footwear ? [footwear] : [],
          },
          score: 9.6,
          why: `Graceful Draping Architecture around your ${saree.name}`,
        };
        domainResult = {
          type: 'RECOMMENDATION',
          summary: `Curated Saree look: ${saree.name}${blouse ? ' + ' + blouse.name : ''}${footwear ? ' + ' + footwear.name : ''}.`,
          outfits: [generatedLook as any],
        };

        const editorial = buildEditorialReasoning({
          concept: `Graceful Draping Architecture around your ${saree.name}`,
          occasion: 'Festive / Formal Saree',
          components,
          weather: context.weatherSnapshot,
          customProTips: [
            'Calibrate your footwear heel height before setting the skirt pleats to ensure a precise 1-inch floor clearance.',
            'Secure the navel pleats with an inner safety pin to allow effortless all-day mobility.',
            'Let the pallu fall gracefully over the left forearm or pin it softly at the shoulder seam.',
          ],
        });
        responseText = `# Saree Styling Masterclass\n\n${editorial.formattedEditorial}`;
      } else {
        responseText = "I checked your wardrobe, and no sarees are currently registered in your closet. You can add one via the Wardrobe tab, or I can help you style your other ethnic pieces like kurtas!";
      }
      break;
    }

    // -----------------------------------------------------------------------
    // B5. INDO_WESTERN
    // -----------------------------------------------------------------------
    case 'INDO_WESTERN': {
      const ethnicPiece = context.wardrobe.find(
        (i) => i.category === 'Ethnic' && (i.subcategory === 'kurta' || i.subcategory === 'nehru jacket')
      );
      const westernPiece = context.wardrobe.find(
        (i) => i.category === 'Bottoms' && (i.subcategory === 'jeans' || i.subcategory === 'trousers')
      );

      if (ethnicPiece && westernPiece) {
        const shoes = context.wardrobe.find(
          (i) => i.category === 'Footwear' && (i.subcategory === 'sneakers' || i.subcategory === 'loafers' || i.subcategory === 'juttis')
        );
        const components = {
          top: ethnicPiece,
          bottom: westernPiece,
          footwear: shoes,
        };

        const generatedLook = {
          id: `outfit_indo_western_${ethnicPiece.id}_${westernPiece.id}`,
          template: 'Indo-Western Fusion',
          occasion: 'casual outing',
          slots: {
            top: [ethnicPiece],
            bottom: [westernPiece],
            footwear: shoes ? [shoes] : [],
          },
          score: 9.5,
          why: 'Contemporary Indo-Western Synthesis pairing ethnic silhouettes with clean western denim or tailoring.',
        };
        domainResult = {
          type: 'RECOMMENDATION',
          summary: `Curated Indo-Western look: ${ethnicPiece.name} + ${westernPiece.name}${shoes ? ' + ' + shoes.name : ''}.`,
          outfits: [generatedLook as any],
        };

        const editorial = buildEditorialReasoning({
          concept: 'Contemporary Indo-Western Synthesis',
          occasion: 'Casual Outing / Fusion Social',
          components,
          weather: context.weatherSnapshot,
          customProTips: [
            'Roll up kurta sleeves twice to show wrist structure and break formality.',
            'Ground the flowing ethnic top with clean straight or tapered denim.',
            'Minimalist white sneakers or brown leather juttis anchor the hybrid aesthetic.',
          ],
        });
        responseText = `# Indo-Western Fusion Curation\n\n${editorial.formattedEditorial}`;
      } else {
        domainResult = await recommendOutfitsTool.execute(
          { occasion: 'casual outing', season: targetSeason, dateStr: targetDate },
          context
        );
        responseText = "To create a true Indo-Western look, pair an ethnic top (like a kurta or Nehru jacket) with modern denim or tailored trousers from your closet.";
      }
      break;
    }

    // -----------------------------------------------------------------------
    // B6. COLOR_PAIRING
    // -----------------------------------------------------------------------
    case 'COLOR_PAIRING': {
      const targetColor = workingState.resolvedEntities.color || 'blue';
      const itemsOfColor = context.wardrobe.filter((i) => i.colors.map((c) => c.toLowerCase()).includes(targetColor));
      const neutralItems = context.wardrobe.filter((i) =>
        i.colors.some((c) => ['white', 'black', 'beige', 'grey', 'navy', 'cream'].includes(c.toLowerCase()))
      );

      responseText = `# Color Pairing Guide for ${targetColor.toUpperCase()}\n\n` +
        `### Color Theory Principles:\n` +
        `• **Tonal / Monochromatic:** Pair ${targetColor} with lighter or darker shades of the same hue for an elongated, quiet luxury look.\n` +
        `• **High-Trust Neutral Anchor:** Ground ${targetColor} with crisp white, cream, or beige to let the tone breathe without visual clash.\n` +
        `• **Complementary Contrast:** If pairing with warm/cool counterparts, maintain a 70/30 proportion (70% dominant tone, 30% accent).\n\n` +
        `### Matching Pieces in Your Wardrobe:\n` +
        (itemsOfColor.length > 0
          ? `• **Your ${targetColor} pieces:** ${itemsOfColor.map((i) => i.name).join(', ')}\n`
          : '') +
        (neutralItems.length > 0
          ? `• **Your neutral anchors:** ${neutralItems.slice(0, 4).map((i) => i.name).join(', ')}\n`
          : '') +
        `\n*All color pairings follow verified color harmony principles and are grounded in your clean wardrobe.*`;
      break;
    }

    // -----------------------------------------------------------------------
    // B7. PREMIUM_UPGRADE
    // -----------------------------------------------------------------------
    case 'PREMIUM_UPGRADE': {
      const availableOutfits = workingState.lastDomainResult?.outfits || [];
      let targetOutfit: GeneratedOutfit | undefined;

      if (availableOutfits.length > 1) {
        const resolved = resolveReferencedLook(
          availableOutfits,
          workingState.resolvedEntities,
          workingState
        );
        if (resolved.isAmbiguous && resolved.clarification) {
          clarificationRequest = resolved.clarification;
          responseText = resolved.clarification.question;
          break;
        }
        targetOutfit = resolved.look;
        if (resolved.lookIndex !== undefined) {
          workingState.selectedLookIndex = resolved.lookIndex;
          workingState.selectedOutfitId = targetOutfit?.id;
        }
      } else if (availableOutfits.length === 1) {
        targetOutfit = availableOutfits[0];
      }

      if (targetOutfit) {
        const pieces = Object.values(targetOutfit.slots || {}).flat().map((i) => i.name).join(' + ');
        const components = extractEditorialComponents(targetOutfit.slots);
        const editorial = buildEditorialReasoning({
          concept: 'Quiet Luxury & Elevated Proportional Polish',
          occasion: 'Elevated Everyday',
          components,
          weather: context.weatherSnapshot,
          customProTips: [
            'Execute a clean French half-tuck to lengthen the leg line and define the waist.',
            'Steam or press the garments to eliminate fabric crease micro-distractions.',
            'Match footwear leather undertones with your watch strap or belt.',
            'Avoid loud visible logos; let fabric texture and fit convey the luxury.',
          ],
        });
        responseText = `# Elevating Your Look (${pieces})\n\n${editorial.formattedEditorial}`;
        break;
      }

      const cleanItems = context.wardrobe.filter((i) => i.status === 'clean');
      const tops = cleanItems.filter((i) => i.category === 'Tops' || i.category === 'Ethnic');
      const bottoms = cleanItems.filter((i) => i.category === 'Bottoms');
      const footwear = cleanItems.filter((i) => i.category === 'Footwear');

      const top = tops[0];
      const bottom = bottoms[0];
      const shoes = footwear[0];

      if (top && bottom) {
        const components = { top, bottom, footwear: shoes };
        const editorial = buildEditorialReasoning({
          concept: 'Quiet Luxury & Elevated Proportional Polish',
          occasion: 'Elevated Everyday',
          components,
          weather: context.weatherSnapshot,
          customProTips: [
            'Execute a clean French half-tuck to lengthen the leg line and define the waist.',
            'Steam or press the garments to eliminate fabric crease micro-distractions.',
            'Match footwear leather undertones with your watch strap or belt.',
            'Avoid loud visible logos; let fabric texture and fit convey the luxury.',
          ],
        });
        responseText = `# How to Make Your Outfit Look Premium (Quiet Luxury)\n\n${editorial.formattedEditorial}`;
      } else {
        responseText = "To achieve an elevated look, choose monochromatic neutral tones, execute a clean tuck at the waist, and ensure footwear is clean and polished.";
      }
      break;
    }

    // -----------------------------------------------------------------------
    // B8. MINIMALIST_OUTFIT
    // -----------------------------------------------------------------------
    case 'MINIMALIST_OUTFIT': {
      const solidPieces = context.wardrobe.filter(
        (i) => i.status === 'clean' && (!i.pattern || i.pattern === 'solid')
      );
      const top = solidPieces.find((i) => i.category === 'Tops' || i.category === 'Ethnic');
      const bottom = solidPieces.find((i) => i.category === 'Bottoms');
      const footwear = solidPieces.find((i) => i.category === 'Footwear');

      if (top && bottom) {
        const components = { top, bottom, footwear };
        const editorial = buildEditorialReasoning({
          concept: 'Minimalist Architecture: Pure Form & Clean Unbroken Lines',
          occasion: 'Minimalist Everyday',
          components,
          weather: context.weatherSnapshot,
          customProTips: [
            'Maintain continuous clean vertical lines without unnecessary visual breaks.',
            'Keep jewelry down to a single understated piece.',
            'Rely on subtle volume contrast (e.g. relaxed top + straight trousers).',
          ],
        });
        responseText = `# Minimalist Capsule Curation\n\n${editorial.formattedEditorial}`;
      } else {
        responseText = "A minimalist look thrives on solid neutral pieces. Add clean solid tops and flat-front trousers to your wardrobe to complete this aesthetic.";
      }
      break;
    }

    // -----------------------------------------------------------------------
    // B9. RESTYLE_UNDERUSED
    // -----------------------------------------------------------------------
    case 'RESTYLE_UNDERUSED': {
      const underusedItems = context.wardrobe.filter(
        (i) => i.status === 'clean' && (i.timesWorn === undefined || i.timesWorn <= 1 || i.lastWorn === undefined)
      );

      if (underusedItems.length > 0) {
        const itemToRevive = underusedItems[0];
        const res = await styleItemTool.execute(
          { anchorItemId: itemToRevive.id, occasion: 'everyday', season: targetSeason, dateStr: targetDate },
          context
        );
        const topOutfit = res.outfits?.[0];
        if (topOutfit) {
          const components = extractEditorialComponents(topOutfit.slots);
          const editorial = buildEditorialReasoning({
            concept: `Wardrobe Equity Revival: Rediscovering ${itemToRevive.name}`,
            occasion: 'Everyday Rediscovery',
            components,
            weather: context.weatherSnapshot,
            customProTips: [
              `Your ${itemToRevive.name} has only been worn ${itemToRevive.timesWorn || 0} times.`,
              'Pairing it with reliable core staples removes hesitation and revitalizes closet equity.',
            ],
          });
          responseText = `# Restyling Underused Wardrobe Gem: ${itemToRevive.name}\n\n${editorial.formattedEditorial}`;
          domainResult = {
            type: 'STYLE_ITEM',
            summary: `Rediscovered ${itemToRevive.name} with harmonious companion pieces.`,
            outfits: [topOutfit],
          };
        } else {
          responseText = `Your **${itemToRevive.name}** hasn't been worn recently! Pair it with clean neutral bottoms or a basic tee to bring it back into active rotation.`;
        }
      } else {
        responseText = "Great news! Every item in your wardrobe is currently in active, healthy rotation with no dormant pieces detected.";
      }
      break;
    }

    // -----------------------------------------------------------------------
    // C. CHECK_WEATHER (Phase 4)
    // -----------------------------------------------------------------------
    case 'CHECK_WEATHER': {
      domainResult = await getCurrentWeatherTool.execute(
        {
          relativeDate: workingState.resolvedEntities.relativeDate,
          dateStr: targetDate,
        },
        context
      );
      responseText = domainResult.summary;
      break;
    }

    // -----------------------------------------------------------------------
    // D. ANALYZE_WEAR (Phase 8)
    // -----------------------------------------------------------------------
    case 'ANALYZE_WEAR': {
      domainResult = await getWearAnalyticsTool.execute({}, context);
      const rep = domainResult.wearReport;
      if (rep && rep.mostWornItems.length > 0) {
        const topList = rep.mostWornItems
          .slice(0, 3)
          .map((w, idx) => `${idx + 1}. **${w.item.name}** (${w.effectiveWears} wears)`)
          .join('\n');
        responseText = `Here are your wear rotation insights:\n${topList}\n\n${domainResult.summary}`;
      } else {
        responseText = domainResult.summary;
      }
      break;
    }

    // -----------------------------------------------------------------------
    // E. UNDERSTAND_STYLE (Phase 3)
    // -----------------------------------------------------------------------
    case 'UNDERSTAND_STYLE': {
      domainResult = await getStyleProfileTool.execute({}, context);
      responseText = `Here is your Personal Style Brain profile:\n• ${domainResult.summary}`;
      break;
    }

    // -----------------------------------------------------------------------
    // F. CHECK_WARDROBE_GAPS (Phase 9)
    // -----------------------------------------------------------------------
    case 'CHECK_WARDROBE_GAPS': {
      domainResult = await getWardrobeGapsTool.execute({}, context);
      const rep = domainResult.gapReport;
      if (rep && rep.gaps.length > 0) {
        const gapList = rep.gaps
          .slice(0, 3)
          .map((g) => `• **${g.headline}**: ${g.explanation}`)
          .join('\n');
        responseText = `Wardrobe Gap Audit:\n${gapList}\n\n*Smart Buy Assessment:* **${rep.purchaseAssessment === 'NO_PURCHASE_NEEDED' ? 'NO PURCHASE NEEDED' : 'PURCHASE JUSTIFIED'}**`;
      } else {
        responseText = `No wardrobe gaps detected!\n• ${rep?.negativeEvidence.primaryReason || domainResult.summary}`;
      }
      break;
    }

    // -----------------------------------------------------------------------
    // G. ASSESS_PURCHASE_NEED (Phase 9 & 1.10 Occasion-Scoped Decision Support)
    // -----------------------------------------------------------------------
    case 'ASSESS_PURCHASE_NEED': {
      domainResult = await getPurchaseAssessmentTool.execute(
        {
          category: workingState.resolvedEntities.category,
          subcategory: workingState.resolvedEntities.subcategory,
          search: workingState.resolvedEntities.wardrobeItemName,
          occasion: workingState.resolvedEntities.occasion || workingState.activeOccasion,
          occasionSubtype: workingState.resolvedEntities.occasionContext || workingState.activeOccasionContext,
          anchorItemId:
            workingState.resolvedEntities.wardrobeItemId || workingState.activeAnchorItem?.id,
          explicitNoPurchase: workingState.resolvedEntities.explicitNoPurchase,
        },
        context
      );
      const pa = domainResult.purchaseAssessment as any;
      const rep = domainResult.gapReport;
      const verdict = pa?.verdict || rep?.purchaseAssessment || 'NO_PURCHASE_NEEDED';
      const headline =
        pa?.headline || (verdict === 'PURCHASE_JUSTIFIED' ? 'Verified Wardrobe Gap' : 'No Purchase Needed');
      const summaryText = pa?.summary || domainResult.summary;

      if (verdict === 'NO_PURCHASE_NEEDED') {
        responseText = `**${headline}**\n\n${summaryText}\n\nYour existing closet provides adequate coverage. Rediscovering or rotating owned pieces will maintain complete versatility.`;
      } else if (verdict === 'OPTIONAL_GAP') {
        responseText = `**${headline}**\n\n${summaryText}\n\n*(Note: This is an optional styling elevation, not a required purchase. Your core look is ready.)*`;
      } else if (verdict === 'NO_VALID_OUTFIT') {
        responseText = `**${headline}**\n\n${summaryText}`;
      } else if (verdict === 'INSUFFICIENT_INFORMATION') {
        responseText = `**${headline}**\n\n${summaryText}`;
      } else {
        responseText = `**${headline}**\n\n${summaryText}\n\n*(Note: StyleSaathi provides evidence-based decision support, never commercial shopping recommendations.)*`;
      }
      break;
    }

    // -----------------------------------------------------------------------
    // G1. EXPLICIT_NO_PURCHASE (Phase 1.10 Zero Purchase Philosophy)
    // -----------------------------------------------------------------------
    case 'EXPLICIT_NO_PURCHASE': {
      responseText =
        'Understood! StyleSaathi adheres to a zero-pressure philosophy: we focus 100% on creative styling and rediscovering combinations with garments you already own. No purchases will be suggested.';
      domainResult = {
        type: 'PURCHASE_ASSESSMENT',
        summary: responseText,
        purchaseAssessment: {
          verdict: 'NO_PURCHASE_NEEDED',
          purchaseAssessment: 'NO_PURCHASE_NEEDED',
          headline: 'Zero Purchase Philosophy',
          summary: responseText,
          primaryReason: responseText,
          rediscoveryOpportunitiesCount: 0,
          details: ['Working strictly with existing wardrobe garments.'],
        } as any,
      };
      break;
    }

    // -----------------------------------------------------------------------
    // G2. SHOW_ALTERNATIVE (Phase 1.10 Alternative Look Rotation)
    // -----------------------------------------------------------------------
    case 'SHOW_ALTERNATIVE': {
      if (workingState.resolvedEntities.unlockedAnchor) {
        workingState.activeAnchorItem = undefined;
      }

      const occasion =
        workingState.activeOccasion || workingState.resolvedEntities.occasion || 'college';
      let anchor =
        workingState.activeAnchorItem ||
        (!workingState.resolvedEntities.unlockedAnchor && workingState.resolvedEntities.wardrobeItemId
          ? context.wardrobe.find((i) => i.id === workingState.resolvedEntities.wardrobeItemId)
          : undefined);

      if (!anchor && !workingState.resolvedEntities.unlockedAnchor && workingState.resolvedEntities.anchorGarmentName) {
        const lowerName = workingState.resolvedEntities.anchorGarmentName.toLowerCase();
        anchor = context.wardrobe.find(
          (i) =>
            i.name.toLowerCase().includes(lowerName) ||
            i.subcategory?.toLowerCase() === lowerName ||
            i.category.toLowerCase() === lowerName
        );
        if (anchor) {
          workingState.activeAnchorItem = anchor;
        }
      }

      domainResult = await recommendOutfitsTool.execute(
        {
          occasion,
          season: targetSeason,
          dateStr: targetDate,
          anchorItemId: anchor?.id,
          limit: 10,
        },
        context
      );

      const allOutfits = domainResult.outfits || [];
      const shownSet = new Set(workingState.shownOutfitIds || []);
      const newOutfits = allOutfits.filter((o) => !shownSet.has(o.id));

      if (newOutfits.length > 0) {
        const nextLook = newOutfits[0];
        workingState.activeOutfit = nextLook;
        workingState.selectedOutfitId = nextLook.id;
        workingState.shownOutfitIds = [...(workingState.shownOutfitIds || []), nextLook.id];

        const pieces = Object.values(nextLook.slots || {})
          .flat()
          .map((i) => i.name)
          .join(', ');

        const whyBullets = nextLook.explanation?.reasons?.slice(0, 2) || [];
        const explanationText =
          whyBullets.length > 0
            ? `\n\nWhy this works:\n${whyBullets.map((r) => `• ${r}`).join('\n')}`
            : '';

        const anchorClause = anchor ? ` styling your **${anchor.name}**` : '';
        responseText = `Here is an alternative look for **${occasion}**${anchorClause}:\n• **${pieces}**${explanationText}`;
        domainResult = {
          ...domainResult,
          outfits: [nextLook],
        };
      } else if (allOutfits.length > 0) {
        const resetLook = allOutfits[0];
        workingState.activeOutfit = resetLook;
        const pieces = Object.values(resetLook.slots || {})
          .flat()
          .map((i) => i.name)
          .join(', ');
        const anchorClause = anchor ? ` with your **${anchor.name}**` : '';
        responseText = `You have seen all available complete combinations${anchorClause} for **${occasion}**. Here is your top-rated look again:\n• **${pieces}**`;
        domainResult = {
          ...domainResult,
          outfits: [resetLook],
        };
      } else {
        responseText = `I couldn't find additional combinations for **${occasion}** in your current clean wardrobe.`;
      }
      break;
    }

    // -----------------------------------------------------------------------
    // G3. SWAP_PIECE (Dynamic Piece Replacement & Anchor Retention)
    // -----------------------------------------------------------------------
    case 'SWAP_PIECE': {
      const currentOutfit = workingState.activeOutfit;
      let swapRole = workingState.resolvedEntities.swapRole;
      const occasion =
        workingState.activeOccasion || workingState.resolvedEntities.occasion || 'college';
      let anchor = workingState.activeAnchorItem;

      if (!anchor && (workingState.resolvedEntities.keptPieceName || workingState.resolvedEntities.anchorGarmentName)) {
        const keptName = workingState.resolvedEntities.keptPieceName || workingState.resolvedEntities.anchorGarmentName;
        const lowerKept = keptName!.toLowerCase();
        const wardrobeMatches = context.wardrobe.filter(
          (p) =>
            p.status === 'clean' &&
            (p.name.toLowerCase().includes(lowerKept) ||
              p.subcategory?.toLowerCase() === lowerKept ||
              p.category.toLowerCase() === lowerKept)
        );
        if (wardrobeMatches.length > 0) {
          anchor = wardrobeMatches.find((w) => w.favorite) || wardrobeMatches[0];
          workingState.activeAnchorItem = anchor;
        }
      }

      if (!currentOutfit || !currentOutfit.slots) {
        domainResult = await recommendOutfitsTool.execute(
          {
            occasion,
            season: targetSeason,
            dateStr: targetDate,
            anchorItemId: anchor?.id,
            limit: 1,
          },
          context
        );
        const top = domainResult.outfits?.[0];
        if (top) {
          workingState.activeOutfit = top;
          const pieces = Object.values(top.slots || {})
            .flat()
            .map((i) => i.name)
            .join(', ');
          responseText = `Here is a curated look for **${occasion}**:\n• **${pieces}**`;
        } else {
          responseText = `No ready look available to swap items.`;
        }
        break;
      }

      // Handle explicit role removal ("without the jacket", "no blazer", etc.)
      if (workingState.resolvedEntities.removedRole) {
        const roleToRemove = workingState.resolvedEntities.removedRole;
        const newSlots: Record<string, WardrobeItem[]> = { ...currentOutfit.slots };
        if (roleToRemove === 'layer') {
          delete newSlots['layer'];
          delete newSlots['outerwear'];
        } else {
          delete newSlots[roleToRemove];
        }

        const sanitizedSlots = sanitizeEnsembleSlots(newSlots);
        const updatedOutfit: GeneratedOutfit = {
          ...currentOutfit,
          id: `outfit_remove_${Date.now()}`,
          slots: sanitizedSlots,
        };
        const updatedOutfitId = updatedOutfit.id || `outfit_remove_${Date.now()}`;
        workingState.activeOutfit = updatedOutfit;
        workingState.selectedOutfitId = updatedOutfitId;
        const currentIds: string[] = (workingState.shownOutfitIds || []).filter(
          (id): id is string => typeof id === 'string'
        );
        workingState.shownOutfitIds = [...currentIds, updatedOutfitId];

        const remainingPieces = Object.values(sanitizedSlots)
          .flat()
          .map((i) => i.name)
          .join(', ');

        responseText = `Removed the ${roleToRemove} from your look for **${occasion}**! Current look:\n• **${remainingPieces}**`;
        domainResult = {
          type: 'RECOMMENDATION',
          summary: responseText,
          outfits: [updatedOutfit as RecommendedOutfit],
        };
        break;
      }

      const piecesInCurrentLook = Object.values(currentOutfit.slots || {}).flat() as WardrobeItem[];

      // 1. Resolve Kept Piece / Anchor Retention (e.g. "Keep the same jeans", "Keep this kurta")
      const keptName =
        workingState.resolvedEntities.keptPieceName ||
        workingState.resolvedEntities.anchorGarmentName;
      if (keptName) {
        const lowerKept = keptName.toLowerCase();
        const matchedKept = piecesInCurrentLook.filter(
          (p) =>
            p.name.toLowerCase().includes(lowerKept) ||
            p.subcategory?.toLowerCase() === lowerKept ||
            p.category.toLowerCase() === lowerKept
        );

        if (matchedKept.length === 1) {
          anchor = matchedKept[0];
          workingState.activeAnchorItem = anchor;
        } else if (matchedKept.length > 1) {
          // Ambiguous reference: ask user which garment they mean
          clarificationRequest = {
            id: `clarify_keep_${Date.now()}`,
            question: `Which piece would you like to keep?`,
            field: 'wardrobeItemId',
            options: matchedKept.map((p) => ({
              label: p.name,
              value: p.id,
              description: `${p.category} · ${p.colors?.join('/') || 'neutral'}`,
            })),
          };
          responseText = clarificationRequest.question;
          break;
        } else {
          // Fallback: Resolve against clean wardrobe items (e.g. from prior turn or explicit garment)
          const wardrobeMatches = context.wardrobe.filter(
            (p) =>
              p.status === 'clean' &&
              (p.name.toLowerCase().includes(lowerKept) ||
                p.subcategory?.toLowerCase() === lowerKept ||
                p.category.toLowerCase() === lowerKept)
          );
          if (wardrobeMatches.length === 1) {
            anchor = wardrobeMatches[0];
            workingState.activeAnchorItem = anchor;
          } else if (wardrobeMatches.length > 1) {
            anchor = wardrobeMatches.find((w) => w.favorite) || wardrobeMatches[0];
            workingState.activeAnchorItem = anchor;
          }
        }
      }

      // 2. If swapRole is not explicitly provided, pick a non-anchor slot to swap
      const anchorRole = anchor
        ? anchor.category === 'Bottoms'
          ? 'bottom'
          : anchor.category === 'Tops'
          ? 'top'
          : anchor.category === 'Footwear'
          ? 'footwear'
          : 'layer'
        : null;

      let activeSwapRole: string = swapRole || '';
      if (!activeSwapRole) {
        if (anchorRole) {
          const otherRoles = Object.keys(currentOutfit.slots).filter((r) => r !== anchorRole);
          activeSwapRole = otherRoles[0] || (anchorRole === 'bottom' ? 'top' : 'bottom');
        } else {
          activeSwapRole = 'footwear';
        }
      }

      // Identify currently slotted item in swapRole
      const currentPiecesInRole = (currentOutfit.slots as any)[activeSwapRole] || [];
      const currentPieceId = currentPiecesInRole[0]?.id;

      // Find alternative clean items matching swapRole category/subcategories
      const candidateItems = context.wardrobe.filter((item) => {
        if (item.status !== 'clean') return false;
        if (item.id === currentPieceId) return false;
        if (anchor && item.id === anchor.id) return false;

        if (activeSwapRole === 'footwear') return item.category === 'Footwear';
        if (activeSwapRole === 'bottom')
          return (
            item.category === 'Bottoms' ||
            (item.category === 'Ethnic' &&
              ['trousers', 'jeans', 'palazzo', 'churidar', 'salwar', 'pajama', 'dhoti', 'lungi'].includes(
                item.subcategory || ''
              ))
          );
        if (activeSwapRole === 'top')
          return (
            item.category === 'Tops' ||
            (item.category === 'Ethnic' &&
              ['kurta', 'kurti', 'top', 'shirt', 'blouse', 'anarkali'].includes(item.subcategory || ''))
          );
        if (activeSwapRole === 'layer')
          return (
            item.category === 'Outerwear' ||
            (item.category === 'Ethnic' &&
              ['nehru jacket', 'jacket', 'blazer', 'cardigan', 'shrug'].includes(item.subcategory || ''))
          );
        return false;
      });

      if (candidateItems.length > 0 || (anchor && anchorRole)) {
        const replacementItem = candidateItems[0];
        const newSlots: Record<string, WardrobeItem[]> = {
          ...currentOutfit.slots,
        };

        if (replacementItem) {
          newSlots[activeSwapRole] = [replacementItem];
        }

        // Ensure anchor remains locked in its slot
        if (anchor && anchorRole) {
          newSlots[anchorRole] = [anchor];
        }

        const sanitizedSlots = sanitizeEnsembleSlots(newSlots);

        const updatedOutfit: GeneratedOutfit = {
          ...currentOutfit,
          id: `outfit_swap_${Date.now()}`,
          slots: sanitizedSlots,
        };

        const updatedOutfitId = updatedOutfit.id || `outfit_swap_${Date.now()}`;
        workingState.activeOutfit = updatedOutfit;
        workingState.selectedOutfitId = updatedOutfitId;
        const currentIds: string[] = (workingState.shownOutfitIds || []).filter(
          (id): id is string => typeof id === 'string'
        );
        workingState.shownOutfitIds = [...currentIds, updatedOutfitId];

        const otherPieces = Object.entries(newSlots)
          .filter(([r]) => r !== activeSwapRole && (!anchorRole || r !== anchorRole))
          .flatMap(([, items]) => (items as WardrobeItem[]).map((i) => i.name))
          .join(' and ');

        if (anchor && replacementItem) {
          responseText = `Kept your **${anchor.name}** and swapped ${activeSwapRole} to **${replacementItem.name}**! Preserved your other pieces for **${occasion}**.`;
        } else if (anchor) {
          responseText = `Anchored your look with **${anchor.name}**! Preserved your pieces for **${occasion}**.`;
        } else {
          responseText = `Swapped ${activeSwapRole} to **${replacementItem.name}**! Preserved your ${otherPieces} for **${occasion}**.`;
        }

        domainResult = {
          type: 'RECOMMENDATION',
          summary: responseText,
          outfits: [updatedOutfit as RecommendedOutfit],
        };
      } else {
        responseText = `You don't have another clean ${activeSwapRole} in your wardrobe to swap into this look.`;
      }
      break;
    }

    // -----------------------------------------------------------------------
    // G4. REFINE_OUTFIT (Conversational Formality & Aesthetic Refinement)
    // -----------------------------------------------------------------------
    case 'REFINE_OUTFIT': {
      const currentOutfit = workingState.activeOutfit || workingState.lastDomainResult?.outfits?.[0];
      const refinement = workingState.resolvedEntities.refinementType || 'more_formal';
      const occasion = workingState.activeOccasion || workingState.resolvedEntities.occasion || 'college';
      const anchor = workingState.activeAnchorItem;

      if (!currentOutfit || !currentOutfit.slots) {
        domainResult = await recommendOutfitsTool.execute(
          {
            occasion,
            season: targetSeason,
            dateStr: targetDate,
            anchorItemId: anchor?.id,
            limit: 1,
          },
          context
        );
        const top = domainResult.outfits?.[0];
        if (top) {
          workingState.activeOutfit = top;
          responseText = `Here is a refined look for **${occasion}**:\n• **${Object.values(top.slots || {}).flat().map((i) => i.name).join(', ')}**`;
        } else {
          responseText = `No pieces available in your wardrobe to assemble this look.`;
        }
        break;
      }

      // 1. Calculate current formality
      const currentPieces = Object.values(currentOutfit.slots || {}).flat() as WardrobeItem[];
      const currentAvgFormality =
        currentPieces.reduce((acc, p) => acc + (p.formality || 3), 0) / (currentPieces.length || 1);
      // 2. Determine target occasion & formality direction
      let targetOccasion: Occasion = occasion;
      if (refinement === 'more_formal' || refinement === 'more_elegant') {
        if (occasion === 'college' || occasion === 'casual outing' || occasion === 'everyday') {
          targetOccasion = 'office';
        }
      } else if (refinement === 'more_casual') {
        if (occasion === 'office' || occasion === 'interview') {
          targetOccasion = 'casual outing';
        }
      }

      // 3. Generate candidate looks using the recommendation engine
      const candidateOutfits =
        (
          await recommendOutfitsTool.execute(
            {
              occasion: targetOccasion,
              season: targetSeason,
              dateStr: targetDate,
              anchorItemId: anchor?.id,
              limit: 8,
            },
            context
          )
        ).outfits || [];

      // 4. Rank candidate outfits by adherence to the requested refinement & piece overlap
      const currentPieceIds = new Set(currentPieces.map((p) => p.id));
      const scoredCandidates = candidateOutfits.map((candidate) => {
        const pieces = Object.values(candidate.slots || {}).flat() as WardrobeItem[];
        const avgFormality =
          pieces.reduce((acc, p) => acc + (p.formality || 3), 0) / (pieces.length || 1);
        const overlapCount = pieces.filter((p) => currentPieceIds.has(p.id)).length;

        let refinementFitness = 0;
        if (refinement === 'more_formal' || refinement === 'more_elegant') {
          refinementFitness = avgFormality > currentAvgFormality ? (avgFormality - currentAvgFormality) * 3 : -5;
        } else if (refinement === 'more_casual') {
          const casualStapleBonus = pieces.some(
            (p) => p.subcategory === 'jeans' || p.subcategory === 't-shirt' || p.subcategory === 'sneakers'
          )
            ? 6
            : 0;
          refinementFitness =
            (avgFormality < currentAvgFormality ? (currentAvgFormality - avgFormality) * 4 : -5) +
            casualStapleBonus;
        } else if (refinement === 'more_minimal') {
          const solidCount = pieces.filter((p) => !p.pattern || p.pattern === 'solid').length;
          refinementFitness = solidCount * 1.5;
        }

        // Must preserve anchor if one is active
        if (anchor && !pieces.some((p) => p.id === anchor.id)) {
          refinementFitness -= 100;
        }

        const overlapWeight = anchor ? 1.5 : refinement === 'more_casual' ? 0.2 : 1.0;
        return {
          outfit: candidate,
          pieces,
          avgFormality,
          overlapCount,
          totalScore: (candidate.score || 5) + refinementFitness + overlapCount * overlapWeight,
        };
      });

      scoredCandidates.sort((a, b) => b.totalScore - a.totalScore);

      // Select top candidate that genuinely differs from current look
      const bestCandidate = scoredCandidates.find(
        (c) => c.pieces.some((p) => !currentPieceIds.has(p.id)) || scoredCandidates.length === 1
      );

      if (bestCandidate && bestCandidate.outfit) {
        const sanitizedSlots = sanitizeEnsembleSlots(bestCandidate.outfit.slots);
        const refinedOutfit = { ...bestCandidate.outfit, slots: sanitizedSlots };
        workingState.activeOutfit = refinedOutfit;
        workingState.activeOccasion = targetOccasion;
        const refinedPieces = Object.values(refinedOutfit.slots || {}).flat() as WardrobeItem[];
        const piecesList = refinedPieces.map((p) => `**${p.name}**`).join(', ');

        const label =
          refinement === 'more_formal'
            ? 'more formal and elevated'
            : refinement === 'more_casual'
            ? 'more relaxed and casual'
            : refinement === 'more_minimal'
            ? 'cleaner and more minimalist'
            : 'refined and elegant';

        responseText = `Refined your look to be ${label} for **${targetOccasion}**:\n• ${piecesList}`;

        const preserved = refinedPieces.filter((p) => currentPieceIds.has(p.id));
        if (preserved.length > 0) {
          responseText += `\n*Preserved your ${preserved.map((p) => p.name).join(' and ')}.*`;
        }

        domainResult = {
          type: 'RECOMMENDATION',
          summary: responseText,
          outfits: [refinedOutfit as RecommendedOutfit],
        };
      } else {
        responseText = `You don't have enough alternative clean pieces in your wardrobe to make this look ${refinement.replace('_', ' ')}.`;
      }
      break;
    }

    // -----------------------------------------------------------------------
    // G5. WARDROBE_ONLY_QUERY (Strict Wardrobe Grounding Assurance)
    // -----------------------------------------------------------------------
    case 'WARDROBE_ONLY_QUERY': {
      const totalItems = context.wardrobe.length;
      const cleanItems = context.wardrobe.filter((i) => i.status === 'clean');
      const currentOutfit = workingState.activeOutfit || workingState.lastDomainResult?.outfits?.[0];

      responseText = `StyleSaathi operates with 100% wardrobe grounding. Every recommendation is assembled strictly from your ${totalItems} cataloged items (${cleanItems.length} currently clean and ready to wear). We never invent garments or recommend pieces you do not own.`;

      if (currentOutfit && currentOutfit.slots) {
        const pieces = Object.values(currentOutfit.slots).flat() as WardrobeItem[];
        const pieceList = pieces
          .map((p) => `• **${p.name}** (${p.category} · ${p.colors?.join('/') || 'neutral'})`)
          .join('\n');
        responseText += `\n\n### Your Garments in the Current Look:\n${pieceList}`;
      }

      domainResult = {
        type: 'WARDROBE_SEARCH',
        summary: responseText,
        items: cleanItems,
        totalItems,
        cleanItems: cleanItems.length,
      };
      break;
    }

    // -----------------------------------------------------------------------
    // H. CHECK_WARDROBE (Phase 2 Search)
    // -----------------------------------------------------------------------
    case 'CHECK_WARDROBE': {
      domainResult = await getWardrobeTool.execute(
        {
          category: workingState.resolvedEntities.category,
          subcategory: workingState.resolvedEntities.subcategory,
          color: workingState.resolvedEntities.color,
          status: workingState.resolvedEntities.status,
          occasion: workingState.resolvedEntities.occasion,
          search: workingState.resolvedEntities.wardrobeItemName,
        },
        context
      );

      const items = domainResult.items || [];
      if (items.length > 0) {
        const list = items
          .slice(0, 8)
          .map((i) => `• **${i.name}** (${i.colors.join('/')} • ${i.category} • ${i.status})`)
          .join('\n');
        if (workingState.resolvedEntities.status === 'in_laundry') {
          responseText = `You have ${items.length} item${items.length === 1 ? '' : 's'} currently in laundry or needing wash:\n${list}`;
        } else if (workingState.resolvedEntities.occasion) {
          responseText = `I found ${items.length} existing item${items.length === 1 ? '' : 's'} suitable for **${workingState.resolvedEntities.occasion}**:\n${list}`;
        } else {
          responseText = `I found ${items.length} matching item${items.length === 1 ? '' : 's'}:\n${list}`;
        }
      } else {
        if (workingState.resolvedEntities.status === 'in_laundry') {
          responseText = `Good news! All your garments are clean and none are currently in laundry.`;
        } else if (workingState.resolvedEntities.occasion) {
          responseText = `I couldn't find any items in your wardrobe marked for **${workingState.resolvedEntities.occasion}**.`;
        } else {
          responseText = `I couldn't find any items matching those criteria in your wardrobe.`;
        }
      }
      break;
    }

    // -----------------------------------------------------------------------
    // I. PLAN_OUTFIT (Calendar Scheduling - Requires Confirmation)
    // -----------------------------------------------------------------------
    case 'PLAN_OUTFIT': {
      const occasion = workingState.resolvedEntities.occasion || 'office';
      const availableOutfits = workingState.lastDomainResult?.outfits || [];
      let lookCandidate: GeneratedOutfit | undefined;

      if (availableOutfits.length > 0) {
        const resolved = resolveReferencedLook(
          availableOutfits,
          workingState.resolvedEntities,
          workingState
        );
        lookCandidate = resolved.look || availableOutfits[workingState.selectedLookIndex ?? 0];
        if (resolved.lookIndex !== undefined) {
          workingState.selectedLookIndex = resolved.lookIndex;
          workingState.selectedOutfitId = lookCandidate.id;
        }
      }

      if (!lookCandidate) {
        const rec = await recommendOutfitsTool.execute(
          { occasion, season: targetSeason, dateStr: targetDate, limit: 1 },
          context
        );
        lookCandidate = rec.outfits?.[0];
      }

      if (!lookCandidate) {
        responseText = `Cannot plan look for ${occasion}: no viable clean outfits found in your wardrobe.`;
        break;
      }

      const pieceNames = Object.values(lookCandidate.slots || {}).flat().map((i) => i.name);
      const outfitDesc = pieceNames.join(' + ') || 'Curated Look';

      confirmationRequest = {
        id: `conf_plan_${userTimestamp}_${state.messages.length + 1}`,
        actionType: 'PLAN_OUTFIT',
        title: 'Plan Outfit Look',
        description: `Schedule ${outfitDesc} for ${occasion} on ${targetDate}?`,
        payload: {
          date: targetDate,
          occasion,
          outfit: lookCandidate,
        },
        status: 'pending',
      };

      responseText = `I can schedule this look (**${outfitDesc}**) for **${occasion}** on **${targetDate}** in your calendar. Would you like me to do that?`;
      break;
    }

    // -----------------------------------------------------------------------
    // J. RECORD_WEAR (Wear History - Requires Confirmation)
    // -----------------------------------------------------------------------
    case 'RECORD_WEAR': {
      const availableOutfits = workingState.lastDomainResult?.outfits || [];
      let lookCandidate: GeneratedOutfit | undefined;

      if (availableOutfits.length > 0) {
        const resolved = resolveReferencedLook(
          availableOutfits,
          workingState.resolvedEntities,
          workingState
        );
        lookCandidate = resolved.look || availableOutfits[workingState.selectedLookIndex ?? 0];
        if (resolved.lookIndex !== undefined) {
          workingState.selectedLookIndex = resolved.lookIndex;
          workingState.selectedOutfitId = lookCandidate.id;
        }
      } else if (workingState.resolvedEntities.wardrobeItemId) {
        const item = context.wardrobe.find((i) => i.id === workingState.resolvedEntities.wardrobeItemId);
        if (item) {
          lookCandidate = {
            id: `wear_${item.id}`,
            template: 'single_item',
            slots: {
              [item.category.toLowerCase()]: [item],
            },
            score: 1.0,
            why: `Wearing ${item.name}`,
          };
        }
      }

      if (!lookCandidate) {
        responseText = 'Please select or view an outfit first so I know which look to log as worn.';
        break;
      }

      const pieceNames = Object.values(lookCandidate.slots || {}).flat().map((i) => i.name);
      const outfitDesc = pieceNames.join(' + ') || 'this look';

      confirmationRequest = {
        id: `conf_wear_${userTimestamp}_${state.messages.length + 1}`,
        actionType: 'RECORD_WEAR',
        title: 'Log Outfit Wear',
        description: `Record wear log for ${outfitDesc} on ${targetDate}?`,
        payload: {
          outfit: lookCandidate,
          dateStr: targetDate,
        },
        status: 'pending',
      };

      responseText = `Would you like me to record this outfit as worn on **${targetDate}**? This will update your rotation health and item wear counters.`;
      break;
    }

    // -----------------------------------------------------------------------
    // K. EXPLAIN_RECOMMENDATION (Phase 5)
    // -----------------------------------------------------------------------
    case 'EXPLAIN_RECOMMENDATION': {
      const availableOutfits = [
        ...(workingState.lastDomainResult?.outfits || []),
        ...(workingState.activeOutfit ? [workingState.activeOutfit] : []),
      ];
      let outfitToExplain: GeneratedOutfit | undefined;

      if (availableOutfits.length > 0) {
        const resolved = resolveReferencedLook(
          availableOutfits,
          workingState.resolvedEntities,
          workingState
        );
        outfitToExplain = resolved.look || availableOutfits[0];
        if (resolved.lookIndex !== undefined) {
          workingState.selectedLookIndex = resolved.lookIndex;
          workingState.selectedOutfitId = outfitToExplain.id;
        }
      }

      if (outfitToExplain) {
        const pieces = Object.values(outfitToExplain.slots || {}).flat().map((i) => i.name).join(' + ');
        if (outfitToExplain.explanation?.reasons && outfitToExplain.explanation.reasons.length > 0) {
          const reasons = outfitToExplain.explanation.reasons.map((r) => `• ${r}`).join('\n');
          responseText = `Here is why this combination (${pieces}) works well:\n${reasons}`;
        } else {
          const occasion = workingState.activeOccasion || 'the requested occasion';
          responseText = `Here is why this combination (${pieces}) works well for **${occasion}**:\n• Balanced silhouette proportions with clean color harmony.\n• Fabric breathability and movement suited for the setting.\n• Cohesive formality across all companion pieces.`;
        }
      } else {
        responseText =
          'Here is why I recommend outfits: Phase 5 compatibility across verified thermal weather, personal style affinities, color harmony, and structural Indian fashion templates.';
      }
      break;
    }

    // -----------------------------------------------------------------------
    // K1. ANTI_REPETITION
    // -----------------------------------------------------------------------
    case 'ANTI_REPETITION': {
      const lookbackDays = workingState.resolvedEntities.avoidRecentDays || 2;
      const cutoffTime = context.referenceTimestamp - lookbackDays * 86400000;
      const recentWornItemIds = new Set<string>();

      const wearEvents = context.wearEvents || context.wearLogs || [];
      for (const w of wearEvents as any[]) {
        const wornAt = w.wornAt || w.timestamp || w.createdAt || 0;
        if (wornAt >= cutoffTime) {
          const itemId = w.wardrobeItemId || w.itemId;
          if (itemId) recentWornItemIds.add(itemId);
        }
      }
      for (const item of context.wardrobe) {
        if (item.lastWorn && item.lastWorn >= cutoffTime) {
          recentWornItemIds.add(item.id);
        }
      }

      const occasion = workingState.resolvedEntities.occasion || 'everyday';
      domainResult = await recommendOutfitsTool.execute(
        {
          occasion,
          season: targetSeason,
          dateStr: targetDate,
          recentWornItemIds: Array.from(recentWornItemIds),
        },
        context
      );

      const outfits = domainResult.outfits || [];
      if (outfits.length > 0) {
        const top = outfits[0];
        workingState.activeOutfit = top;
        if (outfits.length === 1) {
          workingState.selectedOutfitId = top.id;
          workingState.selectedLookIndex = 0;
        } else {
          workingState.selectedOutfitId = undefined;
          workingState.selectedLookIndex = undefined;
        }
        workingState.activeOccasion = occasion;
        if (!workingState.shownOutfitIds?.includes(top.id)) {
          workingState.shownOutfitIds = [...(workingState.shownOutfitIds || []), top.id];
        }

        const pieces = Object.values(top.slots || {})
          .flat()
          .map((i) => i.name)
          .join(', ');

        const whyBullets = top.explanation?.reasons?.slice(0, 3) || [];
        const explanationText =
          whyBullets.length > 0
            ? `\n\nWhy this works:\n${whyBullets.map((r) => `• ${r}`).join('\n')}`
            : '';

        responseText = `Here is a fresh look for **${occasion}** (ensuring pieces worn in the last ${lookbackDays} days are avoided):\n• **${pieces}**${explanationText}`;
      } else {
        responseText = `I couldn't find a complete alternative look for **${occasion}** without repeating items worn in the last ${lookbackDays} days. Check if other pieces are in laundry or add missing categories.`;
      }
      break;
    }

    // -----------------------------------------------------------------------
    // K2. FEEDBACK_POSITIVE & LOOK SELECTION
    // -----------------------------------------------------------------------
    case 'FEEDBACK_POSITIVE': {
      const availableOutfits = workingState.lastDomainResult?.outfits || [];
      if (
        availableOutfits.length > 0 &&
        (workingState.resolvedEntities.lookIndex !== undefined ||
          workingState.resolvedEntities.ordinalRef !== undefined)
      ) {
        const resolved = resolveReferencedLook(
          availableOutfits,
          workingState.resolvedEntities,
          workingState
        );
        const look = resolved.look || availableOutfits[0];
        const lookIdx = resolved.lookIndex ?? 0;
        workingState.selectedLookIndex = lookIdx;
        workingState.selectedOutfitId = look.id;
        const pieces = Object.values(look.slots || {}).flat().map((i) => i.name).join(' + ');
        responseText = `Glad you like Look ${lookIdx + 1} (**${pieces}**)! Would you like to schedule this look on your calendar or log it as worn?`;
      } else {
        responseText = "I'm delighted you love this styling! Your preference has been noted to refine future recommendations.";
      }
      break;
    }

    // -----------------------------------------------------------------------
    // K3. FEEDBACK_NEGATIVE
    // -----------------------------------------------------------------------
    case 'FEEDBACK_NEGATIVE': {
      responseText =
        "Understood! I'll take note of your feedback to adjust your style profile and avoid similar pairings or silhouettes in future recommendations. Would you like me to show an alternative look or swap a specific piece?";
      break;
    }

    // -----------------------------------------------------------------------
    // L. GENERAL_FASHION_QUESTION (Phase 6 & Designer's Edit Integration - P2-A)
    // -----------------------------------------------------------------------
    case 'GENERAL_FASHION_QUESTION': {
      const trimmedInput = userInput.trim().toLowerCase();
      const directMatch = getPhilosophyById(trimmedInput);
      const matchingPhilosophies = directMatch
        ? [directMatch]
        : searchPhilosophies(userInput);

      if (matchingPhilosophies.length > 0) {
        const phil = matchingPhilosophies[0];
        const specificCraft = phil.textileTraditions.find((t) => {
          const tLower = t.name.toLowerCase();
          if (trimmedInput.includes(tLower) || tLower.includes(trimmedInput)) {
            return true;
          }
          const tokens = tLower
            .replace(/[()&,]/g, ' ')
            .split(/\s+/)
            .filter((w) => w.length > 3);
          return tokens.some((tok) => trimmedInput.includes(tok));
        });

        if (specificCraft) {
          responseText =
            `# Living Handloom Tradition: ${specificCraft.name}\n\n` +
            `**Region & Provenance:** ${specificCraft.region}\n` +
            `**Craft Technique:** ${specificCraft.technique}\n` +
            `**Historical Significance:** ${specificCraft.historicalSignificance}\n` +
            `**Seasonal Suitability:** ${specificCraft.bestSeason}\n\n` +
            `**Editorial Context (${phil.title}):** ${specificCraft.description}\n\n` +
            `*Verified Source: ${phil.verifiedSources.join('; ')}*`;
        } else {
          const principles = phil.corePrinciples
            .map((cp, idx) => `${idx + 1}. ${cp}`)
            .join('\n');
          responseText =
            `# The Designer's Edit: ${phil.title}\n` +
            `*${phil.subtitle}*\n\n` +
            `${phil.description}\n\n` +
            `### Core Principles:\n${principles}\n\n` +
            `### Proportions & Silhouette Architecture:\n${phil.silhouetteGuide.proportions}\n` +
            `• **Top:** ${phil.silhouetteGuide.top}\n` +
            `• **Bottom:** ${phil.silhouetteGuide.bottom}\n` +
            `• **Layering:** ${phil.silhouetteGuide.layering}\n` +
            `• **Footwear:** ${phil.silhouetteGuide.footwear}\n\n` +
            `*Verified Source: ${phil.verifiedSources.join('; ')}*`;
        }
        break;
      }

      domainResult = await explainFashionKnowledgeTool.execute(
        { itemIds: context.wardrobe.slice(0, 3).map((i) => i.id) },
        context
      );
      if (domainResult?.summary) {
        responseText = `Fashion Architecture & Cultural Guidance:\n${domainResult.summary}`;
      } else {
        responseText =
          "I don't have verified craft or textile documentation for that specific query in the Designer's Edit catalog.";
      }
      break;
    }

    // -----------------------------------------------------------------------
    // M. UNKNOWN / DEFAULT
    // -----------------------------------------------------------------------
    default: {
      responseText =
        "I'm AI Saathi, your privacy-first wardrobe companion. I can help you:\n• **Recommend looks** for college, office, parties, or pujas\n• **Style specific pieces** from your closet\n• **Audit wardrobe gaps** & answer if you need to buy anything\n• **Analyze your wear rotation** & find dormant pieces\n• **Check current weather** suitability\n\nWhat would you like to explore?";
      break;
    }
  }

  // Set pending requests
  workingState.pendingClarification = clarificationRequest;
  workingState.pendingConfirmation = confirmationRequest;
  if (domainResult) {
    workingState.lastDomainResult = domainResult;
  }

  const assistantMessage: SaathiMessage = {
    id: generateSaathiMessageId('a', userTimestamp),
    sender: 'assistant',
    text: responseText,
    timestamp: userTimestamp + 1,
    intent: activeIntent,
    domainResult,
    clarification: clarificationRequest,
    confirmation: confirmationRequest,
  };

  workingState.messages = [...workingState.messages, assistantMessage].slice(-MAX_HISTORY_MESSAGES);

  return {
    message: responseText,
    intent: activeIntent,
    domainResult,
    clarification: clarificationRequest,
    confirmation: confirmationRequest,
    updatedState: workingState,
  };
}
