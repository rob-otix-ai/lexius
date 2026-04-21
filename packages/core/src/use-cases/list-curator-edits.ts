import type { CuratorEditRepository } from "../domain/ports/index.js";
import type {
  CuratorEdit,
  CuratorEditEntityType,
} from "../domain/value-objects/curator-edit.js";

export interface ListCuratorEditsInput {
  entityType?: CuratorEditEntityType;
  entityId?: string;
  editorId?: string;
  since?: Date;
}

export class ListCuratorEdits {
  constructor(private readonly audit: CuratorEditRepository) {}

  async execute(input: ListCuratorEditsInput): Promise<CuratorEdit[]> {
    if (input.entityType && input.entityId) {
      return this.audit.findByEntity(input.entityType, input.entityId);
    }
    if (input.editorId) {
      return this.audit.findByEditor(input.editorId, input.since);
    }
    // Neither entity nor editor — return empty to force an explicit filter.
    return [];
  }
}
