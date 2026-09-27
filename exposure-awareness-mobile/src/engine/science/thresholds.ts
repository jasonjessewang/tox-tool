/**
 * Reference dose from a point of departure and uncertainty factors, following the standard
 * regulatory recipe: RfD = NOAEL / (UF_interspecies x UF_human x any extra factors).
 * Values in the UI are illustrative, not a real chemical.
 */
export interface ExtraFactor {
  id: string;
  label: string;
  why: string;
}

export const EXTRA_FACTORS: ExtraFactor[] = [
  { id: "loael", label: "Only a LOAEL was available", why: "The lowest dose tested still showed an effect, so the true no-effect dose is lower and unknown." },
  { id: "subchronic", label: "Short study, lifetime exposure", why: "Effects that need long exposure may not show up in a short animal study." },
  { id: "database", label: "Gaps in the data", why: "Missing studies (e.g. on development or reproduction) call for extra caution." },
];

export interface ThresholdInput {
  noael: number;
  interspecies?: number;
  human?: number;
  extra?: number[];
}

export function deriveRfD({ noael, interspecies = 10, human = 10, extra = [] }: ThresholdInput): { rfd: number; totalFactor: number } {
  const totalFactor = [interspecies, human, ...extra].reduce((a, b) => a * Math.max(1, b), 1);
  return { rfd: noael / totalFactor, totalFactor };
}
