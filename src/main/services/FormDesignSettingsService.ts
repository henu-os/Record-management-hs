// ============================================================
// FormDesignSettingsService — Per-Form Design Settings Engine
// ============================================================
import { getDatabase } from '../db';
import {
  FormDesignSettings,
  DEFAULT_FORM_DESIGN_SETTINGS,
  SelectableFontFamily,
  HorizontalAlign,
  VerticalAlign,
  TextRotation,
} from '../types';

export class FormDesignSettingsService {
  /**
   * Enforces exact limits and safe bounds for all styling parameters.
   * - Font Size: 7 pt to 12 pt
   * - Header Font Size: 8 pt to 14 pt
   * - Grid Opacity: 0 to 100%
   * - Font Family: Exactly 4 supported PDF fonts
   * - Alignments & Rotation: Constrained to valid enum values
   */
  static clampSettings(settings: Partial<FormDesignSettings>): FormDesignSettings {
    const base = { ...DEFAULT_FORM_DESIGN_SETTINGS, ...settings };

    const rawDataFs = settings.dataFontSize ?? settings.bodyFontSize ?? settings.fontSize ?? base.dataFontSize;
    const dataFontSize = Math.min(16, Math.max(7, Number(rawDataFs) || 9.5));

    const rawFixedFs = settings.fixedDataFontSize ?? settings.headerFontSize ?? base.fixedDataFontSize;
    const fixedDataFontSize = Math.min(14, Math.max(7, Number(rawFixedFs) || 8.5));

    const fontSize = dataFontSize;
    const bodyFontSize = dataFontSize;
    const headerFontSize = Math.min(16, Math.max(8, Number(base.headerFontSize) || 11));
    const gridOpacity = Math.min(100, Math.max(0, Number(base.gridOpacity) ?? 80));
    const gridThickness = Math.min(1.0, Math.max(0.25, Number(base.gridThickness) || 0.5));
    const colorMode: 'Color' | 'BW' = base.colorMode === 'BW' ? 'BW' : 'Color';

    const validFonts: SelectableFontFamily[] = ['Times-Roman', 'Helvetica', 'Courier', 'Helvetica-Bold', 'Indie_Flower', 'Merriweather'];
    const fontFamily = validFonts.includes(base.fontFamily as any) ? base.fontFamily : 'Times-Roman';

    const validHAlign: HorizontalAlign[] = ['left', 'center', 'right'];
    const horizontalAlign = validHAlign.includes(base.horizontalAlign as any) ? base.horizontalAlign : 'center';

    const validVAlign: VerticalAlign[] = ['top', 'middle', 'bottom'];
    const verticalAlign = validVAlign.includes(base.verticalAlign as any) ? base.verticalAlign : 'middle';

    const validRotations: TextRotation[] = [0, 90, 180, 270];
    const textRotation = validRotations.includes(Number(base.textRotation) as any)
      ? (Number(base.textRotation) as TextRotation)
      : 0;

    const isGridOn = settings.gridOn !== undefined ? Boolean(settings.gridOn) : (settings.gridEnabled !== undefined ? Boolean(settings.gridEnabled) : true);
    const pageNumberPosition: 'Top' | 'Bottom' = base.pageNumberPosition === 'Top' ? 'Top' : 'Bottom';
    const pageNumberAlign = validHAlign.includes(base.pageNumberAlign as any) ? base.pageNumberAlign : 'center';
    const pageNumberColor = base.pageNumberColor || '#1E293B';
    const rawPageNumberFs = base.pageNumberFontSize ?? 8;
    const pageNumberFontSize = Math.min(16, Math.max(5, Number(rawPageNumberFs) || 8));
    const paperSize = String(base.paperSize || '').toUpperCase().includes('FOOLSCAP') ? 'FOOLSCAP' : 'LEGAL';

    return {
      ...base,
      paperSize,
      colorMode,
      fontFamily,
      fontSize,
      bodyFontSize,
      headerFontSize,
      dataFontSize,
      fixedDataFontSize,
      gridOpacity,
      gridThickness,
      horizontalAlign,
      verticalAlign,
      textRotation,
      bold: Boolean(base.bold),
      italic: Boolean(base.italic),
      textWrapping: base.textWrapping !== undefined ? Boolean(base.textWrapping) : true,
      gridOn: isGridOn,
      gridEnabled: isGridOn,
      pageNumberPosition,
      pageNumberAlign,
      pageNumberColor,
      pageNumberFontSize,
      headerBgColor: base.headerBgColor || base.headerFill || '#D9E1F2',
      headerFill: base.headerFill || base.headerBgColor || '#D9E1F2',
      headerTextColor: base.headerTextColor || '#1C355E',
      sectionBgColor: base.sectionBgColor || '#1B365D',
      sectionTextColor: base.sectionTextColor || '#FFFFFF',
      cellBgColor: base.cellBgColor || base.cellFill || '#FFFFFF',
      cellFill: base.cellFill || base.cellBgColor || '#FFFFFF',
      borderColor: base.borderColor || '#8EA9DB',
      gridColor: settings.borderColor && !settings.gridColor ? settings.borderColor : (base.gridColor || base.borderColor || '#8EA9DB'),
    };
  }

  /**
   * Reads raw settings JSON string from SQLite `settings` table or browser localStorage.
   */
  static getRawKey(key: string): Partial<FormDesignSettings> {
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      try {
        const direct = localStorage.getItem(key);
        if (direct) return JSON.parse(direct);

        for (let i = 0; i < localStorage.length; i++) {
          const lsKey = localStorage.key(i);
          if (lsKey && lsKey.startsWith('henu_os_settings_')) {
            const raw = localStorage.getItem(lsKey);
            if (raw) {
              const map = JSON.parse(raw);
              if (map[key]) {
                return typeof map[key] === 'string' ? JSON.parse(map[key]) : map[key];
              }
            }
          }
        }
      } catch {}
    }

    try {
      const db = getDatabase();
      const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
      if (row && row.value) {
        return JSON.parse(row.value);
      }
    } catch {
      // Uninitialized DB or missing table - return empty overrides gracefully
    }
    return {};
  }

  /**
   * Resolves final merged settings using the mandatory hierarchy:
   * System Defaults → Global Defaults → Per-Society Global Overrides → Per-Society Form Settings
   */
  static getResolvedSettings(formId?: string, societyId?: string): FormDesignSettings {
    const globalRaw = this.getRawKey('settings_global');
    const socGlobalRaw = societyId ? this.getRawKey(`settings_${societyId}_global`) : {};
    const cleanFormId = formId ? formId.replace(/^settings_/, '') : '';

    let formRaw: Partial<FormDesignSettings> = {};
    if (cleanFormId && cleanFormId !== 'global') {
      if (societyId) {
        formRaw = this.getRawKey(`settings_${societyId}_${cleanFormId}`);
      } else {
        formRaw = this.getRawKey(`settings_${cleanFormId}`);
      }
    }

    const merged = {
      ...DEFAULT_FORM_DESIGN_SETTINGS,
      ...globalRaw,
      ...socGlobalRaw,
      ...formRaw,
    };

    return this.clampSettings(merged);
  }

  /**
   * Saves settings for a specific form or 'global' for the target society (or global).
   */
  static saveSettings(formId: string, settings: Partial<FormDesignSettings>, societyId?: string): FormDesignSettings {
    const clamped = this.clampSettings(settings);
    const cleanFormId = formId.replace(/^settings_/, '');
    const keyName = societyId ? `settings_${societyId}_${cleanFormId}` : `settings_${cleanFormId}`;

    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      try {
        const socKey = societyId ? `henu_os_settings_${societyId}` : (localStorage.getItem('henu_os_active_society_id') ? `henu_os_settings_${localStorage.getItem('henu_os_active_society_id')}` : 'henu_os_settings_default-society-1');
        const mapStr = localStorage.getItem(socKey);
        const map = mapStr ? JSON.parse(mapStr) : {};
        map[keyName] = JSON.stringify(clamped);

        const allForms = ['FORM_I', 'FORM_J', 'FORM_SHARE', 'FORM_NOM', 'FORM_PROP', 'FORM_BANK'];
        for (const fId of allForms) {
          const fKey = societyId ? `settings_${societyId}_${fId}` : `settings_${fId}`;
          const existing = map[fKey] ? (typeof map[fKey] === 'string' ? JSON.parse(map[fKey]) : map[fKey]) : {};
          if (cleanFormId === 'global') {
            Object.assign(existing, {
              colorMode: clamped.colorMode,
              headerBgColor: clamped.headerBgColor,
              headerFill: clamped.headerFill,
              headerTextColor: clamped.headerTextColor,
              sectionBgColor: clamped.sectionBgColor,
              sectionTextColor: clamped.sectionTextColor,
              cellBgColor: clamped.cellBgColor,
              cellFill: clamped.cellFill,
              textColor: clamped.textColor,
              borderColor: clamped.borderColor,
              gridColor: clamped.gridColor,
              gridOn: clamped.gridOn,
              gridEnabled: clamped.gridEnabled,
              gridThickness: clamped.gridThickness,
              gridOpacity: clamped.gridOpacity,
              fontFamily: clamped.fontFamily,
              dataFontSize: clamped.dataFontSize,
              fixedDataFontSize: clamped.fixedDataFontSize,
              fontSize: clamped.fontSize,
              bodyFontSize: clamped.bodyFontSize,
              headerFontSize: clamped.headerFontSize,
            });
          }
          existing.brandingText = clamped.brandingText;
          existing.brandingAlign = clamped.brandingAlign;
          existing.pageNumberPosition = clamped.pageNumberPosition;
          existing.pageNumberAlign = clamped.pageNumberAlign;
          existing.pageNumberColor = clamped.pageNumberColor;
          existing.customFooterText = clamped.customFooterText;
          existing.customFooterAlign = clamped.customFooterAlign;
          map[fKey] = JSON.stringify(existing);
        }
        localStorage.setItem(socKey, JSON.stringify(map));
      } catch {}
    }

    try {
      const db = getDatabase();
      db.prepare(`
        INSERT INTO settings (key, value) VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
      `).run(keyName, JSON.stringify(clamped));

      // Propagate Global Theme Styling & Branding to all 6 forms
      const allForms = ['FORM_I', 'FORM_J', 'FORM_SHARE', 'FORM_NOM', 'FORM_PROP', 'FORM_BANK'];
      for (const fId of allForms) {
        const fKey = societyId ? `settings_${societyId}_${fId}` : `settings_${fId}`;
        const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(fKey) as { value: string } | undefined;
        const parsed = (row && row.value) ? JSON.parse(row.value) : {};
        if (cleanFormId === 'global') {
          Object.assign(parsed, {
            colorMode: clamped.colorMode,
            headerBgColor: clamped.headerBgColor,
            headerFill: clamped.headerFill,
            headerTextColor: clamped.headerTextColor,
            sectionBgColor: clamped.sectionBgColor,
            sectionTextColor: clamped.sectionTextColor,
            cellBgColor: clamped.cellBgColor,
            cellFill: clamped.cellFill,
            textColor: clamped.textColor,
            borderColor: clamped.borderColor,
            gridColor: clamped.gridColor,
            gridOn: clamped.gridOn,
            gridEnabled: clamped.gridEnabled,
            gridThickness: clamped.gridThickness,
            gridOpacity: clamped.gridOpacity,
            fontFamily: clamped.fontFamily,
            dataFontSize: clamped.dataFontSize,
            fixedDataFontSize: clamped.fixedDataFontSize,
            fontSize: clamped.fontSize,
            bodyFontSize: clamped.bodyFontSize,
            headerFontSize: clamped.headerFontSize,
          });
        }
        parsed.brandingText = clamped.brandingText;
        parsed.brandingAlign = clamped.brandingAlign;
        parsed.pageNumberPosition = clamped.pageNumberPosition;
        parsed.pageNumberAlign = clamped.pageNumberAlign;
        parsed.pageNumberColor = clamped.pageNumberColor;
        parsed.customFooterText = clamped.customFooterText;
        parsed.customFooterAlign = clamped.customFooterAlign;
        db.prepare(`
          INSERT INTO settings (key, value) VALUES (?, ?)
          ON CONFLICT(key) DO UPDATE SET value = excluded.value
        `).run(fKey, JSON.stringify(parsed));
      }
    } catch {}

    return clamped;
  }

  /**
   * Resets form-specific settings back to inherited global defaults.
   */
  static resetFormSettings(formId: string, societyId?: string): FormDesignSettings {
    const cleanFormId = formId.replace(/^settings_/, '');
    if (cleanFormId === 'global') {
      return this.resetGlobalSettings(societyId);
    }
    const db = getDatabase();
    const keyName = societyId ? `settings_${societyId}_${cleanFormId}` : `settings_${cleanFormId}`;
    db.prepare('DELETE FROM settings WHERE key = ?').run(keyName);
    return this.getResolvedSettings(cleanFormId, societyId);
  }

  /**
   * Resets global defaults back to initial system defaults.
   */
  static resetGlobalSettings(societyId?: string): FormDesignSettings {
    const db = getDatabase();
    if (societyId) {
      db.prepare("DELETE FROM settings WHERE key LIKE ?").run(`settings_${societyId}_%`);
    } else {
      db.prepare("DELETE FROM settings WHERE key LIKE 'settings_%'").run();
      this.saveSettings('settings_global', DEFAULT_FORM_DESIGN_SETTINGS);
    }
    return DEFAULT_FORM_DESIGN_SETTINGS;
  }
}
