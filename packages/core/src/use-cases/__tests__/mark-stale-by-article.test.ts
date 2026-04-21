import { describe, expect, it, beforeEach } from "vitest";
import {
  FakeObligationRepository,
  makeObligation,
} from "./curator-fakes.js";
import { MarkStaleByArticle } from "../../index.js";

describe("MarkStaleByArticle", () => {
  let obligations: FakeObligationRepository;
  let useCase: MarkStaleByArticle;

  beforeEach(() => {
    obligations = new FakeObligationRepository();
    useCase = new MarkStaleByArticle(obligations);
  });

  it("flags all CURATED obligations whose derivedFrom contains the article id", async () => {
    obligations.seed(makeObligation({ id: "o-1", derivedFrom: ["eu-ai-act-art-9"] }));
    obligations.seed(
      makeObligation({ id: "o-2", derivedFrom: ["eu-ai-act-art-9", "eu-ai-act-art-10"] }),
    );
    obligations.seed(makeObligation({ id: "o-3", derivedFrom: ["eu-ai-act-art-99"] }));

    const count = await useCase.execute({
      articleId: "eu-ai-act-art-9",
      staleSince: new Date("2026-04-21T09:00:00Z"),
    });

    expect(count).toBe(2);
    const stale = await obligations.findStale();
    expect(stale.map((o) => o.id).sort()).toEqual(["o-1", "o-2"]);
  });

  it("does not flag AUTHORITATIVE or deprecated rows", async () => {
    obligations.seed(
      makeObligation({
        id: "auth",
        derivedFrom: ["eu-ai-act-art-9"],
        provenance: {
          tier: "AUTHORITATIVE",
          sourceUrl: "x",
          sourceHash: "y",
          fetchedAt: new Date(),
        },
      }),
    );
    obligations.seed(
      makeObligation({
        id: "dep",
        derivedFrom: ["eu-ai-act-art-9"],
        deprecatedAt: new Date(),
        deprecatedReason: "old",
      }),
    );
    const count = await useCase.execute({
      articleId: "eu-ai-act-art-9",
      staleSince: new Date(),
    });
    expect(count).toBe(0);
  });
});
