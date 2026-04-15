export const NATURES = ['PRO', 'PERSO', 'HORS_EXPL'];

export const CATEGORIES = {
  PRO: [
    'Salaires', 'Loyer pro', 'Honoraires', 'Coaching', 'Mutuelle',
    'Logiciels', 'Assurance Pro', 'Rbt exceptionnel client',
    'Telecom', 'IT / Hébergement', 'Domiciliation', 'Formation',
    'Réglementation', 'Frais bancaires', 'Autre Pro'
  ],
  PERSO: [
    'Salaires', 'Alimentation & vie courante', 'Dons', 'Amazon',
    'Shopping', 'Auto / Déplacements', 'Divers perso'
  ],
  HORS_EXPL: [
    'Remboursement dette AL Holding', 'Apport associé', 'Autre hors expl.'
  ],
};

export const NATURE_LABEL = { PRO: 'Pro', PERSO: 'Perso', HORS_EXPL: 'Hors expl.' };

export const NATURE_COLORS = {
  PRO: { bar: '#2563eb', badge_bg: '#dbeafe', badge_fg: '#1d4ed8' },
  PERSO: { bar: '#f97316', badge_bg: '#fed7aa', badge_fg: '#c2410c' },
  HORS_EXPL: { bar: '#94a3b8', badge_bg: '#e2e8f0', badge_fg: '#475569' },
};
