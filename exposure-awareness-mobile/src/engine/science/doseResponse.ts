/**
 * Three stylized dose-response shapes on a log-dose axis, dose expressed as multiples of the
 * study's NOAEL. Illustrative shapes for teaching -- not a fit to any chemical.
 */
import { msg } from "../../i18n";
export type DoseModel = "threshold" | "linear" | "nonmonotonic";

export const MODEL_INFO: Record<DoseModel, { label: string; blurb: string }> = {
  threshold: {
    label: msg("Threshold"),
    blurb: msg("Nothing detectable until a dose is reached, then response climbs. The classic 'dose makes the poison' shape, and what most safety thresholds assume."),
  },
  linear: {
    label: msg("Linear, no threshold"),
    blurb: msg("Any dose adds some risk, in proportion. Used conservatively for some cancer-causing agents (e.g. radon in the pooled home studies showed no safe threshold)."),
  },
  nonmonotonic: {
    label: msg("Non-monotonic"),
    blurb: msg("A low dose can have an effect that a middle dose doesn't. Debated, but documented for some hormone-active chemicals -- why high-dose-only testing can miss things."),
  },
};

const logistic = (x: number, mid: number, k: number) => 1 / (1 + Math.exp(-k * (x - mid)));

/** Response 0..1 at a dose given as a multiple of the NOAEL (1 = the NOAEL). */
export function response(model: DoseModel, dose: number): number {
  const x = Math.log10(Math.max(dose, 1e-9));
  if (model === "threshold") return dose <= 1 ? 0 : logistic(x, 1.4, 3.2);
  if (model === "linear") return Math.min(1, dose / 100);
  const lowBump = 0.45 * Math.exp(-((x + 1) ** 2) / 0.3);
  return Math.min(1, lowBump + 0.9 * logistic(x, 1.5, 3.2));
}

export interface CurvePoint {
  x: number; // log10 dose
  dose: number;
  response: number;
}

export function curve(model: DoseModel, from = -3, to = 2, steps = 50): CurvePoint[] {
  return Array.from({ length: steps }, (_, i) => {
    const x = from + ((to - from) * i) / (steps - 1);
    const dose = 10 ** x;
    return { x, dose, response: response(model, dose) };
  });
}

/** Margin of exposure: how many times smaller your exposure is than the study's no-effect dose. */
export function marginOfExposure(noael: number, exposure: number): number {
  return exposure > 0 ? noael / exposure : Infinity;
}
