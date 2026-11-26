export type MockTestSeriesGroup = "Commerce" | "Science" | "Language" | "Arts";

export type MockTestSeriesDefinition = {
  id: string;
  group: MockTestSeriesGroup;
  subject: string;
  examCategory: string;
  description: string;
  boardName: string;
  logoUrl: string;
  plannedTests: number;
  plannedFreeTests: number;
  plannedPaidTests: number;
};

export const BSEB_LOGO_URL =
  "https://img.collegedunia.com/public/college_data/images/logos/BSEB_LOGO.png";

export const BSEB_CLASS_XII_SERIES: MockTestSeriesDefinition[] = [
  {
    id: "bseb-xii-accountancy",
    group: "Commerce",
    subject: "Accountancy",
    examCategory: "BSEB Class XII - Commerce - Accountancy",
    description: "Accountancy practice for the Bihar Board Class XII Commerce examination.",
    boardName: "Bihar School Examination Board",
    logoUrl: BSEB_LOGO_URL,
    plannedTests: 11,
    plannedFreeTests: 1,
    plannedPaidTests: 10,
  },
  {
    id: "bseb-xii-business-studies",
    group: "Commerce",
    subject: "Business Studies",
    examCategory: "BSEB Class XII - Commerce - Business Studies",
    description: "Chapter-wise and full-length Business Studies practice for Class XII.",
    boardName: "Bihar School Examination Board",
    logoUrl: BSEB_LOGO_URL,
    plannedTests: 11,
    plannedFreeTests: 1,
    plannedPaidTests: 10,
  },
  {
    id: "bseb-xii-economics",
    group: "Commerce",
    subject: "Economics",
    examCategory: "BSEB Class XII - Commerce - Economics",
    description: "Economics practice covering the Class XII Bihar Board syllabus.",
    boardName: "Bihar School Examination Board",
    logoUrl: BSEB_LOGO_URL,
    plannedTests: 11,
    plannedFreeTests: 1,
    plannedPaidTests: 10,
  },
  {
    id: "bseb-xii-physics",
    group: "Science",
    subject: "Physics",
    examCategory: "BSEB Class XII - Science - Physics",
    description: "Physics practice for the Bihar Board Class XII Science examination.",
    boardName: "Bihar School Examination Board",
    logoUrl: BSEB_LOGO_URL,
    plannedTests: 11,
    plannedFreeTests: 1,
    plannedPaidTests: 10,
  },
  {
    id: "bseb-xii-chemistry",
    group: "Science",
    subject: "Chemistry",
    examCategory: "BSEB Class XII - Science - Chemistry",
    description: "Chemistry practice covering key concepts and the Class XII syllabus.",
    boardName: "Bihar School Examination Board",
    logoUrl: BSEB_LOGO_URL,
    plannedTests: 11,
    plannedFreeTests: 1,
    plannedPaidTests: 10,
  },
  {
    id: "bseb-xii-biology",
    group: "Science",
    subject: "Biology",
    examCategory: "BSEB Class XII - Science - Biology",
    description: "Biology practice for the Bihar Board Class XII Science examination.",
    boardName: "Bihar School Examination Board",
    logoUrl: BSEB_LOGO_URL,
    plannedTests: 11,
    plannedFreeTests: 1,
    plannedPaidTests: 10,
  },
  {
    id: "bseb-xii-hindi",
    group: "Language",
    subject: "Hindi",
    examCategory: "BSEB Class XII - Language - Hindi",
    description: "Hindi language and literature practice for the Class XII board examination.",
    boardName: "Bihar School Examination Board",
    logoUrl: BSEB_LOGO_URL,
    plannedTests: 11,
    plannedFreeTests: 1,
    plannedPaidTests: 10,
  },
  {
    id: "bseb-xii-urdu",
    group: "Language",
    subject: "Urdu",
    examCategory: "BSEB Class XII - Language - Urdu",
    description: "Urdu language and literature practice for the Class XII board examination.",
    boardName: "Bihar School Examination Board",
    logoUrl: BSEB_LOGO_URL,
    plannedTests: 11,
    plannedFreeTests: 1,
    plannedPaidTests: 10,
  },
  {
    id: "bseb-xii-english",
    group: "Language",
    subject: "English",
    examCategory: "BSEB Class XII - Language - English",
    description: "English language and literature practice for the Class XII board examination.",
    boardName: "Bihar School Examination Board",
    logoUrl: BSEB_LOGO_URL,
    plannedTests: 11,
    plannedFreeTests: 1,
    plannedPaidTests: 10,
  },
  {
    id: "bseb-xii-history",
    group: "Arts",
    subject: "History",
    examCategory: "BSEB Class XII - Arts - History",
    description: "History practice for the Bihar Board Class XII Arts examination.",
    boardName: "Bihar School Examination Board",
    logoUrl: BSEB_LOGO_URL,
    plannedTests: 11,
    plannedFreeTests: 1,
    plannedPaidTests: 10,
  },
  {
    id: "bseb-xii-geography",
    group: "Arts",
    subject: "Geography",
    examCategory: "BSEB Class XII - Arts - Geography",
    description: "Geography practice for the Bihar Board Class XII Arts examination.",
    boardName: "Bihar School Examination Board",
    logoUrl: BSEB_LOGO_URL,
    plannedTests: 11,
    plannedFreeTests: 1,
    plannedPaidTests: 10,
  },
  {
    id: "bseb-xii-political-science",
    group: "Arts",
    subject: "Political Science",
    examCategory: "BSEB Class XII - Arts - Political Science",
    description: "Political Science practice for the Bihar Board Class XII Arts examination.",
    boardName: "Bihar School Examination Board",
    logoUrl: BSEB_LOGO_URL,
    plannedTests: 11,
    plannedFreeTests: 1,
    plannedPaidTests: 10,
  },
];

export const MOCK_TEST_SERIES_GROUPS: {
  name: MockTestSeriesGroup;
  description: string;
}[] = [
  {
    name: "Commerce",
    description: "Class XII Commerce subject-wise test series.",
  },
  {
    name: "Science",
    description: "Class XII Science subject-wise test series.",
  },
  {
    name: "Language",
    description: "Class XII language and literature test series.",
  },
  {
    name: "Arts",
    description: "Class XII Arts subject-wise test series.",
  },
];

export const MOCK_TEST_SERIES_ADMIN_OPTIONS = [
  {
    value: "SLET - Library Science",
    label: "Bihar SLET - Library Science (existing series)",
  },
  ...BSEB_CLASS_XII_SERIES.map((series) => ({
    value: series.examCategory,
    label: series.group + " - " + series.subject + " (BSEB Class XII)",
  })),
];
