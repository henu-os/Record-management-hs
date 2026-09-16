// ============================================================
// HENU OS — Share Certificate Physical Print Configuration
// Master Print Specification: 19" x 13", 350 GSM Landscape
// ============================================================

export const PRINT_CONFIG = {
  // Physical sheet dimensions (points: 72 points = 1 inch)
  SHEET_WIDTH_INCHES: 19.0,
  SHEET_HEIGHT_INCHES: 13.0,
  SHEET_WIDTH_PT: 1368,  // 19.00 * 72
  SHEET_HEIGHT_PT: 936,  // 13.00 * 72

  // Paper Weight & Stock
  PAPER_WEIGHT: '350 GSM',
  PAPER_FINISH: 'Gloss Coated / Art Card',
  ORIENTATION: 'LANDSCAPE' as const,

  // Safe Margin on ALL four sides (0.67 inches = 48.24 pt ~ 48 pt)
  SAFE_MARGIN_INCHES: 0.67,
  SAFE_MARGIN_PT: 48,

  // Safe Rectangle
  SAFE_RECT: {
    x: 48,
    y: 48,
    width: 1272,  // 1368 - (2 * 48)
    height: 840,  // 936 - (2 * 48)
  },

  // Color Palette (Matched to Master Reference Artwork)
  COLORS: {
    RED_PRIMARY: { r: 192 / 255, g: 0, b: 0 },         // #C00000 Vibrant Master Red
    RED_DARK: { r: 140 / 255, g: 0, b: 0 },            // #8C0000 Deep Maroon for headings
    GOLD_ACCENT: { r: 180 / 255, g: 130 / 255, b: 20 / 255 }, // #B48214 Ornate Gold Border Accent
    NAVY_BLUE: { r: 28 / 255, g: 53 / 255, b: 94 / 255 },     // #1C355E Society Address & Value Box
    TEXT_BLACK: { r: 0, g: 0, b: 0 },                  // Pure Black
    TEXT_MUTED: { r: 80 / 255, g: 80 / 255, b: 80 / 255 },
    BORDER_GRAY: { r: 180 / 255, g: 180 / 255, b: 180 / 255 },
    SEAL_GRAY: { r: 200 / 255, g: 200 / 255, b: 200 / 255 },
    WHITE: { r: 1, g: 1, b: 1 },
  },
};
