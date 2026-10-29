type DraftStorage = Pick<Storage, 'getItem' | 'setItem'>;

/** Keep the original raw value so older drafts need no format migration. */
export function createDraftPersistence(storage: DraftStorage, key: string, initialRaw: string | null) {
  let expected = initialRaw;
  let pending: string | null = null;
  let conflict = false;
  return {
    stage(raw: string) { pending = raw === expected ? null : raw; },
    hasPending() { return pending !== null; },
    discardPending() { pending = null; },
    observeExternalChange() {
      conflict ||= storage.getItem(key) !== expected;
      return conflict;
    },
    save(): 'unchanged' | 'saved' | 'conflict' {
      // A clean page must never write its old snapshot when it leaves.
      if (pending === null) return 'unchanged';
      // Check storage too: its event may not have reached this tab yet.
      if (this.observeExternalChange()) return 'conflict';
      storage.setItem(key, pending);
      expected = pending;
      pending = null;
      return 'saved';
    },
  };
}

export type DraftPersistence = ReturnType<typeof createDraftPersistence>;
