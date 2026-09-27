import { useEffect, useState } from "react";
import * as db from "../storage/db";
import type { ContentComplexity } from "../engine/types";

/**
 * How much detail the person asked for at the start ("Simple", "Balanced" or "Technical"), read from their profile.
 * Simple keeps to the summary and what to do; Balanced shows the summary with the reasoning one tap away; Technical opens the
 * mechanism and the citations. Screens use it to decide what is hidden and what starts open -- the promise made on the first screen.
 */
export function useContentComplexity(): ContentComplexity {
  const [level, setLevel] = useState<ContentComplexity>("balanced");
  useEffect(() => {
    let alive = true;
    db.getUserProfile()
      .then((p) => alive && setLevel(p?.contentComplexity ?? "balanced"))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  return level;
}
