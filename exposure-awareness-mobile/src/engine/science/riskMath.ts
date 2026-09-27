/**
 * Relative vs. absolute risk. The point of this module is to make one thing unavoidable:
 * a headline's "X times the risk" means nothing until it is multiplied by the baseline.
 * absolute change = baseline x (RR - 1).
 */
export interface RiskInput {
  /** Baseline risk as "1 in N" (N >= 1). */
  oneIn: number;
  relativeRisk: number;
}

export interface RiskResult {
  baseline: number;
  exposed: number;
  absoluteIncrease: number;
  perThousandBaseline: number;
  perThousandExposed: number;
  perThousandExtra: number;
  percentIncrease: number;
  /** People who would need the exposure for one extra case; null if no increase. */
  numberNeededToHarm: number | null;
  capped: boolean;
}

export function computeRisk({ oneIn, relativeRisk }: RiskInput): RiskResult {
  const baseline = 1 / Math.max(1, oneIn);
  const raw = baseline * relativeRisk;
  const exposed = Math.min(1, raw);
  const inc = exposed - baseline;
  return {
    baseline,
    exposed,
    absoluteIncrease: inc,
    perThousandBaseline: baseline * 1000,
    perThousandExposed: exposed * 1000,
    perThousandExtra: inc * 1000,
    percentIncrease: (relativeRisk - 1) * 100,
    numberNeededToHarm: inc > 0 ? Math.round(1 / inc) : null,
    capped: raw > 1,
  };
}

export function formatPerThousand(n: number): string {
  if (n >= 10) return String(Math.round(n));
  if (n >= 1) return (Math.round(n * 10) / 10).toString();
  if (n >= 0.01) return (Math.round(n * 100) / 100).toString();
  return "<0.01";
}

export function formatOneIn(p: number): string {
  if (p <= 0) return "0";
  return `1 in ${Math.round(1 / p).toLocaleString("en-US")}`;
}

/** The one-sentence translation: headline framing on the left, honest framing on the right. */
export function translate(input: RiskInput): { headline: string; honest: string } {
  const r = computeRisk(input);
  const headline = `"${input.relativeRisk}x the risk" -- a ${Math.round(r.percentIncrease)}% increase`;
  const honest = `${formatOneIn(r.baseline)} becomes ${formatOneIn(r.exposed)} -- ${formatPerThousand(r.perThousandExtra)} extra per 1,000 people`;
  return { headline, honest };
}

/** Questions worth taking to a clinician or reading a paper with -- filled in with the user's numbers. */
export function questionsForCareTeam(input: RiskInput): string[] {
  const r = computeRisk(input);
  return [
    `Is the baseline (${formatOneIn(r.baseline)}) right for someone like me -- my age, sex and history?`,
    `In absolute terms, does this change mean about ${formatPerThousand(r.perThousandExtra)} more per 1,000 people, or is it different for my situation?`,
    "How large and how well-designed was the study, and has the result been replicated?",
    "What else differs between the groups that could explain it (smoking, age, diet, income)?",
    "Was the exposure in the study similar in amount and duration to mine?",
    "What is the range of plausible values (confidence interval), not just the headline number?",
  ];
}
