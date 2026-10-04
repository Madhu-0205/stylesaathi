import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Security & Row Level Security (RLS) Auditing', () => {
  const schemaSql = fs.readFileSync(path.resolve(__dirname, '../../supabase/schema.sql'), 'utf-8');
  const storageSql = fs.readFileSync(path.resolve(__dirname, '../../supabase/storage.sql'), 'utf-8');

  // ==========================================================================
  // K. Cross-User RLS Access & Policy Enforcement
  // ==========================================================================
  describe('K. Cross-user RLS access', () => {
    it('verifies RLS is enabled on all user-owned tables', () => {
      const requiredTables = [
        'profiles',
        'wardrobe_items',
        'wardrobe_image_versions',
        'saved_outfits',
        'calendar_plans',
        'style_preferences',
        'wear_events',
      ];

      for (const table of requiredTables) {
        expect(schemaSql).toMatch(new RegExp(`ALTER TABLE\\s+(public\\.)?${table}\\s+ENABLE ROW LEVEL SECURITY;`, 'i'));
      }
    });

    it('verifies wardrobe_image_versions enforces RLS and wardrobe_items ownership', () => {
      expect(schemaSql).toContain('"image_versions_select_own"');
      expect(schemaSql).toContain('"image_versions_insert_own"');
      expect(schemaSql).toContain('"image_versions_update_own"');
      expect(schemaSql).toContain('"image_versions_delete_own"');
      expect(schemaSql).toContain('FOREIGN KEY (user_id, wardrobe_item_id) REFERENCES public.wardrobe_items(user_id, id)');
    });

    it('verifies wardrobe_items SELECT, INSERT, UPDATE, DELETE policies enforce auth.uid() = user_id', () => {
      expect(schemaSql).toContain('"wardrobe_items_select_own"');
      expect(schemaSql).toContain('"wardrobe_items_insert_own"');
      expect(schemaSql).toContain('"wardrobe_items_update_own"');
      expect(schemaSql).toContain('"wardrobe_items_delete_own"');

      // The authenticated identity MUST come from auth.uid()
      expect(schemaSql).toMatch(/CREATE POLICY "wardrobe_items_select_own" ON public\.wardrobe_items[\s\S]*?auth\.uid\(\) = user_id/);
      expect(schemaSql).toMatch(/CREATE POLICY "wardrobe_items_insert_own" ON public\.wardrobe_items[\s\S]*?WITH CHECK \(auth\.uid\(\) = user_id\)/);
      expect(schemaSql).toMatch(/CREATE POLICY "wardrobe_items_update_own" ON public\.wardrobe_items[\s\S]*?USING \(auth\.uid\(\) = user_id\)/);
      expect(schemaSql).toMatch(/CREATE POLICY "wardrobe_items_delete_own" ON public\.wardrobe_items[\s\S]*?USING \(auth\.uid\(\) = user_id\)/);
    });

    it('verifies wear_events insert policy enforces auth.uid() = user_id and foreign key references wardrobe_items', () => {
      expect(schemaSql).toContain('"wear_events_insert_own"');
      expect(schemaSql).toMatch(/CREATE POLICY "wear_events_insert_own" ON public\.wear_events[\s\S]*?WITH CHECK \([\s\S]*?auth\.uid\(\) = user_id/);
      expect(schemaSql).toContain('FOREIGN KEY (user_id, wardrobe_item_id) REFERENCES public.wardrobe_items(user_id, id)');
    });

    it('verifies calendar_plans enforces single plan per user per date via unique constraint', () => {
      expect(schemaSql).toContain('CONSTRAINT uq_calendar_plans_user_date UNIQUE (user_id, date)');
      expect(schemaSql).toContain('guard_calendar_plan_status()');
    });

    it('verifies server_updated_at is protected by server triggers and cannot be manipulated by client', () => {
      expect(schemaSql).toContain('CREATE OR REPLACE FUNCTION public.set_server_updated_at()');
      expect(schemaSql).toContain('NEW.server_updated_at = now();');
      expect(schemaSql).toContain('BEFORE INSERT OR UPDATE ON public.wardrobe_items');
      expect(schemaSql).toContain('BEFORE INSERT OR UPDATE ON public.calendar_plans');
      expect(schemaSql).toContain('BEFORE INSERT OR UPDATE ON public.style_preferences');
      expect(schemaSql).toContain('BEFORE INSERT OR UPDATE ON public.saved_outfits');
    });
  });

  // ==========================================================================
  // L. Cross-User Storage Access
  // ==========================================================================
  describe('L. Cross-user Storage access', () => {
    it('verifies storage bucket wardrobe is configured as PRIVATE', () => {
      expect(storageSql).toMatch(/INSERT INTO storage\.buckets[\s\S]*?'wardrobe'[\s\S]*?false/);
    });

    it('verifies storage policies restrict read/write strictly to user_id folder matching auth.uid()', () => {
      expect(storageSql).toContain('CREATE POLICY "wardrobe_storage_select"');
      expect(storageSql).toContain('CREATE POLICY "wardrobe_storage_insert"');
      expect(storageSql).toContain('CREATE POLICY "wardrobe_storage_update"');
      expect(storageSql).toContain('CREATE POLICY "wardrobe_storage_delete"');

      // Checks path extraction matches auth.uid()
      expect(storageSql).toContain("(storage.foldername(name))[1] = auth.uid()::text");
    });
  });

  // ==========================================================================
  // Secret & Credential Exposure Checks
  // ==========================================================================
  describe('Secret & credential leak protection', () => {
    it('ensures service_role, service-role, or db secret is NOT present in any source files or .env.example', () => {
      const srcDir = path.resolve(__dirname, '..');
      const files: string[] = [path.resolve(__dirname, '../../.env.example')];

      function walk(dir: string) {
        for (const item of fs.readdirSync(dir)) {
          const full = path.join(dir, item);
          if (fs.statSync(full).isDirectory()) {
            if (!item.includes('node_modules') && !item.includes('.git')) {
              walk(full);
            }
          } else if (
            full.endsWith('.ts') ||
            full.endsWith('.tsx') ||
            full.endsWith('.js') ||
            full.endsWith('.html')
          ) {
            files.push(full);
          }
        }
      }

      walk(srcDir);

      for (const file of files) {
        if (file.endsWith('securityAndRLS.test.ts')) continue;
        const content = fs.readFileSync(file, 'utf-8');
        // Must never contain hardcoded service role tokens
        expect(content).not.toMatch(/eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/);
        // Must never reference service_role key in client code
        expect(content).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
      }
    });
  });
});
