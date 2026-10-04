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
    const plans = await this.getAllPlansRaw();
    return plans.filter((p) => !p.isDeleted);
  }

  async getPlanByDate(date: string): Promise<OutfitPlan | null> {
    const plans = await this.getPlans();
    return plans.find((p) => p.date === date) || null;
  }

  async getAllPlansRaw(): Promise<OutfitPlan[]> {
    const raw = this.getRaw(CALENDAR_PLANS_KEY);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  async upsertPlanRaw(plan: OutfitPlan): Promise<void> {
    const plans = await this.getAllPlansRaw();
    const existingIndex = plans.findIndex((p) => p.id === plan.id || p.date === plan.date);
    if (existingIndex >= 0) {
      plans[existingIndex] = plan;
    } else {
      plans.push(plan);
    }
    this.setRaw(CALENDAR_PLANS_KEY, JSON.stringify(plans));
  }

  async savePlan(plan: OutfitPlan): Promise<void> {
    const plans = await this.getAllPlansRaw();
    const existingIndex = plans.findIndex((p) => p.date === plan.date || p.id === plan.id);
    const now = Date.now();

    if (existingIndex >= 0) {
      const existing = plans[existingIndex];
      // MONOTONIC RULE: A stale 'planned' mutation must NEVER revert 'worn'
      const finalStatus: PlanStatus =
        existing.status === 'worn' && plan.status === 'planned' ? 'worn' : plan.status;

      plans[existingIndex] = {
        ...plan,
        status: finalStatus,
        isDeleted: false,
        deletedAt: undefined,
        updatedAt: now,
        clientUpdatedAt: now,
      };
    } else {
      plans.push({
        ...plan,
        isDeleted: false,
        deletedAt: undefined,
        createdAt: plan.createdAt || now,
        updatedAt: now,
        clientUpdatedAt: now,
      });
    }
    this.setRaw(CALENDAR_PLANS_KEY, JSON.stringify(plans));
  }

  async deletePlan(id: string): Promise<void> {
    const plans = await this.getAllPlansRaw();
    const now = Date.now();
    // Soft tombstone: keep in storage so sync engine knows about the deletion
    const updated = plans.map((p) => {
      if (p.id === id) {
        return {
          ...p,
          isDeleted: true,
          deletedAt: now,
          clientUpdatedAt: now,
        };
      }
      return p;
    });
    this.setRaw(CALENDAR_PLANS_KEY, JSON.stringify(updated));
  }

  async updatePlanStatus(id: string, status: PlanStatus): Promise<void> {
    const plans = await this.getAllPlansRaw();
    const plan = plans.find((p) => p.id === id);
    if (plan) {
      // MONOTONIC RULE: If already 'worn', prevent regression to 'planned'
      if (plan.status === 'worn' && status === 'planned') {
        return; // Reject regression
      }
      plan.status = status;
      plan.updatedAt = Date.now();
      plan.clientUpdatedAt = Date.now();
      this.setRaw(CALENDAR_PLANS_KEY, JSON.stringify(plans));
    }
  }

  async clear(): Promise<void> {
    this.removeRaw(CALENDAR_PLANS_KEY);
  }
}

export const calendarRepository = new LocalStorageCalendarRepository();
