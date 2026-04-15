function tagFor(nature) {
  return nature === 'PERSO' ? 'PERSO' : 'CHARGE';
}

export function classify(rawDetail, type = '', subtype = '') {
  const d = (rawDetail || '').toUpperCase();
  const t = (type || '').trim().toUpperCase();

  let nature, category;
  if (d.includes('AL HOLDING') || d.includes('ALHOLDING')) [nature, category] = ['HORS_EXPL', 'Remboursement dette AL Holding'];
  else if (d.includes('SABBAN')) [nature, category] = ['PRO', 'Salaires'];
  else if (d.includes('SDC 190 BD BINEAU') || d.includes('SDC 190 BINEAU')) [nature, category] = ['PRO', 'Loyer pro'];
  else if (d.includes('LUMAY') || d.includes('LUMA AVOCAT')) [nature, category] = ['PRO', 'Honoraires'];
  else if (d.includes('KODSI') || d.includes('SARINA') || d.includes('COACHING')) [nature, category] = ['PRO', 'Coaching'];
  else if (d.includes('HENNER')) [nature, category] = ['PRO', 'Mutuelle'];
  else if (d.includes('AIG - FRANCE') || d.includes('AIG FRANCE') || d.includes('AIG-FRANCE')) [nature, category] = ['PRO', 'Assurance Pro'];
  else if (d.includes('ZOUARI')) [nature, category] = ['PRO', 'Rbt exceptionnel client'];
  else if (/CLAUDE\.AI|ANTHROPIC|NOTION|USENOTION|LEMSQZY|NOTEFORMS|APPLE\.COM|ADOBE|OPENAI|CHATGPT|ECILIA/.test(d)) [nature, category] = ['PRO', 'Logiciels'];
  else if (d.includes('BOUYGUES') || d.includes('FREE TELECOM') || d.includes('FREE MOBILE')) [nature, category] = ['PRO', 'Telecom'];
  else if (/GOOGLE WORKSPAC|GANDI|CONTABO/.test(d)) [nature, category] = ['PRO', 'IT / Hébergement'];
  else if (d.includes('DIGIDOM')) [nature, category] = ['PRO', 'Domiciliation'];
  else if (d.includes('CNCEF') || d.includes('AM&JT') || d.includes('AMJT')) [nature, category] = ['PRO', 'Formation'];
  else if (d.includes('ORIAS') || d.includes('INFOGREFFE')) [nature, category] = ['PRO', 'Réglementation'];
  else if (t === 'COMMISSIONS' || d.includes('COMMISSIONS FACTURE') || d.includes('COMMISSION INTERVENT')) [nature, category] = ['PRO', 'Frais bancaires'];
  else if (d.includes('AMAZON') || d.includes('AMZ DIGITAL') || d.includes('AMZN ')) [nature, category] = ['PERSO', 'Amazon'];
  else if (/CONSISTOIRE|ALLODONS|JUDAIC|CHARIDY|TZEDAKA/.test(d)) [nature, category] = ['PERSO', 'Dons'];
  else {
    const ALIM = ['FRANPRIX','CARREFOUR','CARREF','PICARD','MONOP','ALDI','POINCARE DISTRI','CHANTHI','BDB ','AFRIKA','BUDDIE','92 DISTRIB','YBRY KASH','KAYSER','BOULANGERIE','CHEZ MEUNIER','BEKEF','MISSADA','B.L.S','STARBUCKS','CHINA LEE','CHARLES ET DAN','GABRIEL PARIS','MAISON GABRIEL','LE VERGER','ABRAHAM','SHINZZO','PHARMACIE','LAPOSTE','TABAC','TALIROULE','MF00','VILLENEUVE LA','SUSHI','KOSHER'];
    const SHOP = ['UNIQLO','FNAC','JRMC','BEAUX TITRE','TEMU','PAYPAL','JIUHAOK','ZARA','H&M'];
    const AUTO = ['COFIROUTE','AREAS','ASF ','TOTAL ','SARGE LES','PARK FOCH','MINIT','RELAIS ST BRICE','ESSENCE','STATION ESSO','SHELL','BP FRANCE'];
    if (ALIM.some(k => d.includes(k))) [nature, category] = ['PERSO', 'Alimentation & vie courante'];
    else if (SHOP.some(k => d.includes(k))) [nature, category] = ['PERSO', 'Shopping'];
    else if (AUTO.some(k => d.includes(k))) [nature, category] = ['PERSO', 'Auto / Déplacements'];
    else if (d.includes('DISNEY') || d.includes('UBER')) [nature, category] = ['PERSO', 'Divers perso'];
    else [nature, category] = ['PERSO', 'Divers perso'];
  }

  return [nature, category, tagFor(nature)];
}
