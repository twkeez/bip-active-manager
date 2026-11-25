import type { StrategyMapperService } from "@/types/strategy-mapper";

export const BRAND_COLORS = {
  brandBlue: "#2A52BE",
  brandPurple: "#B31B6B",
  brandMagenta: "#B31B6B",
  brandPink: "#D91A7A",
  brandText: "#2D3748",
  brandTextDark: "#2A52BE",
  brandBg: "#FFFFFF",
  brandWash: "#FAF5F7",
  brandBorderLight: "#FAF5F7",
  brandCalloutText: "#5D318C",
} as const;

export const FONT_STACK =
  "'Montserrat', 'Poppins', 'Helvetica Neue', Helvetica, Arial, sans-serif";

export const SERVICE_ICONS: Record<StrategyMapperService, string> = {
  seo: "🌐",
  ppc: "🎯",
  social: "📱",
  orm: "⭐",
};

export function h1Style(): string {
  return `color: ${BRAND_COLORS.brandTextDark}; font-family: ${FONT_STACK}; font-size: 28px; font-weight: bold; margin: 0 0 16px 0;`;
}

export function h2Style(): string {
  return `color: ${BRAND_COLORS.brandPurple}; font-family: ${FONT_STACK}; font-size: 20px; font-weight: bold; margin: 24px 0 12px 0;`;
}

export function h2ServiceStyle(): string {
  return `color: ${BRAND_COLORS.brandPurple}; font-family: ${FONT_STACK}; font-size: 20px; font-weight: bold; margin: 20px 0 10px 0;`;
}

export function bodyStyle(): string {
  return `color: ${BRAND_COLORS.brandText}; font-family: ${FONT_STACK}; font-size: 14px; line-height: 1.6; margin: 0 0 12px 0;`;
}

export function labelStyle(): string {
  return `color: ${BRAND_COLORS.brandMagenta}; font-weight: bold;`;
}

export function highlightSpanStyle(): string {
  return `color: ${BRAND_COLORS.brandPink}; font-weight: bold;`;
}

export function tableStyle(): string {
  return `width: 100%; border-collapse: collapse; margin: 12px 0 20px 0; font-family: ${FONT_STACK}; font-size: 14px;`;
}

export function tableHeaderStyle(): string {
  return `background-color: ${BRAND_COLORS.brandBlue}; color: ${BRAND_COLORS.brandBg}; padding: 12px; text-align: left; font-weight: bold; border: 1px solid ${BRAND_COLORS.brandBorderLight};`;
}

export function tableCellStyle(): string {
  return `padding: 10px 12px; border: 1px solid ${BRAND_COLORS.brandBorderLight}; background-color: ${BRAND_COLORS.brandBg}; color: ${BRAND_COLORS.brandText};`;
}

export function observationBlockStyle(): string {
  return `background-color: ${BRAND_COLORS.brandWash}; color: ${BRAND_COLORS.brandCalloutText}; border-left: 4px solid ${BRAND_COLORS.brandPurple}; padding: 15px; margin: 16px 0; font-family: ${FONT_STACK}; font-size: 14px; line-height: 1.6;`;
}

export function bodyShellStyle(): string {
  return `background-color: ${BRAND_COLORS.brandBg}; font-family: ${FONT_STACK}; color: ${BRAND_COLORS.brandText}; margin: 0; padding: 24px;`;
}

export function containerStyle(): string {
  return `max-width: 800px; margin: 0 auto;`;
}

export function bulletListStyle(): string {
  return `color: ${BRAND_COLORS.brandText}; font-family: ${FONT_STACK}; font-size: 14px; line-height: 1.6; margin: 0 0 12px 0; padding-left: 20px;`;
}

export function checklistItemStyle(): string {
  return `color: ${BRAND_COLORS.brandText}; font-family: ${FONT_STACK}; font-size: 14px; line-height: 1.8; margin: 0 0 8px 0; list-style: none;`;
}
