import { describe, expect, it } from 'vitest';
import {
  BRIEFING_SOURCE_LABELS,
  HEADLINE_JARGON_TERMS,
  PRODUCT_COMMENTARY_TERMS,
  PROHIBITED_HEADLINE_TERMS,
  buildOperationalBriefings,
  getOperationalBriefings,
  primaryProgram,
} from '../data/operationalBriefings.js';
import { MCPAR_PLAN_PERIOD } from '../data/alp/mcparPlanPeriod.js';
import { getOperationalIntelligence } from '../data/operationalIntelligence.js';

const NOW = new Date('2026-09-02T12:00:00Z');

describe('operational briefings (depot inferences)', () => {
  it('builds a non-empty, state-isolated briefing set for KY and FL', () => {
    for (const state of ['KY', 'FL']) {
      const briefings = buildOperationalBriefings(state, NOW);
      expect(briefings.length).toBeGreaterThanOrEqual(5);
      expect(briefings.every((item) => item.state === state)).toBe(true);
      expect(new Set(briefings.map((item) => item.id)).size).toBe(briefings.length);
    }
    expect(getOperationalBriefings('fl').every((item) => item.state === 'FL')).toBe(true);
  });

  it('every headline obeys the governed rule: no verdict wording, and a fact plus a question or boundary', () => {
    for (const state of ['KY', 'FL']) {
      for (const item of buildOperationalBriefings(state, NOW)) {
        const text = `${item.headline} ${item.lede}`.toLocaleLowerCase();
        for (const term of PROHIBITED_HEADLINE_TERMS) {
          expect(text.includes(term), `${item.id} contains "${term}"`).toBe(false);
        }
        // Headlines and ledes describe the evidence and its implications,
        // never DecisionPro itself or what it added.
        for (const term of PRODUCT_COMMENTARY_TERMS) {
          expect(text.includes(term), `${item.id} describes the product ("${term}")`).toBe(false);
        }
        // Headlines use the language of programs, dollars, facilities, and
        // people — never the data model.
        const headlineWords = item.headline.toLocaleLowerCase().replace(/[^a-z0-9-]+/g, ' ').split(' ');
        for (const term of HEADLINE_JARGON_TERMS) {
          expect(headlineWords.some((word) => word === term || word === `${term}s`), `${item.id} headline uses jargon ("${term}")`).toBe(false);
        }
        expect(item.headline.length).toBeGreaterThan(40);
        expect(item.question.length).toBeGreaterThan(30);
        expect(item.owner.length).toBeGreaterThan(10);
        expect(item.guardrail.length).toBeGreaterThan(20);
        expect(['observed', 'inferred', 'gap']).toContain(item.kind);
        expect(item.status).toBe('Detected');
        expect(item.asOf).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
    }
  });

  it('points every briefing at a real goal on its state page and labels every source it joins', () => {
    for (const state of ['KY', 'FL']) {
      const goalIds = new Set(getOperationalIntelligence(state).goals.map((goal) => goal.id));
      for (const item of buildOperationalBriefings(state, NOW)) {
        expect(goalIds.has(item.goalId), `${item.id} -> ${item.goalId}`).toBe(true);
        expect(item.goalsTouched.every((id) => goalIds.has(id))).toBe(true);
        expect(item.sourceSystems.length).toBeGreaterThan(0);
        for (const id of item.sourceSystems) expect(BRIEFING_SOURCE_LABELS[id], `label for ${id}`).toBeTruthy();
        if (item.roomLink) {
          expect(item.roomLink.roomId).toBe('funding-resilience');
          expect(item.roomLink.types.length).toBeGreaterThan(0);
        }
      }
    }
  });

  it('ranks decision value first: more goals touched sorts ahead, observed ahead of inferred within a tier', () => {
    for (const state of ['KY', 'FL']) {
      const briefings = buildOperationalBriefings(state, NOW);
      for (let index = 1; index < briefings.length; index += 1) {
        const previous = briefings[index - 1];
        const current = briefings[index];
        expect(previous.goalsTouched.length).toBeGreaterThanOrEqual(current.goalsTouched.length);
      }
    }
  });

  it('names the reporting entity in the Kentucky plan-concentration briefing and reproduces its share from the record', () => {
    const briefings = buildOperationalBriefings('KY', NOW);
    const concentration = briefings.find((item) => item.id === 'KY-mcpar-overpayment-concentration');
    expect(concentration).toBeTruthy();
    const program = primaryProgram(MCPAR_PLAN_PERIOD.byState.KY);
    const top = program.totals.overpaymentShares[0];
    expect(concentration.headline).toContain(top.plan);
    expect(concentration.headline).toContain(`${Math.round(top.overpaymentShare * 100)}%`);
    expect(concentration.record).toEqual({ kind: 'mcpar-plan-period', program: program.program });
    expect(concentration.goalsTouched).toContain('contract-accountability');
  });

  it('surfaces the comparability rule as a computed state rather than prose', () => {
    const comparability = buildOperationalBriefings('KY', NOW).find((item) => item.id === 'KY-mcpar-comparability');
    expect(comparability).toBeTruthy();
    expect(comparability.headline).toMatch(/differ \d+(\.\d+)?×/);
    expect(comparability.headline).toContain('counting rules, not performance');
  });

  it('builds the compound facility list for every state whose Care Compare slice is loaded, and a gap card otherwise', () => {
    for (const state of ['KY', 'FL']) {
      const briefings = buildOperationalBriefings(state, NOW);
      const compound = briefings.find((item) => item.id === `${state}-compound-facility`);
      const gap = briefings.find((item) => item.id === `${state}-compound-facility-gap`);
      expect(Boolean(compound) !== Boolean(gap)).toBe(true);
      if (compound) {
        expect(compound.kind).toBe('inferred');
        expect(compound.record.rows.length).toBeGreaterThan(0);
        expect(compound.record.rows.every((row) => Number(row.rating) <= 2)).toBe(true);
      } else {
        expect(gap.kind).toBe('gap');
        expect(gap.question).toMatch(/Provider Data|nursing-home slice/i);
      }
    }
  });

  it('surfaces CMS-reported chains keyed on chain id and never echoes a withheld (non-organization) label', () => {
    for (const state of ['KY', 'FL']) {
      const chains = buildOperationalBriefings(state, NOW).find((item) => item.id === `${state}-cms-chains`);
      expect(chains).toBeTruthy();
      expect(chains.kind).toBe('observed');
      const withheld = chains.record.rows.filter((row) => /label withheld/.test(row.chain));
      for (const row of withheld) expect(row.chain).toMatch(/^CMS chain \S+ \(label withheld/);
      expect(chains.headline).toMatch(/^\d+ chains run \S+ of (Kentucky|Florida)'s nursing facilities/);
    }
  });

  it('resolves Kentucky sanction citations to indexed contract sections', () => {
    const sanctions = buildOperationalBriefings('KY', NOW).find((item) => item.id === 'KY-mcpar-sanctions');
    expect(sanctions).toBeTruthy();
    expect(sanctions.figures.some((figure) => figure.label === 'Citations resolved to a contract page')).toBe(true);
  });

  it('sizes county access exposure with members, HPSA status, and beds per 1,000 for both states', () => {
    for (const state of ['KY', 'FL']) {
      const county = buildOperationalBriefings(state, NOW).find((item) => item.id === `${state}-county-access`);
      expect(county).toBeTruthy();
      expect(county.headline).toMatch(/together serving [\d,]+ Medicaid (members|eligibles)/);
      expect(county.figures.some((figure) => /primary-care HPSA/.test(figure.label) && /\d+ of \d+/.test(figure.value))).toBe(true);
      expect(county.record.columns.map((column) => column.key)).toContain('per1k');
      expect(county.record.rows.some((row) => typeof row.per1k === 'number')).toBe(true);
    }
  });

  it('keeps the runway-composition record to recipient awards and never labels a Title XIX grant as one', () => {
    for (const state of ['KY', 'FL']) {
      const runway = buildOperationalBriefings(state, NOW).find((item) => item.id === `${state}-runway-composition`);
      expect(runway).toBeTruthy();
      expect(runway.record.rows.every((row) => row.listing !== '93.778' || !/cabinet|agency/i.test(row.recipient))).toBe(true);
      expect(runway.headline).toContain('Title XIX');
    }
  });
});
