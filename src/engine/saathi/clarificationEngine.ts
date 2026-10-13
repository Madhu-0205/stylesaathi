import { Occasion } from '../../types';
import { ClarificationRequest, ClarificationOption, SaathiEntities } from './types';

/**
 * Creates structured clarification for missing occasion.
 */
export function createOccasionClarification(): ClarificationRequest {
  const options: ClarificationOption[] = [
    { label: 'College', value: 'college', description: 'Lectures, campus, casual class' },
    { label: 'Office', value: 'office', description: 'Work, meetings, presentations' },
    { label: 'Casual Outing', value: 'casual outing', description: 'Cafe, brunch, errands' },
    { label: 'Party', value: 'party', description: 'Evening gathering, celebrations' },
    { label: 'Date', value: 'date', description: 'Dinner, romantic evening' },
    { label: 'Festive / Traditional', value: 'festive', description: 'Festivals, cultural celebrations' },
  ];

  return {
    id: `clarify_occ_${Date.now()}`,
    question: 'What kind of occasion or setting are you dressing for?',
    field: 'occasion',
    options,
    contextHint: 'Knowing the setting helps select the right structural template.',
  };
}

/**
 * Creates structured clarification for missing target date.
 */
export function createDateClarification(): ClarificationRequest {
  const options: ClarificationOption[] = [
    { label: 'Today', value: 'today', description: 'Current day look' },
    { label: 'Tomorrow', value: 'tomorrow', description: 'Upcoming morning look' },
    { label: 'This Weekend', value: 'this_weekend', description: 'Saturday / Sunday outing' },
  ];

  return {
    id: `clarify_date_${Date.now()}`,
    question: 'When do you plan to wear this outfit?',
    field: 'relativeDate',
    options,
  };
}

/**
 * Applies clarification response to existing resolved entities.
 */
export function applyClarificationResponse(
  pending: ClarificationRequest,
  responseValue: string,
  currentEntities: SaathiEntities
): SaathiEntities {
  const updated: SaathiEntities = { ...currentEntities };

  if (pending.field === 'occasion') {
    updated.occasion = responseValue as Occasion;
  } else if (pending.field === 'wardrobeItemId') {
    updated.wardrobeItemId = responseValue;
  } else if (pending.field === 'relativeDate') {
    updated.relativeDate = responseValue as 'today' | 'tomorrow' | 'this_weekend';
  } else if (pending.field === 'category') {
    updated.category = responseValue as any;
  } else if (pending.field === 'subcategory') {
    updated.subcategory = responseValue as any;
  } else if (pending.field === 'color') {
    updated.color = responseValue;
  }

  return updated;
}
