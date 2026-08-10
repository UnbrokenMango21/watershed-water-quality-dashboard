import { Directory, File, Paths } from 'expo-file-system';

import { parsePartialObservationDraft } from '@/domain/parsers';
import type { PartialObservationDraft } from '@/domain/types';

const ROOT_DIRECTORY = 'collector-drafts-v1';

function safeSegment(value: string, field: string): string {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(value)) throw new Error(`Invalid ${field}`);
  return value;
}

function userDirectory(uid: string) {
  return new Directory(Paths.document, ROOT_DIRECTORY, safeSegment(uid, 'collector uid'));
}

function draftFile(uid: string, submissionId: string) {
  return new File(userDirectory(uid), `${safeSegment(submissionId, 'submission id')}.json`);
}

export async function savePartialDraft(uid: string, draft: PartialObservationDraft): Promise<void> {
  const parsed = parsePartialObservationDraft({ ...draft, updatedAt: new Date().toISOString() });
  const directory = userDirectory(uid);
  directory.create({ intermediates: true, idempotent: true });
  const destination = draftFile(uid, parsed.submissionId);
  const temporary = new File(directory, `${parsed.submissionId}.tmp`);
  temporary.create({ overwrite: true });
  temporary.write(JSON.stringify(parsed));
  await temporary.move(destination, { overwrite: true });
}

export async function loadPartialDraft(
  uid: string,
  submissionId: string,
): Promise<PartialObservationDraft | null> {
  const file = draftFile(uid, submissionId);
  if (!file.exists) return null;
  return parsePartialObservationDraft(JSON.parse(await file.text()));
}

export async function listPartialDrafts(uid: string): Promise<{
  drafts: PartialObservationDraft[];
  unreadableCount: number;
}> {
  const directory = userDirectory(uid);
  if (!directory.exists) return { drafts: [], unreadableCount: 0 };

  const drafts: PartialObservationDraft[] = [];
  let unreadableCount = 0;
  for (const item of directory.list()) {
    if (!(item instanceof File) || item.extension !== '.json') continue;
    try {
      drafts.push(parsePartialObservationDraft(JSON.parse(await item.text())));
    } catch {
      unreadableCount += 1;
    }
  }
  drafts.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  return { drafts, unreadableCount };
}

export function removePartialDraft(uid: string, submissionId: string): void {
  const file = draftFile(uid, submissionId);
  if (file.exists) file.delete();
}

export function removeAllPartialDrafts(uid: string): void {
  const directory = userDirectory(uid);
  if (directory.exists) directory.delete();
}
