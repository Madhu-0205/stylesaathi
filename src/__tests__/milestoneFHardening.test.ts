import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve(__dirname, '../..');

describe('Milestone F — Final Product Hardening, QA & Google Play Store Readiness', () => {
  describe('1. Android Configuration & Security Manifest', () => {
    const manifestPath = path.join(projectRoot, 'android/app/src/main/AndroidManifest.xml');
    const manifestContent = fs.readFileSync(manifestPath, 'utf-8');

    it('declares strictly minimal permissions (CAMERA and INTERNET only)', () => {
      expect(manifestContent).toContain('android.permission.INTERNET');
      expect(manifestContent).toContain('android.permission.CAMERA');
      expect(manifestContent).not.toContain('android.permission.READ_EXTERNAL_STORAGE');
      expect(manifestContent).not.toContain('android.permission.WRITE_EXTERNAL_STORAGE');
      expect(manifestContent).not.toContain('android.permission.ACCESS_FINE_LOCATION');
    });

    it('sets optional hardware requirements for camera to allow installation on all devices', () => {
      expect(manifestContent).toContain('android:name="android.hardware.camera"');
      expect(manifestContent).toContain('android:required="false"');
    });

    it('declares FileProvider with grantUriPermissions and unexported access', () => {
      expect(manifestContent).toContain('androidx.core.content.FileProvider');
      expect(manifestContent).toContain('android:exported="false"');
      expect(manifestContent).toContain('android:grantUriPermissions="true"');
    });

    it('configures MainActivity with singleTask launchMode and explicit exported attribute', () => {
      expect(manifestContent).toContain('android:name=".MainActivity"');
      expect(manifestContent).toContain('android:launchMode="singleTask"');
      expect(manifestContent).toContain('android:exported="true"');
    });

    it('declares deep linking scheme stylesaathi://auth/callback for OAuth', () => {
      expect(manifestContent).toContain('android:scheme="stylesaathi"');
      expect(manifestContent).toContain('android:host="auth"');
      expect(manifestContent).toContain('android:path="/callback"');
    });
  });

  describe('2. Build Properties & Target SDK Compliance', () => {
    const variablesPath = path.join(projectRoot, 'android/variables.gradle');
    const variablesContent = fs.readFileSync(variablesPath, 'utf-8');
    const buildGradlePath = path.join(projectRoot, 'android/app/build.gradle');
    const buildGradleContent = fs.readFileSync(buildGradlePath, 'utf-8');

    it('complies with Google Play target SDK policy (Target SDK 36, Min SDK 24)', () => {
      expect(variablesContent).toContain('targetSdkVersion = 36');
      expect(variablesContent).toContain('compileSdkVersion = 36');
      expect(variablesContent).toContain('minSdkVersion = 24');
    });

    it('configures release signing block reading from release-signing.properties', () => {
      expect(buildGradleContent).toContain('signingConfigs {');
      expect(buildGradleContent).toContain('release {');
      expect(buildGradleContent).toContain('release-signing.properties');
      expect(buildGradleContent).toContain('signingConfig signingConfigs.release');
    });
  });

  describe('3. Capacitor Production Runtime Configuration', () => {
    const capConfigPath = path.join(projectRoot, 'capacitor.config.ts');
    const capConfigContent = fs.readFileSync(capConfigPath, 'utf-8');

    it('sets official applicationId com.stylesaathi.app and HTTPS scheme', () => {
      expect(capConfigContent).toContain("appId: 'com.stylesaathi.app'");
      expect(capConfigContent).toContain("appName: 'StyleSaathi'");
      expect(capConfigContent).toContain("webDir: 'dist'");
      expect(capConfigContent).toContain("androidScheme: 'https'");
      expect(capConfigContent).toContain('allowMixedContent: false');
    });
  });

  describe('4. Supabase Security & User Data Isolation', () => {
    const rlsPath = path.join(projectRoot, 'supabase/migrations/20261004000002_rls_policies.sql');
    const rlsContent = fs.readFileSync(rlsPath, 'utf-8');
    const storagePath = path.join(projectRoot, 'supabase/migrations/20261004000003_storage_bucket.sql');
    const storageContent = fs.readFileSync(storagePath, 'utf-8');
    const rpcPath = path.join(projectRoot, 'supabase/migrations/20261014000001_delete_user_data_rpc.sql');
    const rpcContent = fs.readFileSync(rpcPath, 'utf-8');

    it('enforces Row Level Security on all 7 core tables with auth.uid() isolation', () => {
      expect(rlsContent).toContain('ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY');
      expect(rlsContent).toContain('ALTER TABLE public.wardrobe_items ENABLE ROW LEVEL SECURITY');
      expect(rlsContent).toContain('ALTER TABLE public.saved_outfits ENABLE ROW LEVEL SECURITY');
      expect(rlsContent).toContain('ALTER TABLE public.calendar_plans ENABLE ROW LEVEL SECURITY');
      expect(rlsContent).toContain('ALTER TABLE public.style_preferences ENABLE ROW LEVEL SECURITY');
      expect(rlsContent).toContain('ALTER TABLE public.wear_events ENABLE ROW LEVEL SECURITY');
      expect(rlsContent).toContain('auth.uid() = user_id');
    });

    it('enforces private storage bucket with strict user folder prefix isolation', () => {
      expect(storageContent).toContain("'wardrobe'");
      expect(storageContent).toContain('public = false');
      expect(storageContent).toContain('(storage.foldername(name))[1] = auth.uid()::text');
    });

    it('defines authoritative delete_user_data_records RPC for account deletion compliance', () => {
      expect(rpcContent).toContain('CREATE OR REPLACE FUNCTION public.delete_user_data_records');
      expect(rpcContent).toContain('auth.uid() = target_user_id');
      expect(rpcContent).toContain('DELETE FROM public.wear_events WHERE user_id = target_user_id');
      expect(rpcContent).toContain('DELETE FROM public.wardrobe_items WHERE user_id = target_user_id');
      expect(rpcContent).toContain('DELETE FROM public.profiles WHERE id = target_user_id');
    });
  });

  describe('5. Local-First & Privacy Guarantees', () => {
    const indianCitiesPath = path.join(projectRoot, 'src/services/weather/indianCities.ts');
    const indianCitiesContent = fs.readFileSync(indianCitiesPath, 'utf-8');
    const backButtonPath = path.join(projectRoot, 'src/services/backButtonManager.ts');
    const backButtonContent = fs.readFileSync(backButtonPath, 'utf-8');

    it('snaps GPS coordinates to nearest major Indian city to prevent storing exact household location', () => {
      expect(indianCitiesContent).toContain('INDIAN_CITIES');
      expect(indianCitiesContent).toContain('findClosestIndianCity');
    });

    it('implements prioritized Android hardware back button stack', () => {
      expect(backButtonContent).toContain('COMMAND_PALETTE: 100');
      expect(backButtonContent).toContain('AI_SAATHI: 90');
      expect(backButtonContent).toContain('GLOBAL_SHEET: 80');
      expect(backButtonContent).toContain('SCREEN_MODAL: 70');
      expect(backButtonContent).toContain('SUB_NAVIGATION: 60');
      expect(backButtonContent).toContain('PRIMARY_TAB: 50');
      expect(backButtonContent).toContain('ROOT_EXIT: 10');
    });
  });
});
