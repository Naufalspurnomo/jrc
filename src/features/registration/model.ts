export const REGISTRATION_STATUSES = [
  'draft',
  'submitted',
  'under_review',
  'revision_requested',
  'verified',
  'rejected',
] as const;

export type RegistrationStatus = (typeof REGISTRATION_STATUSES)[number];
export type DemoRole = 'participant' | 'admin';

export const PORTAL_COMPETITIONS = [
  { id: 'transporter-sd', level: 'SD', name: 'Donatopia · Transporter' },
  { id: 'rescue-smp', level: 'SMP', name: 'Nightmaze · Rescue Transporter' },
  { id: 'shooter-sma', level: 'SMA', name: 'Pirate Clash · Transporter Shooter' },
  { id: 'line-follower', level: 'Umum', name: 'Wacky Rally · Line Follower Mikro' },
  { id: 'sumo', level: 'Umum', name: 'Ring Rumble · Sumo' },
  { id: 'soccer', level: 'Umum', name: 'Goal Rush · Soccer' },
] as const;

export interface DemoSession {
  role: DemoRole;
  name: string;
  registrationId?: string;
}

export interface PortalFileMetadata {
  name: string;
  size: number;
  type: string;
  lastModified: number;
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: 'leader' | 'member';
}

export interface RegistrationDraft {
  teamName: string;
  institution: string;
  competitionId: string;
  members: TeamMember[];
  documents: PortalFileMetadata[];
}

export interface ReviewEntry {
  id: string;
  createdAt: string;
  author: string;
  note: string;
  status: RegistrationStatus;
}

export interface Registration extends RegistrationDraft {
  id: string;
  status: RegistrationStatus;
  updatedAt: string;
  submittedAt?: string;
  reviews: ReviewEntry[];
}

export interface RegistrationFilters {
  status?: RegistrationStatus | 'all';
  competitionId?: string;
  query?: string;
}
