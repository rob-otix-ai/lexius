import type { DeadlineRepository } from "../domain/ports/repositories.js";
import type { DeadlineWithStatus } from "../domain/value-objects/deadline.js";

export class GetDeadlines {
  constructor(private readonly deadlineRepo: DeadlineRepository) {}

  async execute(legislationId: string): Promise<{ deadlines: DeadlineWithStatus[]; nextMilestone: DeadlineWithStatus | null }> {
    const deadlines = await this.deadlineRepo.findByLegislation(legislationId);
    const now = new Date();

    const withStatus: DeadlineWithStatus[] = deadlines.map((d) => {
      const diffMs = d.date.getTime() - now.getTime();
      const daysRemaining = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      return {
        ...d,
        daysRemaining,
        isPast: daysRemaining < 0,
      };
    });

    withStatus.sort((a, b) => a.date.getTime() - b.date.getTime());

    const nextMilestone = withStatus.find((d) => !d.isPast) ?? null;

    return { deadlines: withStatus, nextMilestone };
  }
}
