/**
 * Build Loaded (PSA) cell explain copy: full load vs why PSA holds less than the publisher SoT.
 */
import { ensureSentence } from './explainProse.js';

function noteText(row) {
  const d = row?.loadedDepth || {};
  return String(d.sourceScale?.note || d.sourceRecordNote || '').trim();
}

function publisherRecordTotal(row) {
  const d = row?.loadedDepth || {};
  const n = d.sourceScale?.recordCount ?? d.sourceRecordCount;
  if (n == null || !Number.isFinite(Number(n))) return null;
  return Number(n);
}

function publisherDocumentBatch(row) {
  const batches = row?.loadedDepth?.sourceScale?.batches || [];
  const preferred = batches.find((b) => {
    const kind = String(b.kind || '').toLowerCase();
    return kind === 'pdf' || kind === 'document' || kind === 'documents';
  });
  if (!preferred || !(Number(preferred.count) > 0)) return null;
  return preferred;
}

/** Prefer DecisionPro-bind / curated sentences from the inventory note. */
export function reasonPsaHoldsLess(row, { sourceCount, loaded, sourceUnit, docBatch } = {}) {
  const note = noteText(row);
  if (note) {
    const sentences = note.split(/(?<=\.)\s+/).map((s) => s.trim()).filter(Boolean);
    const bindish = sentences.find((s) =>
      /DecisionPro binds|curated|aggregate bind|not a rollup|KY (program|annual|bind|slice)|slice of|selected|summary PDF|meta from/i.test(
        s,
      ),
    );
    if (bindish) return ensureSentence(bindish);
    if (/curated|aggregate|binds|KY /i.test(note)) return ensureSentence(note);
  }

  const unit = sourceUnit || row?.loadedDepth?.sourceScale?.recordUnit || row?.loadedDepth?.sourceRecordUnit || 'records';
  if (sourceCount != null && loaded != null && loaded < sourceCount) {
    return (
      `The publisher Source of Truth has about ${Number(sourceCount).toLocaleString()} ${unit}, ` +
      `but DecisionPro currently stages ${Number(loaded).toLocaleString()} record${loaded === 1 ? '' : 's'} in the PSA. ` +
      `That smaller PSA count is a curated Kentucky or measure bind, not a full copy of every publisher row.`
    );
  }

  if (docBatch && loaded != null && loaded < Number(docBatch.count)) {
    const label = docBatch.label || `${docBatch.kind}s`;
    return (
      `The publisher inventory lists ${Number(docBatch.count).toLocaleString()} ${label}, ` +
      `while the PSA currently holds ${Number(loaded).toLocaleString()} landed record${loaded === 1 ? '' : 's'} ` +
      `from the documents DecisionPro has bound so far.`
    );
  }

  return (
    'DecisionPro stages a curated bind for Kentucky legislative use rather than landing the entire publisher corpus in the PSA.'
  );
}

/**
 * @returns {{ title: string, verdict: string, comparison: string, reason: string|null, status: 'all'|'partial'|'none'|'gap' }}
 */
export function buildPsaLoadExplain(row) {
  if (!row) return null;
  const d = row.loadedDepth || {};
  const loaded = Number(d.loadedRowCount ?? d.rowCount ?? 0) || 0;
  const sourceCount = publisherRecordTotal(row);
  const sourceUnit = d.sourceScale?.recordUnit || d.sourceRecordUnit || 'records';
  const docBatch = publisherDocumentBatch(row);
  const note = noteText(row);
  const sourceLabel =
    d.sourceScale?.label ||
    (sourceCount != null ? `${sourceCount.toLocaleString()} ${sourceUnit}` : 'not yet inventoried');

  const title = `${row.fromSysId} — PSA load`;

  if (row.disposition === 'GAP' || row.kind === 'gap') {
    return {
      title,
      status: 'gap',
      verdict: 'Nothing is loaded into the PSA because this row is an Explicit Gap.',
      comparison:
        'There is no continuous public Source of Truth to retrieve for this gap, so the Loaded (PSA) count is zero.',
      reason: null,
    };
  }

  if (loaded <= 0) {
    const why =
      row.disposition === 'BLOCKED'
        ? 'This source is blocked on the public proof-of-concept path by license or data-use agreement limits, so DecisionPro has not landed records in the PSA yet.'
        : row.disposition === 'CATALOGUED'
          ? 'This source is catalogued but not yet bound, so the PSA has no landed records for this FromSysID.'
          : 'Nothing is currently landed in the PSA for this source.';
    return {
      title,
      status: 'none',
      verdict: 'Nothing is loaded into the PSA yet.',
      comparison:
        sourceCount != null
          ? `The publisher Source of Truth is about ${sourceCount.toLocaleString()} ${sourceUnit}, and the PSA currently holds 0 records.`
          : `The publisher Source scale is recorded as ${sourceLabel}, and the PSA currently holds 0 records.`,
      reason: why,
    };
  }

  if (sourceCount != null) {
    if (loaded >= sourceCount) {
      return {
        title,
        status: 'all',
        verdict: 'All data was loaded.',
        comparison:
          `The publisher Source of Truth has about ${sourceCount.toLocaleString()} ${sourceUnit}, ` +
          `and DecisionPro has staged ${loaded.toLocaleString()} matching records in the PSA.`,
        reason: null,
      };
    }
    return {
      title,
      status: 'partial',
      verdict: 'The PSA shows less data than the publisher Source of Truth.',
      comparison:
        `The publisher Source of Truth has about ${sourceCount.toLocaleString()} ${sourceUnit}, ` +
        `while the PSA currently holds ${loaded.toLocaleString()} records.`,
      reason: reasonPsaHoldsLess(row, { sourceCount, loaded, sourceUnit, docBatch }),
    };
  }

  if (docBatch) {
    const docs = Number(docBatch.count) || 0;
    const docLabel = docBatch.label || docBatch.kind;
    if (loaded >= docs) {
      return {
        title,
        status: 'all',
        verdict: 'All data was loaded.',
        comparison:
          `The publisher inventory lists ${docs.toLocaleString()} ${docLabel}, ` +
          `and the PSA currently holds ${loaded.toLocaleString()} landed records for that inventory.`,
        reason: null,
      };
    }
    return {
      title,
      status: 'partial',
      verdict: 'The PSA shows less data than the publisher Source of Truth.',
      comparison:
        `The publisher inventory lists ${docs.toLocaleString()} ${docLabel}, ` +
        `while the PSA currently holds ${loaded.toLocaleString()} landed records.`,
      reason: reasonPsaHoldsLess(row, { sourceCount: null, loaded, sourceUnit, docBatch }),
    };
  }

  if (/DecisionPro binds|curated|aggregate bind|not a rollup|selected /i.test(note)) {
    return {
      title,
      status: 'partial',
      verdict: 'The PSA shows less data than the publisher Source of Truth.',
      comparison:
        `The publisher Source scale is recorded as ${sourceLabel}, ` +
        `and the PSA currently holds ${loaded.toLocaleString()} records.`,
      reason: reasonPsaHoldsLess(row, { sourceCount: null, loaded, sourceUnit, docBatch }),
    };
  }

  return {
    title,
    status: 'all',
    verdict: 'All data was loaded.',
    comparison:
      `The publisher Source scale is recorded as ${sourceLabel}, ` +
      `and the PSA currently holds ${loaded.toLocaleString()} records. ` +
      `No larger comparable publisher record total is inventoried for this source.`,
    reason: null,
  };
}
