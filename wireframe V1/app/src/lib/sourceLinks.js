import { AUTHORITATIVE_SOURCES } from '../data/alp/authoritativeSources.js';

const FILE_EXT = /\.(csv|pdf|xlsx?|zip|json|tsv|txt|xml)(\?|#|$)/i;

/** True when URI looks like a direct downloadable file rather than a browseable page. */
export function isDownloadableSourceUri(uri) {
  if (!uri || typeof uri !== 'string') return false;
  if (uri.startsWith('fixture:')) return false;
  try {
    const u = new URL(uri);
    if (FILE_EXT.test(u.pathname)) return true;
    if (/download\./i.test(u.hostname)) return true;
    return false;
  } catch {
    return FILE_EXT.test(uri);
  }
}

/** Containing catalogue / publisher page for a FromSysID. */
export function containingPageForFromSysId(fromSysId) {
  const row = (AUTHORITATIVE_SOURCES.sources || []).find((s) => s.fromSysId === fromSysId);
  return row?.href || '';
}

/**
 * Resolve source file URI and containing page for provenance display.
 * Prefer provenance.sourcePageUri; fall back to authoritative catalogue.
 */
function normalizeUri(uri) {
  return (uri || '').replace(/\/$/, '');
}

export function resolveSourceLinks(measure) {
  const p = measure?.provenance || {};
  const sourceUri = p.sourceUri || '';
  const fromSysId = measure?.fromSysId || p.fromSysId || '';
  const cataloguePage = containingPageForFromSysId(fromSysId);
  let sourcePageUri = p.sourcePageUri || cataloguePage || '';

  const downloadable = isDownloadableSourceUri(sourceUri);
  // If provenance copied the file URI into sourcePageUri, prefer the catalogue page.
  if (
    downloadable &&
    cataloguePage &&
    (!sourcePageUri || normalizeUri(sourcePageUri) === normalizeUri(sourceUri))
  ) {
    sourcePageUri = cataloguePage;
  }
  if (!sourcePageUri && !downloadable) {
    sourcePageUri = sourceUri;
  }

  const pageDistinct =
    sourcePageUri && sourceUri && normalizeUri(sourcePageUri) !== normalizeUri(sourceUri);

  return {
    sourceUri,
    sourcePageUri,
    showFileAndPage: Boolean(downloadable && pageDistinct),
    showPageOnly: Boolean(!downloadable && sourceUri),
  };
}
