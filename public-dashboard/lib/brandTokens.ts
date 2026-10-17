// GENERATED from config/brand_tokens.json by scripts/brand-tokens.mjs. Do not edit by hand.
// Light-mode values for code that cannot read CSS custom properties (ArcGIS symbols, SVG charts).
export const brandPalette = {
  "hemlock": "#0D5C4B",
  "deepWater": "#167A8B",
  "goldenrod": "#A76100",
  "goldenrodText": "#955600",
  "fern": "#2E7D52",
  "alert": "#A3342B",
  "limestone50": "#F6F3EC",
  "limestone100": "#EDE8DD",
  "limestone300": "#D6CEBF",
  "ink": "#1C2522",
  "inkMuted": "#4C5854",
  "night": "#0F1A17",
  "night2": "#17261F",
  "onDark": "#ECE8DF",
  "onDarkMuted": "#A9B3AE",
  "hemlock300": "#6CC3AA",
  "deepWater300": "#6CC2D1",
  "goldenrod300": "#E6A941",
  "fern300": "#7CC79A",
  "alert300": "#F08A7E",
  "iconStroke": "#F4EFE6"
} as const;

export const brandLight = {
  "canvas": "#F6F3EC",
  "surface": "#FBFAF6",
  "surfaceHeader": "#F2EEE5",
  "surfaceRaised": "#EDE8DD",
  "surfaceField": "#FFFFFF",
  "line": "#D6CEBF",
  "lineSoft": "#E3DCCF",
  "lineStrong": "#9AA39F",
  "lineInput": "#7E8984",
  "ink": "#1C2522",
  "inkMuted": "#4C5854",
  "primary": "#0D5C4B",
  "onPrimary": "#F6F3EC",
  "primarySoft": "#E2EDE6",
  "water": "#167A8B",
  "goldGraphic": "#A76100",
  "goldText": "#955600",
  "fern": "#2E7D52",
  "alert": "#A3342B"
} as const;

export const brandStatusLight = {
  "neutral": {
    "bg": "transparent",
    "border": "#9AA39F",
    "mark": "#4C5854",
    "text": "#1C2522",
    "markStyle": "outline"
  },
  "submitted": {
    "bg": "#DDEDF0",
    "border": "#DDEDF0",
    "mark": "#167A8B",
    "text": "#1C2522"
  },
  "review": {
    "bg": "#F5EAD9",
    "border": "#F5EAD9",
    "mark": "#955600",
    "text": "#1C2522"
  },
  "attention": {
    "bg": "#F6E3E1",
    "border": "#F6E3E1",
    "mark": "#A3342B",
    "text": "#1C2522"
  },
  "approved": {
    "bg": "#E0EFE5",
    "border": "#E0EFE5",
    "mark": "#2E7D52",
    "text": "#1C2522"
  },
  "published": {
    "bg": "#0D5C4B",
    "border": "#0D5C4B",
    "mark": "#E6A941",
    "text": "#F6F3EC"
  }
} as const;

export type WorkflowTone = 'neutral' | 'submitted' | 'review' | 'attention' | 'approved' | 'published';

/** Presentation tone for each canonical workflow state. Color only; never meaning. */
export const workflowTone: Record<string, WorkflowTone> = {
  "DRAFT": "neutral",
  "SUBMITTED": "submitted",
  "VALIDATING": "submitted",
  "RESUBMITTED": "submitted",
  "PENDING_REVIEW": "review",
  "NEEDS_CORRECTION": "attention",
  "REJECTED": "attention",
  "PUBLISH_FAILED": "attention",
  "APPROVED": "approved",
  "PUBLISHING": "approved",
  "PUBLISHED": "published"
};
