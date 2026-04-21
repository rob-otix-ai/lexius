// derivedFrom assertions — enforce that every CURATED row carries a non-empty
// anchor to the AUTHORITATIVE layer, and every anchor resolves to an existing
// article. Extraction is the core; curator prose is the interpretation of it.
// A curator must never author an orphan interpretation. C-INT-007.

export class DerivedFromRequired extends Error {
  constructor() {
    super("derivedFrom must not be empty for CURATED rows");
    this.name = "DerivedFromRequired";
  }
}

export class DerivedFromUnresolved extends Error {
  readonly missing: string[];
  constructor(missing: string[]) {
    super(
      `derivedFrom contains article id(s) that do not exist: ${missing.join(", ")}`,
    );
    this.name = "DerivedFromUnresolved";
    this.missing = missing;
  }
}

export interface ArticleExistenceChecker {
  findMissing(articleIds: string[]): Promise<string[]>;
}

export function assertDerivedFromNonEmpty(derivedFrom: string[] | undefined): void {
  if (!derivedFrom || derivedFrom.length === 0) {
    throw new DerivedFromRequired();
  }
}

export async function assertDerivedFromResolves(
  checker: ArticleExistenceChecker,
  derivedFrom: string[],
): Promise<void> {
  const missing = await checker.findMissing(derivedFrom);
  if (missing.length > 0) {
    throw new DerivedFromUnresolved(missing);
  }
}
