import fs from 'node:fs/promises';
import path from 'node:path';
import type pg from 'pg';
import { config, REPO_ROOT } from '../config.js';
import { CompleteLoadHistory, InsertLoadHistory, newId } from '../atoms/LoadHistoryAtoms.js';
import { Sha256 } from '../adapters/operationalPublicSources.js';

/**
 * Business Action: IndexContractSections
 *
 * Builds a section index over the retained Kentucky MCO contract PDFs
 * (KY_DMS_MCO_CONTRACTS in PSA): for every numbered section heading found in
 * the contract body (e.g. "37.13 Liquidated Damages") and every appendix
 * heading, the plan, PDF page, section title, and a hash of the section text.
 * MCPAR sanction citations ("26.13", "Appendix A: 79") then join to a
 * section title and page deterministically. Applicability of a clause stays
 * the reviewer's determination; this action only removes the page search.
 *
 * Text extraction uses pdfjs-dist (already a warehouse dependency); nothing
 * is fetched from the network. Section text is hashed and a short excerpt
 * retained; the full text stays in the PSA file.
 */

type PlanDocument = { plan: string; filePattern: RegExp; mcparPlanName: string };

// MCPAR reporting-entity names → the DMS contract document file. Anthem
// exited the program and has no retained contract document (explicit gap).
const PLAN_DOCUMENTS: PlanDocument[] = [
  { plan: 'Aetna', filePattern: /contract-\d+-Aetna\.pdf$/i, mcparPlanName: 'Aetna Better Health' },
  { plan: 'Humana', filePattern: /contract-\d+-Humana\.pdf$/i, mcparPlanName: 'Humana Healthy Horizons' },
  { plan: 'Molina', filePattern: /contract-\d+-Molina\.pdf$/i, mcparPlanName: 'Passport by Molina' },
  { plan: 'UnitedHealthcare', filePattern: /contract-\d+-UnitedHealthcare\.pdf$/i, mcparPlanName: 'United Healthcare Community Plan' },
  { plan: 'WellCare', filePattern: /contract-\d+-WellCare\.pdf$/i, mcparPlanName: 'WellCare of KY' },
];

export const CONTRACT_PLAN_MAP = PLAN_DOCUMENTS.map((d) => ({ plan: d.plan, mcparPlanName: d.mcparPlanName }));

const HEADING = /^\s*(\d{1,2}\.\d{1,2})\s+([A-Z][A-Za-z0-9 ,&/'()\-]{2,90}?)\s*$/;
// Body appendix headings are set in capitals; a mixed-case "Appendix I, ..." is
// an in-text reference, not a heading.
const APPENDIX = /^\s*(APPENDIX)\s+([A-Z])\b[\s:.\-–—]*(.{0,90})$/;
const cleanTitle = (title: string) => title.replace(/\s*Docusign Envelope ID:.*$/i, '').replace(/\s+/g, ' ').trim();
const TOC_LINE = /\.{4,}\s*\d{1,3}\s*$/;

type PageText = { page: number; lines: string[] };

async function extractPages(bytes: Buffer): Promise<PageText[]> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(bytes), useSystemFonts: true, disableFontFace: true, verbosity: 0 });
  const doc = await loadingTask.promise;
  const pages: PageText[] = [];
  for (let index = 1; index <= doc.numPages; index += 1) {
    const page = await doc.getPage(index);
    const content = await page.getTextContent();
    const lines: string[] = [];
    let current = '';
    for (const item of content.items as Array<{ str?: string; hasEOL?: boolean }>) {
      if (item.str) current += item.str;
      if (item.hasEOL) { lines.push(current.replace(/\s+/g, ' ').trim()); current = ''; } else if (item.str && !item.str.endsWith(' ')) current += ' ';
    }
    if (current.trim()) lines.push(current.replace(/\s+/g, ' ').trim());
    pages.push({ page: index, lines });
    page.cleanup();
  }
  await loadingTask.destroy();
  return pages;
}

async function latestContractFile(pattern: RegExp) {
  const root = path.join(config.psaRoot, 'psa', 'KY_DMS_MCO_CONTRACTS', 'REAL');
  const stamps = (await fs.readdir(root)).sort().reverse();
  for (const stamp of stamps) {
    const files = await fs.readdir(path.join(root, stamp));
    const hit = files.find((file) => pattern.test(file));
    if (hit) return path.join(root, stamp, hit);
  }
  return null;
}

export type ContractSection = {
  sectionId: string; plan: string; mcparPlanName: string; documentFile: string; documentHash: string;
  sectionNumber: string; sectionTitle: string; pdfPage: number; pageCount: number; textHash: string; excerpt: string;
};

export class IndexContractSections {
  Status: 'INITIAL' | 'SUCCEEDED' | 'FAILED' = 'INITIAL';
  ErrorMessage = '';
  Sections: ContractSection[] = [];
  Documents: Array<{ plan: string; mcparPlanName: string; file: string | null; pages: number; sections: number; documentHash: string | null; gap: string | null }> = [];

  constructor(private client: pg.PoolClient | null = null) {}

  async Run() {
    if (this.Status !== 'INITIAL') return;
    const loadHistoryId = newId('LH-CONTRACT-IDX');
    if (this.client) {
      await InsertLoadHistory(this.client, {
        load_history_id: loadHistoryId, data_request_id: 'DR-REAL-KY-CONTRACT-SECTION-INDEX', started_at: new Date(),
        source_uri: config.mcoContractsPageUri, load_class: 'REAL',
      });
    }
    try {
      for (const doc of PLAN_DOCUMENTS) {
        const file = await latestContractFile(doc.filePattern);
        if (!file) {
          this.Documents.push({ plan: doc.plan, mcparPlanName: doc.mcparPlanName, file: null, pages: 0, sections: 0, documentHash: null, gap: 'No retained contract document in PSA for this plan.' });
          continue;
        }
        const bytes = await fs.readFile(file);
        const documentHash = Sha256(bytes);
        const pages = await extractPages(bytes);
        const sections = this.indexDocument(doc, path.relative(config.psaRoot, file).split(path.sep).join('/'), documentHash, pages);
        this.Sections.push(...sections);
        this.Documents.push({ plan: doc.plan, mcparPlanName: doc.mcparPlanName, file: path.basename(file), pages: pages.length, sections: sections.length, documentHash, gap: null });
      }
      // Anthem: MCPAR reports sanctions for it, but no contract is retained.
      this.Documents.push({ plan: 'Anthem', mcparPlanName: 'Anthem Blue Cross/Blue Shield', file: null, pages: 0, sections: 0, documentHash: null, gap: 'Anthem exited the Kentucky program; no contract document is retained in PSA, so its citations resolve only against the common contract structure of the other plans.' });

      if (this.client) {
        await this.client.query(`DELETE FROM bw_dso.dso_contract_section WHERE load_class='REAL'`);
        for (const s of this.Sections) {
          await this.client.query(
            `INSERT INTO bw_dso.dso_contract_section
             (section_id,state_code,plan_name,document_file,document_hash,section_number,section_title,pdf_page,page_count,text_hash,excerpt,from_sys_id,load_class,load_history_id)
             VALUES ($1,'KY',$2,$3,$4,$5,$6,$7,$8,$9,$10,'KY_DMS_MCO_CONTRACTS','REAL',$11)`,
            [s.sectionId, s.mcparPlanName, s.documentFile, s.documentHash, s.sectionNumber, s.sectionTitle, s.pdfPage, s.pageCount, s.textHash, s.excerpt, loadHistoryId],
          );
        }
        await CompleteLoadHistory(this.client, loadHistoryId, {
          status: 'SUCCEEDED', row_count: this.Sections.length, content_hash: Sha256(this.Documents.map((d) => d.documentHash || '').join('|')),
          as_of_date: new Date().toISOString().slice(0, 10),
          notes: `Contract section index: ${this.Documents.filter((d) => d.file).length} documents, ${this.Sections.length} sections.`,
        });
      }
      this.Status = 'SUCCEEDED';
    } catch (error) {
      this.Status = 'FAILED';
      this.ErrorMessage = error instanceof Error ? error.message : String(error);
      if (this.client) await CompleteLoadHistory(this.client, loadHistoryId, { status: 'FAILED', notes: this.ErrorMessage });
    }
  }

  private indexDocument(doc: PlanDocument, documentFile: string, documentHash: string, pages: PageText[]): ContractSection[] {
    // A table-of-contents page carries many numbered lines with dot leaders
    // and trailing page numbers; body headings stand alone on their line.
    const tocPages = new Set(pages.filter((p) => p.lines.filter((line) => TOC_LINE.test(line)).length >= 6).map((p) => p.page));
    const found = new Map<string, { title: string; page: number; lineIndex: number }>();
    for (const p of pages) {
      if (tocPages.has(p.page)) continue;
      p.lines.forEach((line, lineIndex) => {
        if (TOC_LINE.test(line)) return;
        const heading = line.match(HEADING);
        if (heading) {
          const number = heading[1];
          if (!found.has(number)) found.set(number, { title: cleanTitle(heading[2]), page: p.page, lineIndex });
          return;
        }
        const appendix = line.match(APPENDIX);
        if (appendix) {
          const number = `Appendix ${appendix[2]}`;
          if (!found.has(number)) found.set(number, { title: cleanTitle(appendix[3] || '') || number, page: p.page, lineIndex });
        }
      });
    }
    const ordered = [...found.entries()].sort((a, b) => a[1].page - b[1].page || a[1].lineIndex - b[1].lineIndex);
    return ordered.map(([number, hit], index) => {
      const next = ordered[index + 1]?.[1];
      const textLines: string[] = [];
      for (const p of pages) {
        if (p.page < hit.page) continue;
        if (next && p.page > next.page) break;
        p.lines.forEach((line, lineIndex) => {
          if (p.page === hit.page && lineIndex < hit.lineIndex) return;
          if (next && p.page === next.page && lineIndex >= next.lineIndex) return;
          textLines.push(line);
        });
      }
      const text = textLines.join('\n');
      const excerpt = textLines.slice(1).join(' ').slice(0, 280);
      return {
        sectionId: `KY-${doc.plan}-${number.replace(/[^A-Za-z0-9.]+/g, '_')}`,
        plan: doc.plan, mcparPlanName: doc.mcparPlanName, documentFile, documentHash,
        sectionNumber: number, sectionTitle: hit.title, pdfPage: hit.page,
        pageCount: Math.max(1, (next?.page ?? hit.page) - hit.page + 1),
        textHash: Sha256(Buffer.from(text, 'utf8')), excerpt,
      };
    });
  }
}

function generatedModule(payload: unknown) {
  return `/**
 * Generated by XenoDroid BW export — do not hand-edit.
 * Kentucky MCO contract section index (KY_DMS_MCO_CONTRACTS), built from the
 * retained public contract PDFs. Section titles and pages only; text is
 * hashed. Applicability of any clause is the reviewer's determination.
 */
export const CONTRACT_SECTION_INDEX = ${JSON.stringify(payload, null, 2)};
`;
}

/** Match MCPAR citation text ("26.13 ...", "Appendix A: 79 ...") to indexed sections. */
export function CiteSections(text: string, sections: ContractSection[], plan: string | null) {
  const numbers = new Set<string>();
  for (const m of text.matchAll(/\b(\d{1,2}\.\d{1,2})\b/g)) numbers.add(m[1]);
  for (const m of text.matchAll(/Appendix\s+([A-Z])\b/gi)) numbers.add(`Appendix ${m[1].toUpperCase()}`);
  if (!numbers.size) return [];
  const pool = sections.filter((s) => !plan || s.mcparPlanName === plan);
  const fallback = sections.filter((s) => s.plan === 'Aetna');
  const out: Array<{ sectionNumber: string; sectionTitle: string; plan: string; pdfPage: number; documentFile: string; matchedPlanDocument: boolean }> = [];
  for (const number of numbers) {
    const own = pool.find((s) => s.sectionNumber === number);
    const hit = own || fallback.find((s) => s.sectionNumber === number);
    if (hit) out.push({ sectionNumber: hit.sectionNumber, sectionTitle: hit.sectionTitle, plan: hit.plan, pdfPage: hit.pdfPage, documentFile: hit.documentFile, matchedPlanDocument: Boolean(own) });
  }
  return out;
}

export class ExportContractSectionIndexForUi {
  Status: 'INITIAL' | 'SUCCEEDED' | 'FAILED' = 'INITIAL';
  ErrorMessage = '';
  ExportPath = path.join(REPO_ROOT, 'wireframe V1', 'app', 'src', 'data', 'alp', 'contractSectionIndex.js');
  SectionCount = 0;

  constructor(private index: IndexContractSections) {}

  async Run() {
    if (this.Status !== 'INITIAL') return;
    try {
      const anchors = ['Liquidated Damages', 'Encounter Data', 'Medical Loss Ratio', 'Corrective Action', 'Network Adequacy', 'Prior Authorization', 'Overpayment', 'Sanction', 'Withhold', 'Program Integrity', 'Reporting'];
      const byPlan = this.index.Documents.map((d) => {
        const sections = this.index.Sections.filter((s) => s.plan === d.plan);
        return {
          plan: d.plan, mcparPlanName: d.mcparPlanName, documentFile: d.file, pages: d.pages, documentHash: d.documentHash, gap: d.gap,
          sectionCount: sections.length,
          obligationAnchors: anchors.map((anchor) => ({
            anchor,
            sections: sections.filter((s) => s.sectionTitle.toLocaleLowerCase().includes(anchor.toLocaleLowerCase())).map((s) => ({ sectionNumber: s.sectionNumber, sectionTitle: s.sectionTitle, pdfPage: s.pdfPage })),
          })).filter((a) => a.sections.length),
          sections: sections.map((s) => ({ sectionNumber: s.sectionNumber, sectionTitle: s.sectionTitle, pdfPage: s.pdfPage, pageCount: s.pageCount, textHash: s.textHash, excerpt: s.excerpt })),
        };
      });
      this.SectionCount = this.index.Sections.length;
      const payload = {
        schema: 'decisionpro/contract-section-index/v1',
        generatedAt: new Date().toISOString(),
        loadClass: 'REAL',
        state: 'KY',
        sourcePageUri: config.mcoContractsPageUri,
        note: 'Section numbers, titles, and PDF pages from the retained Kentucky MCO contract documents; excerpts are the first sentences of each section. A citation match locates a clause — it never determines applicability, breach, or remedy.',
        byPlan,
      };
      await fs.mkdir(path.dirname(this.ExportPath), { recursive: true });
      await fs.writeFile(this.ExportPath, generatedModule(payload), 'utf8');
      this.Status = 'SUCCEEDED';
    } catch (error) {
      this.Status = 'FAILED';
      this.ErrorMessage = error instanceof Error ? error.message : String(error);
    }
  }
}
