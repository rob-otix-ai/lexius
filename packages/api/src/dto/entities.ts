import type {
  Article,
  Obligation,
  FAQ,
  Penalty,
  Deadline,
  DeadlineWithStatus,
} from "@lexius/core";
import { toProvenanceDTO, type ProvenanceDTO } from "./provenance.js";

/**
 * Entity-to-DTO mappers for provenance-bearing domain entities.
 *
 * Each helper attaches a flattened `provenance` field and includes
 * `derivedFrom` where the domain entity carries one (Obligation, FAQ).
 *
 * Helpers are defensive: when the input does not carry a `provenance`
 * field (e.g. lightweight test fixtures), they pass the object through
 * unchanged so the DTO contract stays additive in practice.
 */

export interface ArticleDTO extends Omit<Article, "provenance"> {
  provenance: ProvenanceDTO;
}

export interface ObligationDTO extends Omit<Obligation, "provenance"> {
  provenance: ProvenanceDTO;
}

export interface FAQDTO extends Omit<FAQ, "provenance"> {
  provenance: ProvenanceDTO;
}

export interface PenaltyDTO extends Omit<Penalty, "provenance"> {
  provenance: ProvenanceDTO;
}

export type DeadlineDTO = Omit<Deadline, "provenance"> & {
  provenance: ProvenanceDTO;
  daysRemaining?: number;
  isPast?: boolean;
};

function hasProvenance(v: unknown): v is { provenance: Article["provenance"] } {
  return (
    typeof v === "object" &&
    v !== null &&
    "provenance" in v &&
    (v as { provenance: unknown }).provenance !== undefined &&
    (v as { provenance: unknown }).provenance !== null
  );
}

export function toArticleDTO(a: Article): ArticleDTO {
  if (!hasProvenance(a)) return a as unknown as ArticleDTO;
  return { ...a, provenance: toProvenanceDTO(a.provenance) };
}

export function toObligationDTO(o: Obligation): ObligationDTO {
  if (!hasProvenance(o)) return o as unknown as ObligationDTO;
  return { ...o, provenance: toProvenanceDTO(o.provenance) };
}

export function toFaqDTO(f: FAQ): FAQDTO {
  if (!hasProvenance(f)) return f as unknown as FAQDTO;
  return { ...f, provenance: toProvenanceDTO(f.provenance) };
}

export function toPenaltyDTO(p: Penalty): PenaltyDTO {
  if (!hasProvenance(p)) return p as unknown as PenaltyDTO;
  return { ...p, provenance: toProvenanceDTO(p.provenance) };
}

export function toDeadlineDTO(d: Deadline | DeadlineWithStatus): DeadlineDTO {
  if (!hasProvenance(d)) return d as unknown as DeadlineDTO;
  return { ...d, provenance: toProvenanceDTO(d.provenance) };
}
