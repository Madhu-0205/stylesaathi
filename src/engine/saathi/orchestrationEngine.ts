import {
  SaathiConversationState,
  SaathiMessage,
  SaathiResponse,
  SaathiToolContext,
  ConfirmationRequest,
  ClarificationRequest,
  DomainResultReference,
} from './types';
import { GeneratedOutfit } from '../../types';
import { parseSaathiIntent } from './intentParser';
import {
  mergeConversationEntities,
  resolveTargetDate,
  resolveSeasonForDate,
  resolveWardrobeGarment,
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

const MAX_HISTORY_MESSAGES = 50;

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
  const userMessage: SaathiMessage = {
    id: `msg_u_${userTimestamp}_${state.messages.length + 1}`,
    sender: 'user',
    text: userInput,
    timestamp: userTimestamp,
  };

  let workingState: SaathiConversationState = {
    ...state,
    messages: [...state.messages, userMessage].slice(-MAX_HISTORY_MESSAGES),
    resolvedEntities: { ...state.resolvedEntities },
  };

  // =========================================================================
  // 1. Check for Pending Confirmation Response
  // =========================================================================
  if (workingState.pendingConfirmation) {
    const confirmation = workingState.pendingConfirmation;
    const lowerInput = userInput.trim().toLowerCase();
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

    if (isYes) {
      workingState.pendingConfirmation = undefined;

      if (confirmation.actionType === 'PLAN_OUTFIT') {
        const payload = confirmation.payload as any;
        const result = await createPlanTool.execute(payload, context);
        const assistantMessage: SaathiMessage = {
          id: `msg_a_${userTimestamp + 1}`,
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
          id: `msg_a_${userTimestamp + 1}`,
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
        id: `msg_a_${userTimestamp + 1}`,
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

    const resolvedValue = matchedOptionValue || userInput.trim();
    workingState.resolvedEntities = applyClarificationResponse(
      clarification,
      resolvedValue,
      workingState.resolvedEntities
    );
    workingState.pendingClarification = undefined;
    resumeActiveIntent = true;
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
      domainResult = await recommendOutfitsTool.execute(
        {
          occasion,
          season: targetSeason,
          dateStr: targetDate,
        },
        context
      );

      const outfits = domainResult.outfits || [];
      if (outfits.length > 0) {
        const top = outfits[0];
        const pieces = Object.values(top.slots || {})
          .flat()
          .map((i) => i.name)
          .join(', ');

        const whyBullets = top.explanation?.reasons?.slice(0, 3) || [];
        const explanationText =
          whyBullets.length > 0
            ? `\n\nWhy this works:\n${whyBullets.map((r) => `• ${r}`).join('\n')}`
            : '';

        responseText = `Here is a curated look for **${occasion}**:\n• **${pieces}**${explanationText}`;
      } else {
        responseText = `I couldn't find a complete clean look for **${occasion}** right now. Check if required pieces are in laundry or add missing categories.`;
      }
      break;
    }

    // -----------------------------------------------------------------------
    // B. STYLE_ITEM (Phase 7 Anchor Item)
    // -----------------------------------------------------------------------
    case 'STYLE_ITEM': {
      // Disambiguate garment
      let anchorId = workingState.resolvedEntities.wardrobeItemId;

      if (!anchorId) {
        const match = resolveWardrobeGarment(context.wardrobe, {
          color: workingState.resolvedEntities.color,
          subcategory: workingState.resolvedEntities.subcategory,
          category: workingState.resolvedEntities.category,
          itemName: workingState.resolvedEntities.wardrobeItemName,
        });

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

      const outfits = domainResult.outfits || [];
      if (outfits.length > 0) {
        const top = outfits[0];
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

        responseText = `Here is how to style your **${anchor.name}** for **${occasion}**:\n• Pair with: **${companionPieces}**${explanationText}`;
      } else {
        responseText = `I couldn't complete an outfit around **${anchor.name}** for **${occasion}**. You might need clean companion pieces to complete the look.`;
      }
      break;
    }

    // -----------------------------------------------------------------------
    // C. CHECK_WEATHER (Phase 4)
    // -----------------------------------------------------------------------
    case 'CHECK_WEATHER': {
      domainResult = await getCurrentWeatherTool.execute({}, context);
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
    // G. ASSESS_PURCHASE_NEED (Phase 9 Decision Support)
    // -----------------------------------------------------------------------
    case 'ASSESS_PURCHASE_NEED': {
      domainResult = await getPurchaseAssessmentTool.execute({}, context);
      const rep = domainResult.gapReport;
      const isJustified = rep?.purchaseAssessment === 'PURCHASE_JUSTIFIED';

      if (!isJustified) {
        responseText = `**NO PURCHASE NEEDED**\n\n${rep?.negativeEvidence?.primaryReason || domainResult.summary}\n\nYour existing closet provides adequate coverage. Rediscovering or rotating owned pieces will maintain complete versatility.`;
      } else {
        const topGap = rep?.gaps.find((g) => g.purchaseAssessment === 'PURCHASE_JUSTIFIED');
        responseText = `**VERIFIED WARDROBE GAP**\n\n${domainResult.summary}\n\nCapability missing: **${topGap?.headline || 'Structural requirement'}**.\nEvidence: ${topGap?.explanation || 'Active demand cannot form complete looks.'}\n\n*(Note: StyleSaathi provides evidence-based decision support, never commercial shopping recommendations.)*`;
      }
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
          search: workingState.resolvedEntities.wardrobeItemName,
        },
        context
      );

      const items = domainResult.items || [];
      if (items.length > 0) {
        const list = items
          .slice(0, 5)
          .map((i) => `• **${i.name}** (${i.colors.join('/')} • ${i.category} • ${i.status})`)
          .join('\n');
        responseText = `I found ${items.length} matching item${items.length === 1 ? '' : 's'}:\n${list}`;
      } else {
        responseText = `I couldn't find any items matching those criteria in your wardrobe.`;
      }
      break;
    }

    // -----------------------------------------------------------------------
    // I. PLAN_OUTFIT (Calendar Scheduling - Requires Confirmation)
    // -----------------------------------------------------------------------
    case 'PLAN_OUTFIT': {
      const occasion = workingState.resolvedEntities.occasion || 'office';

      // Generate look candidate if not already generated
      let lookCandidate: GeneratedOutfit | undefined = workingState.lastDomainResult?.outfits?.[0];
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
      let lookCandidate: GeneratedOutfit | undefined = workingState.lastDomainResult?.outfits?.[0];
      if (!lookCandidate && workingState.resolvedEntities.wardrobeItemId) {
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
      const topOutfit = workingState.lastDomainResult?.outfits?.[0];
      if (topOutfit?.explanation) {
        const reasons = topOutfit.explanation.reasons.map((r) => `• ${r}`).join('\n');
        responseText = `Here is why I recommended that look:\n${reasons}`;
      } else {
        responseText =
          'Here is why I recommend outfits: Phase 5 compatibility across verified thermal weather, personal style affinities, color harmony, and structural Indian fashion templates.';
      }
      break;
    }

    // -----------------------------------------------------------------------
    // L. GENERAL_FASHION_QUESTION (Phase 6)
    // -----------------------------------------------------------------------
    case 'GENERAL_FASHION_QUESTION': {
      domainResult = await explainFashionKnowledgeTool.execute(
        { itemIds: context.wardrobe.slice(0, 3).map((i) => i.id) },
        context
      );
      responseText = `Fashion Architecture & Cultural Guidance:\n${domainResult.summary}`;
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
    id: `msg_a_${userTimestamp + 1}`,
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
