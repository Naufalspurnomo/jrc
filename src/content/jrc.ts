export const pendingAnnouncement = 'Akan diumumkan' as const;
export const registrationPeriod = '30 September–21 November 2026' as const;
export const registrationOpenAt = '2026-09-30T08:00:00+07:00' as const;
export const registrationDeadline = '2026-11-21T23:59:59+07:00' as const;
export const competitionFee = 'Rp 250.000 per tim' as const;

export type CompetitionLevel = 'SD' | 'SMP' | 'SMA' | 'Umum';

export interface Competition {
  slug: string;
  romanNumeral: string;
  name: string;
  shortName: string;
  emblem: {
    src: string;
    alt: string;
  };
  level: CompetitionLevel;
  discipline: string;
  fixtureLabel: 'Kategori resmi JRC XIV';
  fee: typeof competitionFee;
  contact: { name: string; phone: string };
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
    name: 'Castra Guardian',
    shortName: 'CASTRA',
    emblem: {
      src: '/assets/arena-emblems/castra-guardian.webp',
      alt: 'Lambang CASTRA',
    },
    level: 'SD',
    discipline: 'Transporter',
    fixtureLabel: 'Kategori resmi JRC XIV',
    fee: competitionFee,
    contact: { name: 'Naya', phone: '0878-4132-4886' },
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
    name: 'Robo Chiper',
    shortName: 'ROBO CHIPER',
    emblem: {
      src: '/assets/arena-emblems/robo-chiper.webp',
      alt: 'Lambang ROBO CHIPER',
    },
    level: 'SMP',
    discipline: 'Rescue Transporter',
    fixtureLabel: 'Kategori resmi JRC XIV',
    fee: competitionFee,
    contact: { name: 'Manda', phone: '0857-5540-9648' },
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
    name: 'Aquaduct Romana',
    shortName: 'AQUADUCT',
    emblem: {
      src: '/assets/arena-emblems/aquaduct-romana.webp',
      alt: 'Lambang AQUADUCT',
    },
    level: 'SMA',
    discipline: 'Transporter Shooter',
    fixtureLabel: 'Kategori resmi JRC XIV',
    fee: competitionFee,
    contact: { name: 'Aisyah', phone: '0881-0360-87367' },
    guidebook: { label: 'Guidebook', status: pendingAnnouncement, href: null },
    provocation: 'Angkut, bidik, tuntaskan.',
    description:
      'Terdapat dua robot, yaitu Robot Transporter dan Line Follower Transporter. Kedua robot memulai perjalanan dari titik yang sama dan bekerja sama membangun kembali jalur irigasi kota pasca perang dengan saling mengoper objek material pembangunan. Robot Transporter bertugas mengangkut dan menyusun balok untuk membangun jalur irigasi serta membuka palang air. Sementara itu, Line Follower Transporter juga bertugas mengangkut dan menyusun balok secara estafet bersama Robot Transporter hingga jalur irigasi selesai dibangun.',
    objective: 'Membangun robot multi-mekanisme yang tetap presisi di bawah tekanan waktu.',
    accent: 'crimson',
  },
  {
    slug: 'wacky-rally-line-follower-mikro',
    romanNumeral: 'IV',
    name: 'Charion Line',
    shortName: 'CHARION LINE',
    emblem: {
      src: '/assets/arena-emblems/chariot-line.webp',
      alt: 'Lambang CHARION LINE',
    },
    level: 'Umum',
    discipline: 'Line Follower Mikro',
    fixtureLabel: 'Kategori resmi JRC XIV',
    fee: competitionFee,
    contact: { name: 'Alzar', phone: '0813-3002-5557' },
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
    name: 'Colosseum Clash',
    shortName: 'COLOSSEUM',
    emblem: {
      src: '/assets/arena-emblems/colosseum-clash.webp',
      alt: 'Lambang COLOSSEUM',
    },
    level: 'Umum',
    discipline: 'Sumo',
    fixtureLabel: 'Kategori resmi JRC XIV',
    fee: competitionFee,
    contact: { name: 'Nadjwa', phone: '0888-5454-111' },
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
    name: 'Harpastum Arena',
    shortName: 'HARPASTUM',
    emblem: {
      src: '/assets/arena-emblems/harpastum-arena.webp',
      alt: 'Lambang HARPASTUM',
    },
    level: 'Umum',
    discipline: 'Soccer',
    fixtureLabel: 'Kategori resmi JRC XIV',
    fee: competitionFee,
    contact: { name: 'Rissa', phone: '0851-1954-6428' },
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
  year: number;
  theme: string;
  eyebrow: string;
  title: string;
  copy: string;
  image: { src: string; srcMobile: string; alt: string; caption: string };
}

export const historyChapters: readonly HistoryChapter[] = [
  {
    numeral: 'I', year: 2009, theme: 'Jatim Robot Contest pertama', eyebrow: 'JRC I · 2009',
    title: 'Jatim Robot Contest pertama',
    copy: 'JRC lahir di Hall D4 PENS dengan nama Jatim Robot Contest, digagas HIMA ELKA sebagai awal kompetisi robotika ini.',
    image: { src: '/assets/history-archive/jrc-01-first-jatim-robot-contest-desktop.webp', srcMobile: '/assets/history-archive/jrc-01-first-jatim-robot-contest-mobile.webp', alt: 'Dokumentasi JRC I tahun 2009', caption: 'Dokumentasi JRC I tahun 2009' },
  },
  {
    numeral: 'II', year: 2010, theme: 'Resmi menjadi Java Robot Contest', eyebrow: 'JRC II · 2010',
    title: 'Resmi menjadi Java Robot Contest',
    copy: 'Nama Java Robot Contest mulai digunakan. Edisi kedua berlangsung di Gedung Robotika ITS dan memperluas jangkauan kegiatan.',
    image: { src: '/assets/history-archive/jrc-02-renamed-java-robot-contest-desktop.webp', srcMobile: '/assets/history-archive/jrc-02-renamed-java-robot-contest-mobile.webp', alt: 'Dokumentasi JRC II tahun 2010', caption: 'Dokumentasi JRC II tahun 2010' },
  },
  {
    numeral: 'III', year: 2012, theme: 'Kembali setelah satu tahun jeda', eyebrow: 'JRC III · 2012',
    title: 'Kembali setelah satu tahun jeda',
    copy: 'Setelah tidak digelar pada 2011, JRC III kembali pada 2012 dan melanjutkan perjalanan kompetisi robotika ini.',
    image: { src: '/assets/history-archive/jrc-03-return-after-hiatus-desktop.webp', srcMobile: '/assets/history-archive/jrc-03-return-after-hiatus-mobile.webp', alt: 'Dokumentasi JRC III tahun 2012', caption: 'Dokumentasi JRC III tahun 2012' },
  },
  {
    numeral: 'IV', year: 2013, theme: 'Rescue', eyebrow: 'JRC IV · 2013',
    title: 'Rescue',
    copy: 'Tema Rescue memperkenalkan konsep Corporate Auto Manual Robot, langkah awal menuju ragam divisi pada edisi berikutnya.',
    image: { src: '/assets/history-archive/jrc-04-rescue-desktop.webp', srcMobile: '/assets/history-archive/jrc-04-rescue-mobile.webp', alt: 'Dokumentasi JRC IV bertema Rescue', caption: 'Dokumentasi JRC IV bertema Rescue' },
  },
  {
    numeral: 'V', year: 2014, theme: 'Play', eyebrow: 'JRC V · 2014',
    title: 'Play',
    copy: 'Tema Play menghadirkan AMRC Basic, AMRC Advance, dan Corporate sebagai tiga divisi utama kompetisi.',
    image: { src: '/assets/history-archive/jrc-05-play-desktop.webp', srcMobile: '/assets/history-archive/jrc-05-play-mobile.webp', alt: 'Dokumentasi JRC V bertema Play', caption: 'Dokumentasi JRC V bertema Play' },
  },
  {
    numeral: 'VI', year: 2015, theme: 'Surabaya — Sinau Robot lan Budaya', eyebrow: 'JRC VI · 2015',
    title: 'Surabaya — Sinau Robot lan Budaya',
    copy: 'Robotika bertemu budaya lokal melalui tema Surabaya, dilengkapi JRC Food Festival dan Techno Park.',
    image: { src: '/assets/history-archive/jrc-06-surabaya-culture-desktop.webp', srcMobile: '/assets/history-archive/jrc-06-surabaya-culture-mobile.webp', alt: 'Dokumentasi JRC VI bertema Surabaya', caption: 'Dokumentasi JRC VI bertema Surabaya' },
  },
  {
    numeral: 'VII', year: 2016, theme: 'Aerospace', eyebrow: 'JRC VII · 2016',
    title: 'Aerospace',
    copy: 'Tema Aerospace mengenalkan dunia kedirgantaraan melalui divisi Milky Way, Galaxy, Space Shuttle, Rocket Booster, dan Satellite System.',
    image: { src: '/assets/history-archive/jrc-07-aerospace-desktop.webp', srcMobile: '/assets/history-archive/jrc-07-aerospace-mobile.webp', alt: 'Dokumentasi JRC VII bertema Aerospace', caption: 'Dokumentasi JRC VII bertema Aerospace' },
  },
  {
    numeral: 'VIII', year: 2017, theme: 'Marine — Maritim for Indonesia', eyebrow: 'JRC VIII · 2017',
    title: 'Marine — Maritim for Indonesia',
    copy: 'Tema Marine mengangkat pentingnya sektor kelautan Indonesia dan teknologi untuk negeri maritim.',
    image: { src: '/assets/history-archive/jrc-08-marine-indonesia-desktop.webp', srcMobile: '/assets/history-archive/jrc-08-marine-indonesia-mobile.webp', alt: 'Dokumentasi JRC VIII bertema Marine', caption: 'Dokumentasi JRC VIII bertema Marine' },
  },
  {
    numeral: 'IX', year: 2018, theme: 'Zamrud Katulistiwa', eyebrow: 'JRC IX · 2018',
    title: 'Zamrud Katulistiwa',
    copy: 'Empat divisi mengajak peserta mengeksplorasi teknologi sekaligus menjaga kelestarian hutan Indonesia.',
    image: { src: '/assets/history-archive/jrc-09-zamrud-katulistiwa-desktop.webp', srcMobile: '/assets/history-archive/jrc-09-zamrud-katulistiwa-mobile.webp', alt: 'Dokumentasi JRC IX bertema Zamrud Katulistiwa', caption: 'Dokumentasi JRC IX bertema Zamrud Katulistiwa' },
  },
  {
    numeral: 'X', year: 2019, theme: 'Fourth Industrial Revolution — FUSION', eyebrow: 'JRC X · 2019',
    title: 'Fourth Industrial Revolution — FUSION',
    copy: 'Sebanyak 150 tim berkompetisi pada 6–7 Juli 2019 dalam edisi satu dekade bertema Fourth Industrial Revolution (FUSION).',
    image: { src: '/assets/history-archive/jrc-10-fusion-industrial-revolution-desktop.webp', srcMobile: '/assets/history-archive/jrc-10-fusion-industrial-revolution-mobile.webp', alt: 'Dokumentasi JRC X bertema FUSION', caption: 'Dokumentasi JRC X bertema FUSION' },
  },
  {
    numeral: 'XI', year: 2023, theme: 'SWASA — Spectacular of Pewayangan Indonesia', eyebrow: 'JRC XI · 2023',
    title: 'SWASA — Spectacular of Pewayangan Indonesia',
    copy: 'JRC kembali melalui SWASA, memadukan perlombaan robot dan kekayaan budaya pewayangan Indonesia.',
    image: { src: '/assets/history-archive/jrc-11-swasa-pewayangan-desktop.webp', srcMobile: '/assets/history-archive/jrc-11-swasa-pewayangan-mobile.webp', alt: 'Dokumentasi JRC XI bertema SWASA', caption: 'Dokumentasi JRC XI bertema SWASA' },
  },
  {
    numeral: 'XII', year: 2024, theme: 'Ranger — Robot Antargalaksi Menjelajahi Negeri Baru', eyebrow: 'JRC XII · 2024',
    title: 'Ranger — Robot Antargalaksi Menjelajahi Negeri Baru',
    copy: 'Tema Ranger membawa imajinasi penjelajahan antargalaksi melalui divisi Rescuers, Puzzlaris, Gauntlet, dan Wormhole.',
    image: { src: '/assets/history-archive/jrc-12-ranger-antargalaksi-desktop.webp', srcMobile: '/assets/history-archive/jrc-12-ranger-antargalaksi-mobile.webp', alt: 'Dokumentasi JRC XII bertema Ranger', caption: 'Dokumentasi JRC XII bertema Ranger' },
  },
  {
    numeral: 'XIII', year: 2025, theme: 'TECHNOCARNIVAL', eyebrow: 'JRC XIII · 2025',
    title: 'TECHNOCARNIVAL',
    copy: 'Pacu Robotmu, Tunjukkan Atraksimu menjadi semangat JRC XIII: kompetisi robotika dalam suasana karnaval teknologi.',
    image: { src: '/assets/history-archive/jrc-13-technocarnival-desktop.webp', srcMobile: '/assets/history-archive/jrc-13-technocarnival-mobile.webp', alt: 'Dokumentasi JRC XIII tahun 2025', caption: 'Dokumentasi JRC XIII tahun 2025' },
  },
  {
    numeral: 'XIV', year: 2026, theme: 'Imperium Machina', eyebrow: 'JRC XIV · 2026',
    title: 'Imperium Machina',
    copy: 'Edisi terkini mempertemukan enam kategori robotika dalam identitas arena Romawi bertema Imperium Machina.',
    image: { src: '/assets/history-archive/jrc-14-imperium-machina-artwork-desktop.webp', srcMobile: '/assets/history-archive/jrc-14-imperium-machina-artwork-mobile.webp', alt: 'Artwork Imperium Machina untuk JRC XIV', caption: 'Identitas visual JRC XIV · 2026' },
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
    answer: 'Pendaftaran JRC XIV dibuka pada 30 September 2026 pukul 08.00 WIB dan ditutup pada 21 November 2026 pukul 23.59 WIB.',
  },
  {
    question: 'Apa saja kategori resmi JRC XIV?',
    answer:
      'JRC XIV memiliki enam kategori resmi: Castra Guardian, Robo Chiper, Aquaduct Romana, Charion Line, Colosseum Clash, dan Harpastum Arena.',
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
    answer: 'Hubungi narahubung sesuai kategori:',
    contacts: competitions.map(({ name: category, contact: { name, phone } }) => ({
      category,
      name,
      phone,
    })),
  },
] as const;

export function findCompetition(slug: string | undefined) {
  return competitions.find((competition) => competition.slug === slug);
}
