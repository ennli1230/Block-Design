import type { EditorDocument } from '@blockdesign/contracts';

export class DocumentHistory {
  private past: EditorDocument[] = [];
  private future: EditorDocument[] = [];
  private lastKey: string | null = null;
  private lastAt = 0;
  private readonly limit: number;

  constructor(limit = 80) {
    this.limit = limit;
  }

  push(before: EditorDocument, key: string | null = null): void {
    const now = Date.now();
    const coalesce = key !== null && key === this.lastKey && now - this.lastAt < 650;
    if (!coalesce) {
      this.past.push(structuredClone(before));
      if (this.past.length > this.limit) this.past.shift();
    }
    this.future = [];
    this.lastKey = key;
    this.lastAt = now;
  }

  undo(current: EditorDocument): EditorDocument | null {
    const previous = this.past.pop();
    if (!previous) return null;
    this.future.push(structuredClone(current));
    this.lastKey = null;
    return structuredClone(previous);
  }

  redo(current: EditorDocument): EditorDocument | null {
    const next = this.future.pop();
    if (!next) return null;
    this.past.push(structuredClone(current));
    this.lastKey = null;
    return structuredClone(next);
  }

  get canUndo(): boolean { return this.past.length > 0; }
  get canRedo(): boolean { return this.future.length > 0; }
}

export interface DocumentTransaction {
  readonly document: EditorDocument;
  readonly changes: number;
  commit(change: (draft: EditorDocument) => void): void;
}

export function transact(document: EditorDocument, change: (draft: EditorDocument) => void): EditorDocument {
  const next = structuredClone(document);
  change(next);
  return next;
}
