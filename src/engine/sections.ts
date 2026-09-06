import type { OwnershipGrant } from '../domain/config.js';
import { hashContent } from './fingerprint.js';

function bounds(content: string, anchors: readonly [string, string]): [number, number] {
  const [start, end] = anchors;
  const startAt = content.indexOf(start);
  const endAt = content.indexOf(end, startAt + start.length);
  if (
    startAt < 0 ||
    endAt < 0 ||
    content.indexOf(start, startAt + start.length) >= 0 ||
    content.indexOf(end, endAt + end.length) >= 0
  ) {
    throw new Error('Section anchors are missing, duplicated, or out of order.');
  }
  return [startAt + start.length, endAt];
}

export function renderManagedSection(
  existing: string | undefined,
  generated: string,
  anchors: readonly [string, string],
): string {
  const [start, end] = anchors;
  if (generated.includes(start) || generated.includes(end)) {
    throw new Error('Generated content contains a section ownership anchor.');
  }
  const section = `\n${generated.trimEnd()}\n`;
  if (existing === undefined) return `${start}${section}${end}\n`;
  const [contentStart, contentEnd] = bounds(existing, anchors);
  return `${existing.slice(0, contentStart)}${section}${existing.slice(contentEnd)}`;
}

export function ownedContentDigest(content: string, grant: OwnershipGrant | undefined): string {
  if (grant?.mode !== 'section-managed') return hashContent(content);
  if (grant.anchors === undefined) throw new Error('Section-managed ownership requires anchors.');
  const [contentStart, contentEnd] = bounds(content, grant.anchors);
  return hashContent(content.slice(contentStart, contentEnd));
}
