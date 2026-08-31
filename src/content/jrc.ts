export const pendingAnnouncement = 'Akan diumumkan' as const;
export const registrationPeriod = '15 September–15 Oktober 2026' as const;
export const registrationDeadline = '2026-10-15T23:59:59+07:00' as const;

export type CompetitionLevel = 'SD' | 'SMP' | 'SMA' | 'Umum';

export interface Competition {
  slug: string;
  romanNumeral: string;
  name: string;
  shortName: string;
  level: CompetitionLevel;
  discipline: string;
  fixtureLabel: 'Kategori resmi JRC XIV';
  fee: typeof pendingAnnouncement;
  guidebook: {
    label: 'Guidebook';
    status: typeof pendingAnnouncement;
    href: null;
  };
  provocation: string;
  description: string;
  objective: string;
  accent: 'gold' | 'crimson' | 'blue';
}

export const competitions: readonly Competition[] = [
  {
    slug: 'donatopia-transporter',
    romanNumeral: 'I',
    name: 'Donatopia — Transporter',
    shortName: 'Donatopia',
    level: 'SD',
    discipline: 'Transporter',
    fixtureLabel: 'Kategori resmi JRC XIV',
    fee: pendingAnnouncement,
    guidebook: { label: 'Guidebook', status: pendingAnnouncement, href: null },
    provocation: 'Bawa misi sampai garis akhir.',
    description:
      'Arena pemula yang menguji logika rute, ketelitian mekanik, dan keberanian tim muda dalam satu lintasan.',
    objective: 'Merancang robot transporter yang stabil, terukur, dan mampu menuntaskan misi arena.',
    accent: 'gold',
  },
  {
    slug: 'nightmaze-rescue-transporter',
    romanNumeral: 'II',
    name: 'Nightmaze — Rescue Transporter',
    shortName: 'Nightmaze',
    level: 'SMP',
    discipline: 'Rescue Transporter',
    fixtureLabel: 'Kategori resmi JRC XIV',
    fee: pendingAnnouncement,
    guidebook: { label: 'Guidebook', status: pendingAnnouncement, href: null },
    provocation: 'Temukan jalan ketika arena menggelap.',
    description:
      'Lintasan penyelamatan yang menggabungkan navigasi, keputusan cepat, dan presisi saat membawa objek misi.',
    objective: 'Membuktikan kemampuan robot membaca jalur dan menuntaskan skenario penyelamatan.',
    accent: 'blue',
  },
  {
    slug: 'pirate-clash-transporter-shooter',
    romanNumeral: 'III',
    name: 'Pirate Clash — Transporter Shooter',
    shortName: 'Pirate Clash',
    level: 'SMA',
    discipline: 'Transporter Shooter',
    fixtureLabel: 'Kategori resmi JRC XIV',
    fee: pendingAnnouncement,
    guidebook: { label: 'Guidebook', status: pendingAnnouncement, href: null },
    provocation: 'Angkut, bidik, tuntaskan.',
    description:
      'Duel strategi yang menuntut perpaduan mekanisme pengangkut, sistem pelontar, dan kendali yang matang.',
    objective: 'Membangun robot multi-mekanisme yang tetap presisi di bawah tekanan waktu.',
    accent: 'crimson',
  },
  {
    slug: 'wacky-rally-line-follower-mikro',
    romanNumeral: 'IV',
    name: 'Wacky Rally — Line Follower Mikro',
    shortName: 'Wacky Rally',
    level: 'Umum',
    discipline: 'Line Follower Mikro',
    fixtureLabel: 'Kategori resmi JRC XIV',
    fee: pendingAnnouncement,
    guidebook: { label: 'Guidebook', status: pendingAnnouncement, href: null },
    provocation: 'Kecepatan lahir dari kendali.',
    description:
      'Balapan mikro yang menguji pembacaan sensor, tuning algoritma, dan konsistensi pada setiap tikungan.',
    objective: 'Mencapai waktu terbaik tanpa mengorbankan kestabilan pembacaan lintasan.',
    accent: 'gold',
  },
  {
    slug: 'ring-rumble-sumo',
    romanNumeral: 'V',
    name: 'Ring Rumble — Sumo',
    shortName: 'Ring Rumble',
    level: 'Umum',
    discipline: 'Sumo',
    fixtureLabel: 'Kategori resmi JRC XIV',
    fee: pendingAnnouncement,
    guidebook: { label: 'Guidebook', status: pendingAnnouncement, href: null },
    provocation: 'Satu ring. Tidak ada ruang untuk ragu.',
    description:
      'Pertarungan robot sumo yang menempatkan traksi, deteksi lawan, konstruksi, dan strategi dalam satu lingkar arena.',
    objective: 'Mendorong lawan keluar ring melalui desain tangguh dan strategi kendali yang disiplin.',
    accent: 'crimson',
  },
  {
    slug: 'goal-rush-soccer',
    romanNumeral: 'VI',
    name: 'Goal Rush — Soccer',
    shortName: 'Goal Rush',
    level: 'Umum',
    discipline: 'Soccer',
    fixtureLabel: 'Kategori resmi JRC XIV',
    fee: pendingAnnouncement,
    guidebook: { label: 'Guidebook', status: pendingAnnouncement, href: null },
    provocation: 'Baca arena. Rebut bola. Cetak sejarah.',
    description:
      'Sepak bola robot sebagai ujian integrasi gerak, pembacaan situasi, dan eksekusi strategi di arena dinamis.',
    objective: 'Membangun sistem robot yang tangkas, responsif, dan mampu mengeksekusi peluang.',
    accent: 'blue',
  },
] as const;

export const eventFacts = {
  edition: '14',
  registration: registrationPeriod,
  eventDate: pendingAnnouncement,
  venue: 'Politeknik Elektronika Negeri Surabaya',
  theme: 'Imperium Machina',
} as const;

export interface ScheduleItem {
  numeral: string;
  title: string;
  date: string;
  description: string;
}

export const eventSchedule: readonly ScheduleItem[] = [
  {
    numeral: 'I',
    title: 'Periode pendaftaran',
    date: registrationPeriod,
    description: 'Pilih arena, bentuk tim, dan siapkan dokumen sebelum pendaftaran ditutup.',
  },
  {
    numeral: 'II',
    title: 'Verifikasi legion',
    date: pendingAnnouncement,
    description: 'Panitia meninjau kelengkapan tim dan mengirimkan catatan perbaikan bila diperlukan.',
  },
  {
    numeral: 'III',
    title: 'Technical meeting',
    date: pendingAnnouncement,
    description: 'Aturan arena, alur pertandingan, dan ketentuan teknis dipastikan bersama seluruh tim.',
  },
  {
    numeral: 'IV',
    title: 'Hari arena',
    date: pendingAnnouncement,
    description: 'Enam disiplin bertemu dalam satu perayaan rekayasa, keberanian, dan sportivitas.',
  },
] as const;

export interface HistoryChapter {
  numeral: string;
  eyebrow: string;
  title: string;
  copy: string;
  image?: {
    src: string;
    srcMobile: string;
    alt: string;
    caption: string;
  };
}

export const historyChapters: readonly HistoryChapter[] = [
  {
    numeral: 'I',
    eyebrow: 'JRC I · 2009',
    title: 'Satu arena mulai dibangun',
    copy: 'JRC lahir sebagai ruang bagi pelajar dan perancang muda untuk menguji robot di hadapan tantangan nyata.',
    image: {
      src: '/assets/history-archive/jrc-01.webp',
      srcMobile: '/assets/history-archive/jrc-01-mobile.webp',
      alt: 'Dokumentasi awal Java Robot Contest',
      caption: 'Arsip Java Robot Contest',
    },
  },
  {
    numeral: 'III',
    eyebrow: 'JRC III · 2012',
    title: 'JRC III kembali setelah jeda',
    copy: 'Arena maze menjadi panggung kebangkitan setelah jeda, menegaskan JRC sebagai agenda tahunan yang dinanti.',
    image: {
      src: '/assets/history-archive/jrc-03.webp',
      srcMobile: '/assets/history-archive/jrc-03-mobile.webp',
      alt: 'Arena maze Java Robot Contest III',
      caption: 'Arsip Java Robot Contest',
    },
  },
  {
    numeral: 'V',
    eyebrow: 'JRC V · 2014',
    title: 'Disiplin baru, lawan baru',
    copy: 'Kompetisi berkembang menjadi pertemuan lintas jenjang yang merayakan proses, bukan sekadar podium.',
    image: {
      src: '/assets/history-archive/jrc-05.webp',
      srcMobile: '/assets/history-archive/jrc-05-mobile.webp',
      alt: 'Suasana arena Java Robot Contest',
      caption: 'Arsip Java Robot Contest',
    },
  },
  {
    numeral: 'VIII',
    eyebrow: 'JRC VIII · 2017',
    title: 'Arena yang makin ramai',
    copy: 'Dari satu panggung kecil, JRC tumbuh menjadi perhelatan yang memenuhi ruang publik dengan robot dan penonton.',
    image: {
      src: '/assets/history-archive/jrc-08.webp',
      srcMobile: '/assets/history-archive/jrc-08-mobile.webp',
      alt: 'JRC VIII di ruang publik',
      caption: 'Arsip Java Robot Contest',
    },
  },
  {
    numeral: 'XIII',
    eyebrow: 'JRC XIII · 2023',
    title: 'Edisi sebelumnya',
    copy: 'Pengalaman dari JRC XIII menjadi acuan panitia dalam menyiapkan pelaksanaan JRC XIV.',
    image: {
      src: '/assets/history-archive/jrc-11.webp',
      srcMobile: '/assets/history-archive/jrc-11-mobile.webp',
      alt: 'Dokumentasi Java Robot Contest XIII',
      caption: 'Dokumentasi resmi JRC XIII',
    },
  },
  {
    numeral: 'XIV',
    eyebrow: 'JRC XIV · 2026',
    title: 'Imperium Machina',
    copy: 'Enam kategori resmi hadir dalam satu tema baru, mempertemukan peserta dari jenjang SD, SMP, SMA, dan umum.',
    image: {
      src: '/assets/history-archive/jrc-12.webp',
      srcMobile: '/assets/history-archive/jrc-12-mobile.webp',
      alt: 'Dokumentasi Java Robot Contest XIV',
      caption: 'Dokumentasi resmi JRC XIV',
    },
  },
] as const;

export const festivalMoments = [
  {
    numeral: '01',
    title: 'Arena',
    copy: 'Pertandingan langsung, pengujian terakhir, dan keputusan yang dibuat dalam hitungan detik.',
  },
  {
    numeral: '02',
    title: 'Karya',
    copy: 'Robot, mekanisme, dan ide yang memperlihatkan bagaimana sebuah tim memecahkan persoalan.',
  },
  {
    numeral: '03',
    title: 'Komunitas',
    copy: 'Ruang bertemu bagi peserta, pendamping, alumni, dan penggerak teknologi muda.',
  },
] as const;

export const partnerTiers = [
  'Title Partner',
  'Strategic Partner',
  'Media Partner',
] as const;

export const faqItems = [
  {
    question: 'Kapan pendaftaran dibuka?',
    answer: 'Pendaftaran JRC XIV dibuka pada 15 September dan ditutup pada 15 Oktober 2026.',
  },
  {
    question: 'Apa saja kategori resmi JRC XIV?',
    answer:
      'JRC XIV memiliki enam kategori resmi: Donatopia — Transporter, Nightmaze — Rescue Transporter, Pirate Clash — Transporter Shooter, Wacky Rally — Line Follower Mikro, Ring Rumble — Sumo, dan Goal Rush — Soccer.',
  },
  {
    question: 'Di mana guidebook dapat diunduh?',
    answer: 'Guidebook belum tersedia. Tautan unduhan akan ditampilkan di halaman kategori setelah dirilis.',
  },
  {
    question: 'Siapa yang dapat mengikuti JRC XIV?',
    answer:
      'Jenjang peserta mengikuti kategori masing-masing. Batas usia, komposisi tim, dan persyaratan lain akan diumumkan.',
  },
  {
    question: 'Bagaimana menghubungi panitia?',
    answer: 'Kanal kontak panitia belum tersedia.',
  },
] as const;

export function findCompetition(slug: string | undefined) {
  return competitions.find((competition) => competition.slug === slug);
}
