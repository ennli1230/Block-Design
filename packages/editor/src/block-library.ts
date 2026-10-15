import type { BlockDefinitionVersion, BlockLibraryAdapter, VersionRef } from '@blockdesign/contracts';

/** Load the host's shared catalog without changing any definition's owning system. */
export async function loadLibraryDefinitions(library: BlockLibraryAdapter, systems: VersionRef[], includeArchived = false): Promise<BlockDefinitionVersion[]> {
  const uniqueSystems = [...new Map(systems.map(ref => [`${ref.id}@${ref.version}`, ref])).values()];
  const catalogs = await Promise.all(uniqueSystems.map(async designSystemRef => {
    const items: BlockDefinitionVersion[] = [];
    const seenCursors = new Set<string>();
    let cursor: string | undefined;
    do {
      const page = await library.list({ designSystemRef, includeArchived, ...(cursor ? { cursor } : {}) });
      items.push(...page.items);
      cursor = page.nextCursor ?? undefined;
      if (cursor && seenCursors.has(cursor)) break;
      if (cursor) seenCursors.add(cursor);
    } while (cursor);
    return items;
  }));
  return [...new Map(catalogs.flat().map(definition => [`${definition.ref.id}@${definition.ref.version}`, definition])).values()];
}

function searchText(value: string): string {
  return value.toLocaleLowerCase('tr-TR').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ı/g, 'i').replace(/\s+/g, ' ').trim();
}

export function matchingLibraryDefinitions(definitions: BlockDefinitionVersion[], query: string): BlockDefinitionVersion[] {
  const terms = searchText(query).split(' ').filter(Boolean);
  return definitions.filter(definition => {
    if (definition.archived || ['blockdesign.faq', 'blockdesign.banner'].includes(definition.ref.id)) return false;
    const text = searchText([
      definition.name, definition.description, definition.category,
      ...definition.fields.map(field => field.label),
      ...definition.repeaters.flatMap(repeater => [repeater.label, ...repeater.itemFields.map(field => field.label)]),
    ].join(' '));
    return terms.every(term => text.includes(term));
  });
}
