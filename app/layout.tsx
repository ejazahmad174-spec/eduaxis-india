
export const metadata: Metadata = {
  metadataBase: new URL('https://eduaxisindia.com'),

  title: {
    default: 'EduAxis India | Learn. Prepare. Progress.',
    template: '%s | EduAxis India',
  },

  description:
    'EduAxis India is an educational platform offering quality study materials, competitive exam preparation, online courses, mock tests, career guidance and government job updates.',

  keywords: [
    'EduAxis India',
    'online education India',
    'competitive exam preparation',
    'study materials',
    'government job updates',
    'mock tests',
    'online courses',
    'teacher exam preparation',
    'career guidance',
  ],

  authors: [{ name: 'EduAxis India' }],
  creator: 'EduAxis India',
  publisher: 'EduAxis India',

  alternates: {
    canonical: '/',
  },

  openGraph: {
    type: 'website',
    locale: 'en_IN',
    url: 'https://eduaxisindia.com',
    siteName: 'EduAxis India',
    title: 'EduAxis India | Learn. Prepare. Progress.',
    description:
      'Learn, prepare and progress with quality study materials, exam preparation, online courses and career updates.',
  },

  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
};
