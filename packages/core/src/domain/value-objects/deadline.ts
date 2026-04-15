export interface DeadlineWithStatus {
  id: string;
  legislationId: string;
  date: Date;
  event: string;
  description: string;
  daysRemaining: number;
  isPast: boolean;
}
