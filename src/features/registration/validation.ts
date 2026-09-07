import { z } from 'zod';

const phoneSchema = z.string()
  .trim()
  .regex(/^08\d{8,13}$/, 'Gunakan nomor WhatsApp Indonesia yang valid.');

export const registrationPersonSchema = z.object({
  name: z.string().trim().min(2, 'Nama minimal 2 karakter.'),
  email: z.email('Masukkan alamat email yang valid.'),
  phone: phoneSchema,
});

export const registrationDraftSchema = z.object({
  teamName: z.string().trim().min(3, 'Nama tim minimal 3 karakter.'),
  institution: z.string().trim().min(2, 'Nama institusi minimal 2 karakter.'),
  competitionId: z.string().trim().min(1, 'Pilih satu arena perlombaan.'),
  leader: registrationPersonSchema,
  members: z.array(registrationPersonSchema).max(10, 'Maksimal 10 anggota tambahan.'),
});

export type RegistrationPersonValues = z.infer<typeof registrationPersonSchema>;
export type RegistrationDraftValues = z.infer<typeof registrationDraftSchema>;