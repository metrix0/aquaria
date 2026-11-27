export const beneficial = (p, amount) => amount * (1 + (p.skillBonuses?.effectPower || 0));
export const harmful = (p, amount) => amount * (1 - (p.skillBonuses?.effectPower || 0));
