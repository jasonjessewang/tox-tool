/// <reference types="node" />
/**
 * "Every activity factors into the picture" is a checked property, not a promise: a new kind of activity, a new
 * storage table or a new signal cannot slip in without saying how it counts -- or why it deliberately does not.
 */
import * as fs from "fs";
import * as path from "path";
import { KEYS } from "../../storage/db";
import { ACTIVITY_ROLE, SERVICE_STORAGE, SIGNALS, STORAGE_ACTIVITY, signalsFedBy } from "./registry";
import type { ActivityKind } from "./types";

const kinds = Object.keys(ACTIVITY_ROLE) as ActivityKind[];

test("every table the app stores activity in is classified", () => {
  expect(Object.keys(STORAGE_ACTIVITY).sort()).toEqual(Object.keys(KEYS).sort());
  for (const kind of Object.values(STORAGE_ACTIVITY)) expect(kinds).toContain(kind);
});

test("every kind of activity either feeds a signal or says why it does not", () => {
  for (const kind of kinds) {
    const role = ACTIVITY_ROLE[kind];
    if ("feeds" in role) {
      expect(role.feeds.length).toBeGreaterThan(0);
      for (const key of role.feeds) expect(SIGNALS.map((s) => s.key)).toContain(key);
    } else {
      expect(role.unscored.length).toBeGreaterThan(30);
    }
  }
});

test("signals and activities agree in both directions", () => {
  for (const s of SIGNALS) {
    expect(s.sources.length).toBeGreaterThan(0);
    for (const kind of s.sources) expect(signalsFedBy(kind)).toContain(s.key);
  }
  for (const kind of kinds) for (const key of signalsFedBy(kind)) expect(SIGNALS.find((s) => s.key === key)!.sources).toContain(kind);
});

test("signal keys are unique and every signal has default weight, label and blurb", () => {
  expect(new Set(SIGNALS.map((s) => s.key)).size).toBe(SIGNALS.length);
  for (const s of SIGNALS) {
    expect(s.defaultWeight).toBeGreaterThan(0);
    expect(s.label.length).toBeGreaterThan(3);
    expect(s.blurb.length).toBeGreaterThan(20);
  }
});

test("no storage key is used anywhere in the app without being registered", () => {
  const registered = new Set<string>([...Object.values(KEYS), ...Object.keys(SERVICE_STORAGE)]);
  const root = path.join(__dirname, "../..");
  const found = new Map<string, string>();
  const walk = (dir: string) => {
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      if (fs.statSync(full).isDirectory()) {
        if (name === "sim") continue;
        walk(full);
      } else if (/\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name)) {
        for (const m of fs.readFileSync(full, "utf8").matchAll(/["'`](exposure:[a-z_]+)["'`]/g)) found.set(m[1], path.relative(root, full));
      }
    }
  };
  walk(root);
  expect(found.size).toBeGreaterThanOrEqual(Object.keys(KEYS).length);
  for (const [key, file] of found) expect({ key, file, registered: registered.has(key) }).toEqual({ key, file, registered: true });
});
