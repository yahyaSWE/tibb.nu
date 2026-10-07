import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ELEMENT_PROFILES,
  TEST_DISCLAIMER,
  getCombinationDescription,
} from "../src/lib/five-phases/profiles";
import { ELEMENTS } from "../src/lib/five-phases/types";

test("each declared phase has the specified Swedish label and Chinese character", () => {
  assert.deepEqual(Object.keys(ELEMENT_PROFILES), [...ELEMENTS]);
  assert.deepEqual(
    ELEMENTS.map((element) => [
      ELEMENT_PROFILES[element].label,
      ELEMENT_PROFILES[element].character,
    ]),
    [
      ["Trä", "木"],
      ["Eld", "火"],
      ["Jord", "土"],
      ["Metall", "金"],
      ["Vatten", "水"],
    ],
  );
});

test("every result profile has complete reflection sections and the supplied association counts", () => {
  const associationCounts = [6, 7, 6, 6, 7];
  for (const [index, element] of ELEMENTS.entries()) {
    const profile = ELEMENT_PROFILES[element];
    for (const section of [
      "theme",
      "description",
      "summary",
      "balanced",
      "stress",
    ] as const) {
      assert.ok(profile[section].trim(), `${element}: missing ${section}`);
    }
    assert.ok(
      profile.summary.startsWith(`${profile.label}konstitutionen präglas av`),
      `${element}: summary belongs to another phase`,
    );
    assert.equal(profile.strengths.length, 6);
    assert.equal(profile.traditional.length, associationCounts[index]);
    assert.ok(profile.support.length > 0);
    for (const section of ["strengths", "support", "traditional"] as const) {
      assert.ok(
        profile[section].every((item) => item.trim()),
        `${element}: empty ${section} item`,
      );
      assert.equal(
        new Set(profile[section]).size,
        profile[section].length,
        `${element}: repeated ${section} item`,
      );
    }
  }
});

test("all ten distinct phase pairs have their own descriptions in either argument order", () => {
  const descriptions = new Set<string>();
  let pairCount = 0;
  for (let first = 0; first < ELEMENTS.length; first++) {
    for (let second = first + 1; second < ELEMENTS.length; second++) {
      const primary = ELEMENTS[first];
      const secondary = ELEMENTS[second];
      const description = getCombinationDescription(primary, secondary);
      assert.equal(
        description,
        getCombinationDescription(secondary, primary),
        `${primary}+${secondary}: description depends on argument order`,
      );
      assert.ok(
        description.includes(ELEMENT_PROFILES[primary].label),
        `${primary}+${secondary}: missing primary phase`,
      );
      assert.ok(
        description.includes(ELEMENT_PROFILES[secondary].label),
        `${primary}+${secondary}: missing secondary phase`,
      );
      descriptions.add(description);
      pairCount++;
    }
  }
  assert.equal(pairCount, 10);
  assert.equal(descriptions.size, 10);
});

test("the shared disclaimer preserves the required educational and non-diagnostic wording", () => {
  assert.equal(
    TEST_DISCLAIMER,
    "Testet är avsett för utbildning och självreflektion och bygger på traditionella teorier inom kinesisk medicin. Det är inte ett medicinskt diagnostiskt verktyg och ersätter inte individuell bedömning av legitimerad vårdpersonal eller kvalificerad behandlare.",
  );
});
