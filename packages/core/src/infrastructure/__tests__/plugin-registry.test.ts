import { describe, it, expect, beforeEach } from "vitest";
import { InMemoryPluginRegistry } from "../plugin-registry.js";
import type { LegislationPlugin } from "../../domain/plugin.js";

function makePlugin(id: string): LegislationPlugin {
  return {
    id,
    name: `Plugin ${id}`,
    version: "1.0.0",
    classifyBySignals: () => null,
    classifyByKeywords: () => null,
    getSignalSchema: () => ({}),
    getAssessments: () => [],
    runAssessment: () => ({ assessmentId: "", result: {}, reasoning: "", relevantArticles: [] }),
    calculatePenalty: () => ({
      tierName: "",
      maxFineEur: 0,
      calculatedFine: 0,
      globalTurnoverPercentage: 0,
      explanation: "",
      smeApplied: false,
    }),
  };
}

describe("InMemoryPluginRegistry", () => {
  let registry: InMemoryPluginRegistry;

  beforeEach(() => {
    registry = new InMemoryPluginRegistry();
  });

  it("register and get works", () => {
    const plugin = makePlugin("eu-ai-act");
    registry.register(plugin);

    const retrieved = registry.get("eu-ai-act");
    expect(retrieved).toBe(plugin);
    expect(retrieved.id).toBe("eu-ai-act");
  });

  it("get unknown ID throws", () => {
    expect(() => registry.get("nonexistent")).toThrow(
      "No plugin registered for legislation: nonexistent",
    );
  });

  it("list returns all registered plugins", () => {
    const plugin1 = makePlugin("eu-ai-act");
    const plugin2 = makePlugin("us-ai-act");
    registry.register(plugin1);
    registry.register(plugin2);

    const list = registry.list();
    expect(list).toHaveLength(2);
    expect(list.map((p) => p.id)).toContain("eu-ai-act");
    expect(list.map((p) => p.id)).toContain("us-ai-act");
  });

  it("list returns empty array when nothing registered", () => {
    expect(registry.list()).toHaveLength(0);
  });

  it("registering same ID overwrites previous plugin", () => {
    const plugin1 = makePlugin("eu-ai-act");
    const plugin2 = makePlugin("eu-ai-act");
    plugin2.name = "Updated Plugin";

    registry.register(plugin1);
    registry.register(plugin2);

    const retrieved = registry.get("eu-ai-act");
    expect(retrieved.name).toBe("Updated Plugin");
    expect(registry.list()).toHaveLength(1);
  });
});
