export const PALETTE = {
  ink: "#171717",
  paper: "#FFF9EC",
  paperDeep: "#F1E9D8",
  white: "#FFFFFF",
  acid: "#D9FF43",
  violet: "#8C6BFF",
  cyan: "#5DE2E7",
  coral: "#FF6B5E",
  pink: "#FF8FD8",
  amber: "#FFC857",
  muted: "#6D685F",
  fog: "#D7D0C2",
  success: "#39C66D",
} as const;

export const SHADOW = {
  shadowColor: PALETTE.ink,
  shadowOffset: { width: 5, height: 5 },
  shadowOpacity: 1,
  shadowRadius: 0,
  elevation: 5,
} as const;

export const SMALL_SHADOW = {
  shadowColor: PALETTE.ink,
  shadowOffset: { width: 3, height: 3 },
  shadowOpacity: 1,
  shadowRadius: 0,
  elevation: 3,
} as const;

export const BORDER = 3;

