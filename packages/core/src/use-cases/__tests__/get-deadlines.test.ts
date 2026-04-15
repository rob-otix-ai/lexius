import { describe, it, expect, vi, beforeEach } from "vitest";
import { GetDeadlines } from "../get-deadlines.js";
import type { DeadlineRepository } from "../../domain/ports/repositories.js";
import type { Deadline } from "../../domain/entities/deadline.js";

function makeDeadline(daysFromNow: number, id: string = "dl-1"): Deadline {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return {
    id,
    legislationId: "eu-ai-act",
    date,
    event: `Event ${id}`,
    description: `Description for ${id}`,
  };
}

describe("GetDeadlines", () => {
  let mockRepo: DeadlineRepository;
  let useCase: GetDeadlines;

  beforeEach(() => {
    mockRepo = {
      findByLegislation: vi.fn().mockResolvedValue([]),
      findUpcoming: vi.fn(),
    };
    useCase = new GetDeadlines(mockRepo);
  });

  it("past deadline → isPast true, daysRemaining negative", async () => {
    vi.mocked(mockRepo.findByLegislation).mockResolvedValue([makeDeadline(-30, "past")]);

    const { deadlines } = await useCase.execute("eu-ai-act");

    expect(deadlines).toHaveLength(1);
    expect(deadlines[0].isPast).toBe(true);
    expect(deadlines[0].daysRemaining).toBeLessThan(0);
  });

  it("future deadline → isPast false, daysRemaining positive", async () => {
    vi.mocked(mockRepo.findByLegislation).mockResolvedValue([makeDeadline(60, "future")]);

    const { deadlines } = await useCase.execute("eu-ai-act");

    expect(deadlines).toHaveLength(1);
    expect(deadlines[0].isPast).toBe(false);
    expect(deadlines[0].daysRemaining).toBeGreaterThan(0);
  });

  it("nextMilestone is nearest future deadline", async () => {
    vi.mocked(mockRepo.findByLegislation).mockResolvedValue([
      makeDeadline(-10, "past"),
      makeDeadline(30, "near-future"),
      makeDeadline(90, "far-future"),
    ]);

    const { nextMilestone } = await useCase.execute("eu-ai-act");

    expect(nextMilestone).not.toBeNull();
    expect(nextMilestone!.id).toBe("near-future");
    expect(nextMilestone!.isPast).toBe(false);
  });

  it("nextMilestone is null when all deadlines are past", async () => {
    vi.mocked(mockRepo.findByLegislation).mockResolvedValue([
      makeDeadline(-30, "past-1"),
      makeDeadline(-10, "past-2"),
    ]);

    const { nextMilestone } = await useCase.execute("eu-ai-act");

    expect(nextMilestone).toBeNull();
  });

  it("deadlines are sorted by date", async () => {
    vi.mocked(mockRepo.findByLegislation).mockResolvedValue([
      makeDeadline(90, "far"),
      makeDeadline(-10, "past"),
      makeDeadline(30, "near"),
    ]);

    const { deadlines } = await useCase.execute("eu-ai-act");

    expect(deadlines[0].id).toBe("past");
    expect(deadlines[1].id).toBe("near");
    expect(deadlines[2].id).toBe("far");
  });

  it("empty deadlines list works", async () => {
    const { deadlines, nextMilestone } = await useCase.execute("eu-ai-act");

    expect(deadlines).toHaveLength(0);
    expect(nextMilestone).toBeNull();
  });
});
