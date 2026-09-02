import { ChainDisplayLabel, ResolveChainLabel } from './ChainLabelAtoms.js';

function expect(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

export function RunChainLabelAtomTests() {
  const organization = ResolveChainLabel('123', 'SIGNATURE HEALTHCARE');
  expect(organization.status === 'organization' && organization.label === 'SIGNATURE HEALTHCARE', 'organization marker must keep the label');
  for (const name of ['TRILOGY HEALTH SERVICES', 'SEKY HOLDING CO.', 'PACS GROUP', 'LYON HEALTHCARE', 'CARMELITE SISTERS FOR THE AGED & INFIRM', 'ECC TRUST']) {
    expect(ResolveChainLabel('1', name).status === 'organization', `${name} must resolve as an organization`);
  }
  // Two-word and three-word personal names carry no organization marker and
  // must be withheld while the chain id is retained.
  for (const name of ['JOHN SMITH', 'JANE Q PUBLIC', 'A PERSON & ANOTHER PERSON']) {
    const withheld = ResolveChainLabel('77', name);
    expect(withheld.status === 'withheld_not_organization' && withheld.label === null && withheld.chainId === '77', `${name} must be withheld with the chain id kept`);
    expect(!ChainDisplayLabel(withheld).includes(name), 'withheld display label must not echo the source name');
    expect(ChainDisplayLabel(withheld).includes('77'), 'withheld display label must carry the chain id');
  }
  const none = ResolveChainLabel('', '');
  expect(none.status === 'no_chain' && ChainDisplayLabel(none) === 'No CMS chain reported', 'empty chain resolves to no_chain');
  // A marker embedded inside another word does not qualify (CO inside COLLINS).
  expect(ResolveChainLabel('9', 'COLLINS').status === 'withheld_not_organization', 'embedded marker must not qualify');
}
