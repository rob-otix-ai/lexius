export interface PenaltyInput {
  legislationId: string;
  violationType: string;
  annualTurnoverEur: number;
  isSme?: boolean;
}

export interface PenaltyOutput {
  tierName: string;
  maxFineEur: number;
  calculatedFine: number;
  globalTurnoverPercentage: number;
  explanation: string;
  smeApplied: boolean;
}
