function effectivenessCalc({Tin_h, Tin_c, m_c, cp_c, m_h, cp_h, U, A, effPct=85}) {
  const C_h = m_h * cp_h / 3600;
  const C_c = m_c * cp_c / 3600;
  const C_min = Math.min(C_h, C_c);
  const C_max = Math.max(C_h, C_c);
  const C_ratio = C_max > 0 ? C_min / C_max : 1;
  const NTU = U * A / Math.max(C_min, 1e-9);
  let eps_max;
  if (Math.abs(1 - C_ratio) < 1e-6) {
    eps_max = NTU / (1 + NTU);
  } else {
    eps_max = (1 - Math.exp(-NTU * (1 - C_ratio))) / (1 - C_ratio * Math.exp(-NTU * (1 - C_ratio)));
  }
  const epsilon = Math.min(eps_max, effPct / 100);
  const Q_max = C_min * (Tin_h - Tin_c);
  const Q = epsilon * Q_max;
  return {
    Q,
    Tout_h: Tin_h - Q / C_h,
    Tout_c: Tin_c + Q / C_c,
    epsilon,
    NTU,
    C_h,
    C_c,
  };
}

function approxEqual(a, b, tolPct = 2) {
  if (b === 0) return Math.abs(a) < 1e-9;
  return Math.abs((a - b) / b) * 100 <= tolPct;
}

const tests = [
  {
    name: 'Test 1: balanced water-water, known by effectiveness equation',
    input: { Tin_h: 80, Tin_c: 20, m_h: 10000, cp_h: 4.18, m_c: 10000, cp_c: 4.18, U: 800, A: 50, effPct: 85 },
    expected: { Tout_h: 29.0, Tout_c: 71.0, Q_kW: 592.0 }
  },
  {
    name: 'Test 2: hot side much smaller capacity rate',
    input: { Tin_h: 120, Tin_c: 30, m_h: 5000, cp_h: 2.5, m_c: 20000, cp_c: 4.18, U: 600, A: 40, effPct: 80 },
    expectedFromModel: true
  },
  {
    name: 'Test 3: no heat transfer when Tin_h == Tin_c',
    input: { Tin_h: 50, Tin_c: 50, m_h: 10000, cp_h: 3.0, m_c: 10000, cp_c: 4.18, U: 800, A: 50, effPct: 85 },
    expected: { Tout_h: 50, Tout_c: 50, Q_kW: 0 }
  },
  {
    name: 'Test 4: batch cooling time sanity check',
    batch: true,
    input: { Tin_h: 120, Tin_c: 30, m_h: 12000, cp_h: 2.35, m_c: 20000, cp_c: 4.18, U: 800, A: 50, effPct: 85, m_total: 15000, target: 55 },
    expectedFormula: true
  }
];

for (const t of tests) {
  if (!t.batch) {
    const r = effectivenessCalc(t.input);
    const out = {
      Tout_h: Number(r.Tout_h.toFixed(2)),
      Tout_c: Number(r.Tout_c.toFixed(2)),
      Q_kW: Number(r.Q.toFixed(2)),
      epsilon: Number((r.epsilon * 100).toFixed(2)),
    };
    let pass = true;
    let note = '';
    if (t.expected) {
      pass = approxEqual(out.Tout_h, t.expected.Tout_h, 3) && approxEqual(out.Tout_c, t.expected.Tout_c, 3) && approxEqual(out.Q_kW, t.expected.Q_kW, 3);
      note = `expected=${JSON.stringify(t.expected)} actual=${JSON.stringify(out)}`;
    } else {
      note = `model result=${JSON.stringify(out)}`;
    }
    console.log(JSON.stringify({ test: t.name, pass, ...out, note }));
  } else {
    const r = effectivenessCalc(t.input);
    const dTperPass = t.input.Tin_h - r.Tout_h;
    const coolingRateKperMin = (t.input.m_h / t.input.m_total) * dTperPass / 60;
    const batchMinutes = (t.input.Tin_h - t.input.target) / coolingRateKperMin;
    console.log(JSON.stringify({
      test: t.name,
      pass: batchMinutes > 0,
      Tout_h: Number(r.Tout_h.toFixed(2)),
      Tout_c: Number(r.Tout_c.toFixed(2)),
      Q_kW: Number(r.Q.toFixed(2)),
      batchMinutes: Number(batchMinutes.toFixed(2)),
      note: 'sanity check on batch time formula'
    }));
  }
}
