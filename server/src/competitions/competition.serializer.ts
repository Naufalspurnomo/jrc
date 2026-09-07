type CompetitionForSerialization = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  eventId: string;
  eventName: string;
  fee: number;
  currency: string;
  registrationDeadline: Date;
  [key: string]: unknown;
};

export function serializeCompetition(competition: CompetitionForSerialization) {
  return {
    id: competition.id,
    slug: competition.slug,
    name: competition.name,
    description: competition.description,
    eventId: competition.eventId,
    eventName: competition.eventName,
    fee: competition.fee,
    currency: competition.currency,
    registrationDeadline: competition.registrationDeadline.toISOString(),
  };
}