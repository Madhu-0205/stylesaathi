import { CalendarRepository, OutfitPlan, PlanStatus } from '../types';

const CALENDAR_PLANS_KEY = 'stylesaathi-calendar-plans-v1';

export class LocalStorageCalendarRepository implements CalendarRepository {
  private memStorage = new Map<string, string>();

  private getRaw(key: string): string | null {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem(key);
      }
      if (typeof localStorage !== 'undefined') {
        return localStorage.getItem(key);
      }
    } catch {}
    return this.memStorage.get(key) || null;
  }

  private setRaw(key: string, val: string): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, val);
        return;
      }
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(key, val);
        return;
      }
    } catch {}
    this.memStorage.set(key, val);
  }

  private removeRaw(key: string): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(key);
        return;
      }
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(key);
        return;
      }
    } catch {}
    this.memStorage.delete(key);
  }

  async getPlans(): Promise<OutfitPlan[]> {
    const raw = this.getRaw(CALENDAR_PLANS_KEY);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  async getPlanByDate(date: string): Promise<OutfitPlan | null> {
    const plans = await this.getPlans();
    return plans.find((p) => p.date === date) || null;
  }

  async savePlan(plan: OutfitPlan): Promise<void> {
    const plans = await this.getPlans();
    const existingIndex = plans.findIndex((p) => p.date === plan.date || p.id === plan.id);
    if (existingIndex >= 0) {
      plans[existingIndex] = { ...plan, updatedAt: Date.now() };
    } else {
      plans.push({ ...plan, createdAt: plan.createdAt || Date.now(), updatedAt: Date.now() });
    }
    this.setRaw(CALENDAR_PLANS_KEY, JSON.stringify(plans));
  }

  async deletePlan(id: string): Promise<void> {
    const plans = await this.getPlans();
    const filtered = plans.filter((p) => p.id !== id);
    this.setRaw(CALENDAR_PLANS_KEY, JSON.stringify(filtered));
  }

  async updatePlanStatus(id: string, status: PlanStatus): Promise<void> {
    const plans = await this.getPlans();
    const plan = plans.find((p) => p.id === id);
    if (plan) {
      plan.status = status;
      plan.updatedAt = Date.now();
      this.setRaw(CALENDAR_PLANS_KEY, JSON.stringify(plans));
    }
  }

  async clear(): Promise<void> {
    this.removeRaw(CALENDAR_PLANS_KEY);
  }
}

export const calendarRepository = new LocalStorageCalendarRepository();
