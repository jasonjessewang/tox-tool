import * as db from "../storage/db";
import { computeLiteracy, type Literacy } from "./literacy";
import { curriculumRef } from "../data/curriculum";
import { LESSONS } from "../data/curriculum";

export async function getLiteracy(): Promise<Literacy> {
  const refs = new Set(await db.getLearningRefs("curriculum:"));
  return computeLiteracy(new Set(LESSONS.filter((l) => refs.has(curriculumRef(l.id))).map((l) => l.id)));
}
