// frontend/src/lib/design.ts — Charte graphique SEMENCE EPARGNE
// Couleurs extraites du logo officiel SemenceEp (orange #F65A04 + bleu #1C5B9B)

export const C = {
  // Couleurs primaires logo
  primary:      '#F65A04',
  primaryDark:  '#C94800',
  primaryPale:  '#FFF0E8',
  secondary:    '#1C5B9B',
  secondaryDk:  '#154680',
  secondaryPl:  '#E8F0FB',

  // Couleurs fonctionnelles
  green:        '#2d6a4f',
  greenLight:   '#40916c',
  greenPale:    '#d8f3dc',
  greenBg:      '#f0faf2',
  gold:         '#F65A04',
  goldPale:     '#FFF0E8',
  red:          '#e63946',
  redPale:      '#fee2e5',
  blue:         '#1C5B9B',
  bluePale:     '#E8F0FB',

  // Sidebar aux couleurs du logo
  sidebar:      '#0F2E52',
  sidebarBg:    '#0F2E52',
  sidebarText:  '#a8c0d6',
  activeBg:     'rgba(246,90,4,0.15)',
  activeText:   '#F65A04',

  // Neutres
  white:        '#ffffff',
  bg:           '#f4f7fb',
  border:       '#dde6f0',
  borderLight:  '#eef2f8',
  text:         '#0F2E52',
  textMuted:    '#5a7a9a',
  textLight:    '#8aa5c0',
  muted:        '#5a7a9a',

  // Coordonnées officielles
  whatsapp:     '+2250708249583',
  emailContact: 'infos@semenceep.ci',
  domain:       'semenceep.ci',
};

export const STATUS_STYLES: Record<string, { bg: string; color: string }> = {
  actif: { bg: C.greenPale, color: C.green },
  succes: { bg: C.greenPale, color: C.green },
  disponible: { bg: C.greenPale, color: C.green },
  en_attente: { bg: '#fef3c7', color: '#92400e' },
  en_cours: { bg: C.bluePale, color: C.blue },
  suspendu: { bg: C.redPale, color: C.red },
  echec: { bg: C.redPale, color: C.red },
  annulee: { bg: C.redPale, color: C.red },
  cloture: { bg: '#f1f5f9', color: '#475569' },
  utilisee: { bg: '#f1f5f9', color: '#475569' },
  vendue: { bg: C.bluePale, color: C.blue },
};

export default C;
