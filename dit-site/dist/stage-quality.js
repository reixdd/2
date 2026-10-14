// Resolution changes need sustained evidence; never tie motion speed to the refresh rate.
export function createQualityController(deviceDpr = 1, mobile = false) {
  const cap = Math.min(deviceDpr || 1, mobile ? 1.25 : 1.75);
  let dpr = cap,
    samples = [],
    goodWindows = 0, lowPower = false;
  return {
    get dpr() {
      return dpr;
    },
    get lowPower() { return lowPower; },
    sample(ms) {
      if (!Number.isFinite(ms) || ms <= 0 || ms > 1000) return false;
      samples.push(ms);
      if (samples.length < 60) return false;
      samples.sort((a, b) => a - b);
      const p75 = samples[44];
      samples = [];
      const previous = dpr;
      if (p75 > 19) {
        dpr = Math.max(Math.min(0.75, cap), dpr - 0.125);
        goodWindows = 0;
      } else if (p75 < 11 && ++goodWindows >= 4) {
        dpr = Math.min(cap, dpr + 0.125);
        goodWindows = 0;
      } else if (p75 >= 11) goodWindows = 0;
      if(dpr <= Math.min(.75,cap) && p75 > 50) lowPower = true;
      return previous !== dpr;
    },
    reset() {
      samples = [];
      goodWindows = 0;
    },
  };
}

// UVs are bottom-up; canvas image data is top-down. Reject transparent margins.
export function opaqueAt(mask, uv) {
  if (!uv || uv.x < 0 || uv.x > 1 || uv.y < 0 || uv.y > 1) return false;
  const x = Math.min(mask.width - 1, Math.floor(uv.x * mask.width));
  const y = Math.min(mask.height - 1, Math.floor((1 - uv.y) * mask.height));
  return mask.data[y * mask.width + x] > 90;
}
