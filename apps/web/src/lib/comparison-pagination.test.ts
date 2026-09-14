import assert from "node:assert/strict";
import test from "node:test";
import { comparisonPage } from "./comparison-pagination";

test("comparison pages bound rendered rows and expose every matching combination", () => {
  const rows = Array.from({length:29}, (_, i)=>i);
  assert.equal(comparisonPage(rows, "1").rows.length,12);
  assert.deepEqual([1,2,3].flatMap(page=>comparisonPage(rows,String(page)).rows),rows);
  assert.equal(comparisonPage(rows,"999").page,3);
  for (const invalid of ["", "-1", "oops", "1.5"]) assert.equal(comparisonPage(rows,invalid).page,1);
  assert.deepEqual(comparisonPage([],"999").rows,[]);
  assert.equal(comparisonPage([],"999").page,1);
});
