import type { CuratorEdit, Obligation } from "@lexius/core";

export function toCuratorEditDTO(e: CuratorEdit): Record<string, unknown> {
  return {
    id: e.id,
    entity_type: e.entityType,
    entity_id: e.entityId,
    editor_id: e.editorId,
    editor_ip: e.editorIp,
    editor_ua: e.editorUa,
    source: e.source,
    action: e.action,
    old_values: e.oldValues,
    new_values: e.newValues,
    row_version_before: e.rowVersionBefore,
    row_version_after: e.rowVersionAfter,
    reason: e.reason,
    cross_check_result: e.crossCheckResult,
    edited_at: e.editedAt.toISOString(),
  };
}

export function toObligationCuratorDTO(o: Obligation): Record<string, unknown> {
  return {
    id: o.id,
    legislation_id: o.legislationId,
    role: o.role,
    risk_level: o.riskLevel,
    obligation: o.obligation,
    article: o.article,
    deadline: o.deadline?.toISOString() ?? null,
    details: o.details,
    category: o.category,
    derived_from: o.derivedFrom,
    provenance: o.provenance,
    row_version: o.rowVersion,
    needs_review: o.needsReview,
    stale_since: o.staleSince?.toISOString() ?? null,
    deprecated_at: o.deprecatedAt?.toISOString() ?? null,
    deprecated_reason: o.deprecatedReason,
  };
}
