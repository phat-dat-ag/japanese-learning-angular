export const ADMIN_SECTIONS = [
  {
    path: 'vocabulary',
    label: 'Vocabulary Management',
    title: 'Vocabulary Management',
    description: 'A home for managing the Japanese vocabulary used in learning flashcards.',
  },
  {
    path: 'lessons',
    label: 'Lessons',
    title: 'Lesson Management',
    description: 'A home for organizing learning content into lessons and JLPT levels.',
  },
  {
    path: 'users',
    label: 'Users',
    title: 'User Management',
    description: 'A home for administering Japanese Learning accounts.',
  },
  {
    path: 'settings',
    label: 'Settings',
    title: 'Settings',
    description: 'A home for application administration preferences.',
  },
  {
    path: 'kanji-quiz/questions',
    label: 'Kanji Quiz Question Bank',
    title: 'Kanji Quiz Question Bank',
    description: 'A home for managing example-based and custom Kanji Quiz questions.',
  },
] as const;
