import { test } from "node:test";
import assert from "node:assert/strict";
import { createQualityController, opaqueAt } from "../dist/stage-quality.js";

test("sustained slow frames lower resolution; a single stall does not", () => {
  const q = createQualityController(2);
  const initial = q.dpr;
  q.sample(80);
  assert.equal(q.dpr, initial);
  for (let i = 0; i < 180; i++) q.sample(25);
  assert.ok(q.dpr < initial);
  assert.ok(q.dpr >= 0.75);
});
test("stable high refresh slowly recovers quality without exceeding the device cap", () => {
  const q = createQualityController(1.5);
  for (let i = 0; i < 600; i++) q.sample(30);
  const low = q.dpr;
  for (let i = 0; i < 2000; i++) q.sample(4.2);
  assert.ok(q.dpr > low);
  assert.ok(q.dpr <= 1.5);
});
test("transparent portrait pixels cannot trigger character hover", () => {
  const mask = {
    width: 2,
    height: 2,
    data: new Uint8ClampedArray([0, 255, 0, 255]),
  };
  assert.equal(opaqueAt(mask, { x: 0, y: 1 }), false);
  assert.equal(opaqueAt(mask, { x: 0.9, y: 0.9 }), true);
  assert.equal(opaqueAt(mask, { x: -0.1, y: 0.5 }), false);
  assert.equal(opaqueAt(mask, { x: 1, y: 0 }), true);
});

test("sustained software rendering stalls also reduce quality", () => {
 const q=createQualityController(1);
 for(let i=0;i<120;i++)q.sample(150);
 assert.equal(q.dpr,.75);
});

test("very slow devices settle on a still scene after reducing resolution", () => {
 const q=createQualityController(1);
 for(let i=0;i<180;i++)q.sample(100);
 assert.equal(q.lowPower,true);
});
