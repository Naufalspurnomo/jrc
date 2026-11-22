type CompetitionForSerialization = {
  id: string;
  slug: string;
  name: string;
  level: string;
  discipline: string;
  description: string | null;
  eventId: string;
  eventName: string;
  fee: number;
  currency: string;
  registrationOpenAt: Date;
  registrationDeadline: Date;
  [key: string]: unknown;
};

export function serializeCompetition(competition: CompetitionForSerialization) {
  return {
    id: competition.id,
    slug: competition.slug,
    name: competition.name,
    level: competition.level,
    discipline: competition.discipline,
    description: competition.description,
    eventId: competition.eventId,
    eventName: competition.eventName,
    fee: competition.fee,
    currency: competition.currency,
    registrationOpenAt: competition.registrationOpenAt.toISOString(),
    registrationDeadline: competition.registrationDeadline.toISOString(),
    serverTime: new Date().toISOString(),
  };
}