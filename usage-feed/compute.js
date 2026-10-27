// SPDX-License-Identifier: MIT
// Copyright (c) 2026 David Winter
// Shared: turn Cursor /teams/spend response into the face-app feed (no PII).
export function compute(api, now = Date.now(), daily = null) {
  const m = (api.teamMemberSpend || [])[0];
  if (!m || !api.subscriptionCycleStart) throw new Error('unexpected API shape');
  const start = new Date(api.subscriptionCycleStart);
  const end = new Date(start); end.setUTCMonth(end.getUTCMonth() + 1);
  const spent = (m.overallSpendCents ?? m.spendCents ?? 0) / 100;
  const limit = m.effectivePerUserLimitDollars ?? m.monthlyLimitDollars ?? m.hardLimitOverrideDollars ?? 0;
  const total = end - start, elapsed = Math.min(Math.max(now - start, 1), total);
  const r2 = x => Math.round(x * 100) / 100;
  return {
    updatedAt: new Date(now).toISOString(),
    cycleStart: start.toISOString(),
    cycleEnd: end.toISOString(),
    spentUsd: r2(spent),
    limitUsd: r2(limit),
    pct: limit > 0 ? r2(Math.min(100, spent / limit * 100)) : 0,
    projectedUsd: r2(spent * total / elapsed),
    daysLeft: r2(Math.max(0, (end - now) / 86400000)),
    ...(daily ? { daily } : {}),
  };
}

// v1.15: per-day spend for this billing cycle from /teams/groups (member dailySpend). Dates only + dollars, no PII.
export function dailyFrom(groupsApi, term) {
  const t = String(term || '').toLowerCase(); if (!t) return null;
  const all = [...(groupsApi.groups || []), groupsApi.unassignedGroup].filter(Boolean);
  for (const g of all) {
    const me = (g.currentMembers || []).find(x => String(x.email || '').toLowerCase().includes(t) || String(x.name || '').toLowerCase().includes(t));
    if (me && Array.isArray(me.dailySpend)) {
      return me.dailySpend.filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d.date) && Number.isFinite(d.spendCents))
        .map(d => ({ d: d.date, usd: Math.round(d.spendCents) / 100 })).sort((a, b) => a.d < b.d ? -1 : 1);
    }
  }
  return null;
}
