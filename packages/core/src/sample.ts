import type { BlockDefinitionVersion, EditorDocument } from '@blockdesign/contracts';
import { createEmptyDocument, makeInstance } from './index.ts';
import { demoDefinitions, faqDefinition } from './catalog.ts';

export function createSampleDocument(): EditorDocument {
  const document = createEmptyDocument();
  document.blocks = [makeInstance(faqDefinition)];
  return document;
}

export function builtInDefinitions(): BlockDefinitionVersion[] {
  return structuredClone([...demoDefinitions]);
}
