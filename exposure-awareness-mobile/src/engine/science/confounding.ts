/**
 * A confounding demonstration on a clearly ILLUSTRATIVE dataset (not real data): coffee
 * drinkers look like they have ~3x the outcome rate, but the whole gap is because more of
 * them smoke. Within each smoking group the rates are identical.
 */
import { msg } from "../../i18n";
export interface Stratum {
  label: string;
  exposed: { n: number; cases: number };
  unexposed: { n: number; cases: number };
}

export const ILLUSTRATIVE_STRATA: Stratum[] = [
  { label: msg("Smokers"), exposed: { n: 800, cases: 80 }, unexposed: { n: 200, cases: 20 } },
  { label: msg("Non-smokers"), exposed: { n: 200, cases: 2 }, unexposed: { n: 800, cases: 8 } },
];

const rate = (g: { n: number; cases: number }) => g.cases / g.n;

export function crudeRR(strata: Stratum[]): number {
  const sum = (pick: (s: Stratum) => { n: number; cases: number }) =>
    strata.reduce((a, s) => ({ n: a.n + pick(s).n, cases: a.cases + pick(s).cases }), { n: 0, cases: 0 });
  return rate(sum((s) => s.exposed)) / rate(sum((s) => s.unexposed));
}

/** Mantel-Haenszel pooled risk ratio: the association after accounting for the stratifier. */
export function adjustedRR(strata: Stratum[]): number {
  let num = 0;
  let den = 0;
  for (const s of strata) {
    const total = s.exposed.n + s.unexposed.n;
    num += (s.exposed.cases * s.unexposed.n) / total;
    den += (s.unexposed.cases * s.exposed.n) / total;
  }
  return num / den;
}

export function stratumRR(s: Stratum): number {
  return rate(s.exposed) / rate(s.unexposed);
}
