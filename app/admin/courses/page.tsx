'use client';

import { useEffect, useState, FormEvent, ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import '../admin.css';

type Course = {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  price: number | null;
  is_free: boolean | null;
  thumbnail_url: string | null;
  status: 'draft' | 'published';
  course_type: 'academic' | 'competitive' | 'skill';
  class_level: number | null;
  subject: string | null;
  created_at: string | null;
};

type BoardMapping = {
  id: string;
  course_id: string;
  board: 'BSEB' | 'CBSE';
  academic_session: string;
  is_active: boolean;
};

type CourseUnit = {
  id: string;
  board_mapping_id: string;
  title: string;
  description: string | null;
  sort_order: number;
};

type CourseChapter = {
  id: string;
  unit_id: string;
  title: string;
  description: string | null;
  sort_order: number;
};

type CourseLesson = {
  id: string;
  chapter_id: string;
  title: string;
  lesson_type: 'video' | 'text' | 'live';
  description: string | null;
  video_url: string | null;
  content: string | null;
  duration_minutes: number | null;
  is_free_preview: boolean;
  status: 'draft' | 'published';
  sort_order: number;
};

type CourseResource = {
  id: string;
  lesson_id: string;
  title: string;
  description: string | null;
  resource_type: 'pdf' | 'document' | 'worksheet' | 'assignment' | 'external_link';
  access_level: 'free' | 'paid';
  file_path: string | null;
  external_url: string | null;
  status: 'draft' | 'published';
  sort_order: number;
};

type FormState = {
  title: string;
  classLevel: string;
  subject: string;
  boards: string[];
  session: string;
  description: string;
  price: string;
  thumbnailUrl: string;
  status: 'draft' | 'published';
};

const emptyForm: FormState = {
  title: '',
  classLevel: '11',
  subject: 'Accountancy',
  boards: ['BSEB', 'CBSE'],
  session: '2026-27',
  description: '',
  price: '',
  thumbnailUrl: '',
  status: 'draft',
};

export default function AdminCoursesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [courses, setCourses] = useState<Course[]>([]);
  const [mappings, setMappings] = useState<BoardMapping[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [filter, setFilter] = useState('all');

  // Syllabus manager state
  const [selectedMappingId, setSelectedMappingId] = useState('');
  const [units, setUnits] = useState<CourseUnit[]>([]);
  const [selectedUnitId, setSelectedUnitId] = useState('');
  const [chapters, setChapters] = useState<CourseChapter[]>([]);
  const [selectedChapterId, setSelectedChapterId] = useState('');
  const [lessons, setLessons] = useState<CourseLesson[]>([]);
  const [lessonEditingId, setLessonEditingId] = useState<string | null>(null);
  const [lessonTitle, setLessonTitle] = useState('');
  const [lessonType, setLessonType] = useState<'video' | 'text' | 'live'>('video');
  const [lessonDescription, setLessonDescription] = useState('');
  const [lessonVideoUrl, setLessonVideoUrl] = useState('');
  const [lessonContent, setLessonContent] = useState('');
  const [lessonDuration, setLessonDuration] = useState('');
  const [lessonFreePreview, setLessonFreePreview] = useState(true);
  const [lessonStatus, setLessonStatus] = useState<'draft' | 'published'>('draft');
  const [lessonSaving, setLessonSaving] = useState(false);

  // Learning resources state
  const [selectedLessonId, setSelectedLessonId] = useState('');
  const [resources, setResources] = useState<CourseResource[]>([]);
  const [resourceEditingId, setResourceEditingId] = useState<string | null>(null);
  const [resourceTitle, setResourceTitle] = useState('');
  const [resourceDescription, setResourceDescription] = useState('');
  const [resourceType, setResourceType] = useState<CourseResource['resource_type']>('pdf');
  const [resourceAccess, setResourceAccess] = useState<'free' | 'paid'>('free');
  const [resourceFilePath, setResourceFilePath] = useState('');
  const [resourceExternalUrl, setResourceExternalUrl] = useState('');
  const [resourceStatus, setResourceStatus] = useState<'draft' | 'published'>('draft');
  const [resourceSaving, setResourceSaving] = useState(false);
  const [resourceUploading, setResourceUploading] = useState(false);
  const [unitTitle, setUnitTitle] = useState('');
  const [chapterTitle, setChapterTitle] = useState('');
  const [syllabusLoading, setSyllabusLoading] = useState(false);
  const [syllabusSaving, setSyllabusSaving] = useState(false);

  useEffect(() => {
    let active = true;

    async function initialise() {
      const client = supabase;
      if (!client) {
        router.replace('/admin/login');
        return;
      }

      const { data: { user }, error: authError } = await client.auth.getUser();
      if (authError || !user) {
        router.replace('/admin/login');
        return;
      }

      const { data: profile, error: profileError } = await client
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();

      if (profileError || profile?.role !== 'admin') {
        await client.auth.signOut();
        router.replace('/admin/login');
        return;
      }

      await loadData(active);
    }

    async function loadData(isActive: boolean) {
      const client = supabase;
      if (!client) return;

      const [courseResult, mappingResult] = await Promise.all([
        client.from('courses').select('*').order('created_at', { ascending: false }),
        client.from('course_board_mappings').select('*'),
      ]);

      if (!isActive) return;
      if (courseResult.error) {
        setErrorMessage(`Could not load courses: ${courseResult.error.message}`);
      } else {
        setCourses((courseResult.data || []) as Course[]);
      }
      if (mappingResult.error) {
        setErrorMessage((current) => current || `Could not load board mappings: ${mappingResult.error.message}`);
      } else {
        setMappings((mappingResult.data || []) as BoardMapping[]);
      }
      setLoading(false);
    }

    initialise();
    return () => { active = false; };
  }, [router]);

  useEffect(() => {
    if (!selectedMappingId && mappings.length > 0) {
      const firstActive = mappings.find((item) => item.is_active);
      if (firstActive) setSelectedMappingId(firstActive.id);
    }
  }, [mappings, selectedMappingId]);

  useEffect(() => {
    let active = true;

    async function loadUnits() {
      if (!supabase || !selectedMappingId) {
        setUnits([]);
        setSelectedUnitId('');
        setChapters([]);
        return;
      }

      setSyllabusLoading(true);
      const { data, error } = await supabase
        .from('course_units')
        .select('*')
        .eq('board_mapping_id', selectedMappingId)
        .order('sort_order', { ascending: true });

      if (!active) return;

      if (error) {
        setErrorMessage(`Could not load syllabus units: ${error.message}`);
        setUnits([]);
      } else {
        const rows = (data || []) as CourseUnit[];
        setUnits(rows);
        setSelectedUnitId((current) =>
          rows.some((unit) => unit.id === current) ? current : (rows[0]?.id || '')
        );
      }
      setSyllabusLoading(false);
    }

    loadUnits();
    return () => { active = false; };
  }, [selectedMappingId]);

  useEffect(() => {
    let active = true;

    async function loadChapters() {
      if (!supabase || !selectedUnitId) {
        setChapters([]);
        setSelectedChapterId('');
        return;
      }

      const { data, error } = await supabase
        .from('course_chapters')
        .select('*')
        .eq('unit_id', selectedUnitId)
        .order('sort_order', { ascending: true });

      if (!active) return;

      if (error) {
        setErrorMessage(`Could not load chapters: ${error.message}`);
        setChapters([]);
      } else {
        setChapters((data || []) as CourseChapter[]);
      }
    }

    loadChapters();
    return () => { active = false; };
  }, [selectedUnitId]);

  useEffect(() => {
    if (!selectedChapterId && chapters.length > 0) {
      setSelectedChapterId(chapters[0].id);
    } else if (selectedChapterId && !chapters.some((chapter) => chapter.id === selectedChapterId)) {
      setSelectedChapterId(chapters[0]?.id || '');
    }
  }, [chapters, selectedChapterId]);

  useEffect(() => {
    let active = true;
    async function loadLessons() {
      if (!supabase || !selectedChapterId) {
        setLessons([]);
        return;
      }
      const { data, error } = await supabase
        .from('course_lessons')
        .select('*')
        .eq('chapter_id', selectedChapterId)
        .order('sort_order', { ascending: true });
      if (!active) return;
      if (error) {
        setErrorMessage(`Could not load lessons: ${error.message}`);
        setLessons([]);
      } else {
        setLessons((data || []) as CourseLesson[]);
      }
    }
    loadLessons();
    return () => { active = false; };
  }, [selectedChapterId]);

  useEffect(() => {
    if (!selectedLessonId && lessons.length > 0) {
      setSelectedLessonId(lessons[0].id);
    } else if (selectedLessonId && !lessons.some((lesson) => lesson.id === selectedLessonId)) {
      setSelectedLessonId(lessons[0]?.id || '');
    }
  }, [lessons, selectedLessonId]);

  useEffect(() => {
    let active = true;
    async function loadResources() {
      if (!supabase || !selectedLessonId) {
        setResources([]);
        return;
      }
      const { data, error } = await supabase
        .from('course_resources')
        .select('*')
        .eq('lesson_id', selectedLessonId)
        .order('sort_order', { ascending: true });
      if (!active) return;
      if (error) {
        setErrorMessage(`Could not load learning resources: ${error.message}`);
        setResources([]);
      } else {
        setResources((data || []) as CourseResource[]);
      }
    }
    loadResources();
    return () => { active = false; };
  }, [selectedLessonId]);

  function resetResourceForm() {
    setResourceEditingId(null);
    setResourceTitle('');
    setResourceDescription('');
    setResourceType('pdf');
    setResourceAccess('free');
    setResourceFilePath('');
    setResourceExternalUrl('');
    setResourceStatus('draft');
  }

  function editResource(resource: CourseResource) {
    setResourceEditingId(resource.id);
    setResourceTitle(resource.title);
    setResourceDescription(resource.description || '');
    setResourceType(resource.resource_type);
    setResourceAccess(resource.access_level);
    setResourceFilePath(resource.file_path || '');
    setResourceExternalUrl(resource.external_url || '');
    setResourceStatus(resource.status);
    setNotice('Editing learning resource. Save your changes when ready.');
  }

  async function uploadCourseResource(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !supabase || !selectedLessonId) return;

    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setErrorMessage('Please choose a PDF file.');
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setErrorMessage('The PDF must be 20 MB or smaller.');
      return;
    }

    const activeMapping = mappings.find((item) => item.id === selectedMappingId);
    if (!activeMapping) {
      setErrorMessage('Select a course and board mapping before uploading a file.');
      return;
    }

    setResourceUploading(true);
    setErrorMessage('');
    setNotice('');
    const safeName = file.name
      .normalize('NFKD')
      .replace(/[^a-zA-Z0-9._-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || 'course-resource.pdf';
    const filePath = `${activeMapping.course_id}/${crypto.randomUUID()}-${safeName}`;

    const { error } = await supabase.storage
      .from('course-resources')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: 'application/pdf',
      });

    if (error) {
      setErrorMessage(`Could not upload PDF: ${error.message}`);
    } else {
      setResourceFilePath(filePath);
      setResourceAccess('paid');
      if (resourceType === 'external_link') setResourceType('pdf');
      setNotice('PDF uploaded to private course storage. Access level has been set to Paid.');
    }
    setResourceUploading(false);
  }

  async function saveResource(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !selectedLessonId || !resourceTitle.trim()) return;
    if (resourceType === 'external_link' && !resourceExternalUrl.trim()) {
      setErrorMessage('Please enter the external resource URL.');
      return;
    }
    if (resourceType !== 'external_link' && !resourceFilePath.trim()) {
      setErrorMessage('Please enter the private storage file path for this resource.');
      return;
    }
    if (resourceExternalUrl.trim() && !/^https?:\/\//i.test(resourceExternalUrl.trim())) {
      setErrorMessage('External URL must begin with https:// or http://.');
      return;
    }
    setResourceSaving(true);
    setErrorMessage('');
    setNotice('');
    const payload = {
      lesson_id: selectedLessonId,
      title: resourceTitle.trim(),
      description: resourceDescription.trim() || null,
      resource_type: resourceType,
      access_level: resourceAccess,
      file_path: resourceType === 'external_link' ? null : (resourceFilePath.trim() || null),
      external_url: resourceType === 'external_link' ? resourceExternalUrl.trim() : (resourceExternalUrl.trim() || null),
      status: resourceStatus,
      sort_order: resourceEditingId
        ? (resources.find((item) => item.id === resourceEditingId)?.sort_order ?? resources.length + 1)
        : resources.length + 1,
    };
    const result = resourceEditingId
      ? await supabase.from('course_resources').update(payload).eq('id', resourceEditingId).select('*').single()
      : await supabase.from('course_resources').insert(payload).select('*').single();
    if (result.error) {
      setErrorMessage(`Could not save resource: ${result.error.message}`);
    } else if (result.data) {
      if (resourceEditingId) {
        const previousResource = resources.find((item) => item.id === resourceEditingId);
        if (previousResource?.file_path && previousResource.file_path !== payload.file_path) {
          await supabase.storage.from('course-resources').remove([previousResource.file_path]);
        }
        setResources((current) => current.map((item) => item.id === resourceEditingId ? result.data as CourseResource : item));
        setNotice('Learning resource updated successfully.');
      } else {
        setResources((current) => [...current, result.data as CourseResource]);
        setNotice('Learning resource added successfully.');
      }
      resetResourceForm();
    }
    setResourceSaving(false);
  }

  async function deleteResource(resource: CourseResource) {
    if (!supabase || !window.confirm(`Delete resource "${resource.title}"?`)) return;
    const { error } = await supabase.from('course_resources').delete().eq('id', resource.id);
    if (error) {
      setErrorMessage(`Could not delete resource: ${error.message}`);
      return;
    }
    if (resource.file_path) {
      const { error: storageError } = await supabase.storage.from('course-resources').remove([resource.file_path]);
      if (storageError) setErrorMessage(`Resource record deleted, but its stored file could not be removed: ${storageError.message}`);
    }
    setResources((current) => current.filter((item) => item.id !== resource.id));
    if (resourceEditingId === resource.id) resetResourceForm();
    setNotice('Learning resource deleted.');
  }

  function resetLessonForm() {
    setLessonEditingId(null);
    setLessonTitle('');
    setLessonType('video');
    setLessonDescription('');
    setLessonVideoUrl('');
    setLessonContent('');
    setLessonDuration('');
    setLessonFreePreview(true);
    setLessonStatus('draft');
  }

  function editLesson(lesson: CourseLesson) {
    setLessonEditingId(lesson.id);
    setLessonTitle(lesson.title);
    setLessonType(lesson.lesson_type);
    setLessonDescription(lesson.description || '');
    setLessonVideoUrl(lesson.video_url || '');
    setLessonContent(lesson.content || '');
    setLessonDuration(lesson.duration_minutes == null ? '' : String(lesson.duration_minutes));
    setLessonFreePreview(lesson.is_free_preview);
    setLessonStatus(lesson.status);
    setNotice('Editing lesson. Save your changes when ready.');
  }

  async function saveLesson(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !selectedChapterId || !lessonTitle.trim()) return;
    if (lessonType === 'video' && !lessonVideoUrl.trim()) {
      setErrorMessage('Please enter the video URL for this video lesson.');
      return;
    }
    if (lessonType === 'text' && !lessonContent.trim()) {
      setErrorMessage('Please enter the lesson content for this text lesson.');
      return;
    }
    const duration = lessonDuration.trim() ? Number(lessonDuration) : null;
    if (duration !== null && (!Number.isInteger(duration) || duration < 1)) {
      setErrorMessage('Duration must be a whole number of minutes greater than zero.');
      return;
    }
    setLessonSaving(true);
    setErrorMessage('');
    setNotice('');
    const payload = {
      chapter_id: selectedChapterId,
      title: lessonTitle.trim(),
      lesson_type: lessonType,
      description: lessonDescription.trim() || null,
      video_url: lessonType === 'video' || lessonType === 'live' ? (lessonVideoUrl.trim() || null) : null,
      content: lessonType === 'text' ? (lessonContent.trim() || null) : null,
      duration_minutes: duration,
      is_free_preview: lessonFreePreview,
      status: lessonStatus,
      sort_order: lessonEditingId
        ? (lessons.find((item) => item.id === lessonEditingId)?.sort_order ?? lessons.length + 1)
        : lessons.length + 1,
    };
    const result = lessonEditingId
      ? await supabase.from('course_lessons').update(payload).eq('id', lessonEditingId).select('*').single()
      : await supabase.from('course_lessons').insert(payload).select('*').single();
    if (result.error) {
      setErrorMessage(`Could not save lesson: ${result.error.message}`);
    } else if (result.data) {
      if (lessonEditingId) {
        setLessons((current) => current.map((item) => item.id === lessonEditingId ? result.data as CourseLesson : item));
        setNotice('Lesson updated successfully.');
      } else {
        setLessons((current) => [...current, result.data as CourseLesson]);
        setNotice('Lesson added successfully.');
      }
      resetLessonForm();
    }
    setLessonSaving(false);
  }

  async function deleteLesson(lesson: CourseLesson) {
    if (!supabase || !window.confirm(`Delete lesson "${lesson.title}"?`)) return;
    const { error } = await supabase.from('course_lessons').delete().eq('id', lesson.id);
    if (error) {
      setErrorMessage(`Could not delete lesson: ${error.message}`);
      return;
    }
    setLessons((current) => current.filter((item) => item.id !== lesson.id));
    if (lessonEditingId === lesson.id) resetLessonForm();
    setNotice('Lesson deleted.');
  }

  async function addUnit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !selectedMappingId || !unitTitle.trim()) return;

    setSyllabusSaving(true);
    setErrorMessage('');
    const { data, error } = await supabase
      .from('course_units')
      .insert({
        board_mapping_id: selectedMappingId,
        title: unitTitle.trim(),
        sort_order: units.length + 1,
      })
      .select('*')
      .single();

    if (error) {
      setErrorMessage(`Could not add unit: ${error.message}`);
    } else if (data) {
      setUnits((current) => [...current, data as CourseUnit]);
      setSelectedUnitId(data.id);
      setUnitTitle('');
      setNotice('Syllabus unit added successfully.');
    }
    setSyllabusSaving(false);
  }

  async function addChapter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !selectedUnitId || !chapterTitle.trim()) return;

    setSyllabusSaving(true);
    setErrorMessage('');
    const { data, error } = await supabase
      .from('course_chapters')
      .insert({
        unit_id: selectedUnitId,
        title: chapterTitle.trim(),
        sort_order: chapters.length + 1,
      })
      .select('*')
      .single();

    if (error) {
      setErrorMessage(`Could not add chapter: ${error.message}`);
    } else if (data) {
      setChapters((current) => [...current, data as CourseChapter]);
      setChapterTitle('');
      setNotice('Chapter added successfully.');
    }
    setSyllabusSaving(false);
  }

  async function renameUnit(unit: CourseUnit) {
    if (!supabase) return;
    const nextTitle = window.prompt('Enter the new unit title:', unit.title);
    if (!nextTitle?.trim() || nextTitle.trim() === unit.title) return;

    const { error } = await supabase
      .from('course_units')
      .update({ title: nextTitle.trim() })
      .eq('id', unit.id);

    if (error) setErrorMessage(`Could not update unit: ${error.message}`);
    else setUnits((current) => current.map((item) =>
      item.id === unit.id ? { ...item, title: nextTitle.trim() } : item
    ));
  }

  async function removeUnit(unit: CourseUnit) {
    if (!supabase) return;
    if (!window.confirm(`Delete "${unit.title}" and all its chapters and lessons?`)) return;

    const { error } = await supabase.from('course_units').delete().eq('id', unit.id);
    if (error) {
      setErrorMessage(`Could not delete unit: ${error.message}`);
      return;
    }
    setUnits((current) => current.filter((item) => item.id !== unit.id));
    if (selectedUnitId === unit.id) {
      setSelectedUnitId('');
      setChapters([]);
    }
    setNotice('Unit deleted.');
  }

  async function renameChapter(chapter: CourseChapter) {
    if (!supabase) return;
    const nextTitle = window.prompt('Enter the new chapter title:', chapter.title);
    if (!nextTitle?.trim() || nextTitle.trim() === chapter.title) return;

    const { error } = await supabase
      .from('course_chapters')
      .update({ title: nextTitle.trim() })
      .eq('id', chapter.id);

    if (error) setErrorMessage(`Could not update chapter: ${error.message}`);
    else setChapters((current) => current.map((item) =>
      item.id === chapter.id ? { ...item, title: nextTitle.trim() } : item
    ));
  }

  async function removeChapter(chapter: CourseChapter) {
    if (!supabase) return;
    if (!window.confirm(`Delete "${chapter.title}" and its lessons?`)) return;

    const { error } = await supabase.from('course_chapters').delete().eq('id', chapter.id);
    if (error) {
      setErrorMessage(`Could not delete chapter: ${error.message}`);
      return;
    }
    setChapters((current) => current.filter((item) => item.id !== chapter.id));
    setNotice('Chapter deleted.');
  }

  function updateForm<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function toggleBoard(board: string) {
    setForm((current) => ({
      ...current,
      boards: current.boards.includes(board)
        ? current.boards.filter((item) => item !== board)
        : [...current.boards, board],
    }));
  }

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
    setErrorMessage('');
  }

  function startEdit(course: Course) {
    const courseBoards = mappings
      .filter((mapping) => mapping.course_id === course.id && mapping.is_active)
      .map((mapping) => mapping.board);

    setEditingId(course.id);
    setForm({
      title: course.title || '',
      classLevel: String(course.class_level || 11),
      subject: course.subject || 'Accountancy',
      boards: courseBoards,
      session: mappings.find((mapping) => mapping.course_id === course.id)?.academic_session || '2026-27',
      description: course.description || '',
      price: course.price === null ? '' : String(course.price),
      thumbnailUrl: course.thumbnail_url || '',
      status: course.status || 'draft',
    });
    setNotice('Editing course. Make your changes and save.');
    setErrorMessage('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function saveCourse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice('');
    setErrorMessage('');

    if (!supabase) {
      setErrorMessage('The database connection is unavailable.');
      return;
    }
    if (!form.title.trim()) {
      setErrorMessage('Please enter a course title.');
      return;
    }
    if (form.boards.length === 0) {
      setErrorMessage('Please select at least one board.');
      return;
    }
    if (form.price.trim() === '' || Number.isNaN(Number(form.price)) || Number(form.price) < 0) {
      setErrorMessage('Please enter a valid course price.');
      return;
    }

    setSaving(true);
    const client = supabase;
    const coursePayload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      category: 'Commerce',
      price: Number(form.price),
      is_free: false,
      thumbnail_url: form.thumbnailUrl.trim() || null,
      status: form.status,
      course_type: 'academic',
      class_level: Number(form.classLevel),
      subject: form.subject,
    };

    let courseId = editingId;
    let courseError: { message: string } | null = null;

    if (editingId) {
      const result = await client.from('courses').update(coursePayload).eq('id', editingId);
      courseError = result.error;
    } else {
      const result = await client.from('courses').insert(coursePayload).select('id').single();
      courseError = result.error;
      if (!result.error && result.data) courseId = result.data.id;
    }

    if (courseError || !courseId) {
      setErrorMessage(courseError?.message || 'The course could not be saved.');
      setSaving(false);
      return;
    }

    const existingMappings = mappings.filter((mapping) => mapping.course_id === courseId);
    const mappingRows = form.boards.map((board) => ({
      course_id: courseId,
      board,
      academic_session: form.session,
      is_active: true,
    }));

    const { error: mappingError } = await client
      .from('course_board_mappings')
      .upsert(mappingRows, { onConflict: 'course_id,board,academic_session' });

    if (mappingError) {
      setErrorMessage(`The course was saved, but its board mapping could not be saved: ${mappingError.message}`);
      setSaving(false);
      await refreshData();
      return;
    }

    const mappingsToDeactivate = existingMappings.filter(
      (mapping) => !form.boards.includes(mapping.board) || mapping.academic_session !== form.session
    );
    for (const mapping of mappingsToDeactivate) {
      await client.from('course_board_mappings').update({ is_active: false }).eq('id', mapping.id);
    }

    setNotice(editingId ? 'Course updated successfully.' : 'Course created successfully.');
    resetForm();
    await refreshData();
    setSaving(false);
  }

  async function refreshData() {
    if (!supabase) return;
    const [courseResult, mappingResult] = await Promise.all([
      supabase.from('courses').select('*').order('created_at', { ascending: false }),
      supabase.from('course_board_mappings').select('*'),
    ]);
    if (!courseResult.error) setCourses((courseResult.data || []) as Course[]);
    if (!mappingResult.error) setMappings((mappingResult.data || []) as BoardMapping[]);
  }

  async function deleteCourse(course: Course) {
    if (!supabase) return;
    const confirmed = window.confirm(`Delete "${course.title}"? Its syllabus units, chapters and lessons will also be deleted.`);
    if (!confirmed) return;

    const { error } = await supabase.from('courses').delete().eq('id', course.id);
    if (error) {
      setErrorMessage(`Could not delete course: ${error.message}`);
      return;
    }
    if (editingId === course.id) resetForm();
    setNotice('Course deleted successfully.');
    setErrorMessage('');
    await refreshData();
  }

  async function signOut() {
    if (supabase) await supabase.auth.signOut();
    router.replace('/admin/login');
    router.refresh();
  }

  const visibleCourses = courses.filter((course) => {
    if (filter === 'all') return true;
    return course.status === filter;
  });

  if (loading) {
    return <main className="admin-loading">Checking administrator access...</main>;
  }

  return (
    <main className="admin-shell">
      <aside className="admin-sidebar">
        <a href="/" className="admin-brand">
          <span className="admin-brand-mark">E</span>
          <span>EduAxis <b>India</b><small>ADMINISTRATION</small></span>
        </a>
        <div className="admin-side-label">WORKSPACE</div>
        <Link className="admin-side-link" href="/admin/dashboard">▦ &nbsp; Dashboard</Link>
        <div className="admin-side-label">CONTENT MANAGEMENT</div>
        <Link className="admin-side-link" href="/admin/study-materials">▤ &nbsp; Study Materials</Link>
        <div className="admin-side-link muted">▤ &nbsp; Government Jobs<small>Coming next</small></div>
        <Link className="admin-side-link active" href="/admin/courses">🎓 &nbsp; Online Courses</Link>
        <Link className="admin-side-link" href="/admin/mock-tests">▤ &nbsp; Mock Tests</Link>
        <div className="admin-side-link muted">▤ &nbsp; Education News<small>Coming next</small></div>
        <div className="admin-side-label">BLOG MANAGEMENT</div>
        <Link className="admin-side-link" href="/admin/author-management">✍️ &nbsp; Author Management</Link>
        <Link className="admin-side-link" href="/admin/blogs">▤ &nbsp; Blog Management</Link>
        <div className="admin-sidebar-bottom"><a href="/">← View public website</a></div>
      </aside>

      <section className="admin-main">
        <header className="admin-topbar">
          <div>
            <div className="admin-kicker">EDUAXIS INDIA / ADMIN</div>
            <h1>Course Management</h1>
          </div>
          <div className="admin-user">
            <span className="admin-avatar">A</span>
            <span><b>Administrator</b><small>Commerce Academy</small></span>
            <button onClick={signOut} className="admin-logout">Sign out</button>
          </div>
        </header>

        <div className="admin-welcome">
          <div>
            <h2>Manage Commerce Academy</h2>
            <p>Create Class 11 and 12 Commerce courses for BSEB and CBSE.</p>
          </div>
          <span className="admin-secure">✓ Secure admin area</span>
        </div>

        {notice && <div className="admin-notice">{notice}</div>}
        {errorMessage && <div className="admin-notice" style={{ borderLeft: '4px solid #c0392b' }}>{errorMessage}</div>}

        <section style={panelStyle}>
          <div style={sectionHeadingStyle}>
            <div>
              <div className="admin-kicker">COURSE BUILDER</div>
              <h2 style={{ margin: '5px 0 0', color: '#102b46' }}>{editingId ? 'Edit course' : 'Create a new course'}</h2>
            </div>
            {editingId && <button type="button" onClick={resetForm} style={secondaryButtonStyle}>Cancel editing</button>}
          </div>

          <form onSubmit={saveCourse}>
            <div style={formGridStyle}>
              <label style={labelStyle}>
                Course title *
                <input style={inputStyle} value={form.title} onChange={(e) => updateForm('title', e.target.value)} placeholder="e.g. Class 11 Accountancy – Complete Course" required />
              </label>
              <label style={labelStyle}>
                Class *
                <select style={inputStyle} value={form.classLevel} onChange={(e) => updateForm('classLevel', e.target.value)}>
                  <option value="11">Class 11</option>
                  <option value="12">Class 12</option>
                </select>
              </label>
              <label style={labelStyle}>
                Subject *
                <select style={inputStyle} value={form.subject} onChange={(e) => updateForm('subject', e.target.value)}>
                  <option>Accountancy</option>
                  <option>Business Studies</option>
                  <option>Economics</option>
                  <option>Entrepreneurship</option>
                </select>
              </label>
              <label style={labelStyle}>
                Academic session *
                <select style={inputStyle} value={form.session} onChange={(e) => updateForm('session', e.target.value)}>
                  <option value="2026-27">2026–27</option>
                  <option value="2027-28">2027–28</option>
                </select>
              </label>
              <label style={labelStyle}>
                Course price (₹) *
                <input style={inputStyle} type="number" min="0" step="1" value={form.price} onChange={(e) => updateForm('price', e.target.value)} placeholder="e.g. 999" required />
              </label>
              <label style={labelStyle}>
                Course status *
                <select style={inputStyle} value={form.status} onChange={(e) => updateForm('status', e.target.value as 'draft' | 'published')}>
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                </select>
              </label>
              <label style={{ ...labelStyle, gridColumn: '1 / -1' }}>
                Course thumbnail URL (optional)
                <input style={inputStyle} type="url" value={form.thumbnailUrl} onChange={(e) => updateForm('thumbnailUrl', e.target.value)} placeholder="https://..." />
              </label>
              <label style={{ ...labelStyle, gridColumn: '1 / -1' }}>
                Course description
                <textarea style={{ ...inputStyle, minHeight: 100, resize: 'vertical' }} value={form.description} onChange={(e) => updateForm('description', e.target.value)} placeholder="Describe what students will learn in this course." />
              </label>
            </div>

            <div style={{ marginTop: 20 }}>
              <div style={{ ...labelStyle, marginBottom: 10 }}>Available boards *</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                {['BSEB', 'CBSE'].map((board) => (
                  <label key={board} style={boardChoiceStyle}>
                    <input type="checkbox" checked={form.boards.includes(board)} onChange={() => toggleBoard(board)} />
                    <span><b>{board}</b> {board === 'BSEB' ? 'Bihar Board' : 'Central Board'}</span>
                  </label>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 24 }}>
              <button type="submit" disabled={saving} style={primaryButtonStyle}>
                {saving ? 'Saving...' : editingId ? 'Update course' : 'Create course'}
              </button>
              <button type="button" onClick={resetForm} style={secondaryButtonStyle}>Clear form</button>
            </div>
          </form>
        </section>

        <section style={{ ...panelStyle, marginTop: 24 }}>
          <div style={sectionHeadingStyle}>
            <div>
              <div className="admin-kicker">COURSE LIBRARY</div>
              <h2 style={{ margin: '5px 0 0', color: '#102b46' }}>Your courses ({courses.length})</h2>
            </div>
            <select aria-label="Filter courses" style={{ ...inputStyle, width: 'auto', minWidth: 145 }} value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="all">All courses</option>
              <option value="draft">Drafts</option>
              <option value="published">Published</option>
            </select>
          </div>

          {visibleCourses.length === 0 ? (
            <div style={emptyStyle}>No courses found. Create your first Commerce course above.</div>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {visibleCourses.map((course) => {
                const courseBoards = mappings
                  .filter((mapping) => mapping.course_id === course.id && mapping.is_active)
                  .map((mapping) => mapping.board);
                return (
                  <article key={course.id} style={courseCardStyle}>
                    <div style={{ flex: 1, minWidth: 220 }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, alignItems: 'center', marginBottom: 7 }}>
                        <span style={statusPill(course.status)}>{course.status.toUpperCase()}</span>
                        <span style={neutralPillStyle}>Class {course.class_level || '—'}</span>
                        <span style={neutralPillStyle}>{course.subject || 'Subject not set'}</span>
                      </div>
                      <h3 style={{ margin: '0 0 6px', color: '#102b46', fontSize: 17 }}>{course.title}</h3>
                      <p style={{ margin: 0, color: '#657789', fontSize: 13 }}>{course.description || 'No description added.'}</p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 10 }}>
                        {courseBoards.map((board) => <span key={board} style={neutralPillStyle}>{board}</span>)}
                        <span style={neutralPillStyle}>₹{Number(course.price || 0).toLocaleString('en-IN')}</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <button type="button" onClick={() => startEdit(course)} style={secondaryButtonStyle}>Edit</button>
                      <button type="button" onClick={() => deleteCourse(course)} style={deleteButtonStyle}>Delete</button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section style={{ ...panelStyle, marginTop: 24 }}>
          <div style={sectionHeadingStyle}>
            <div>
              <div className="admin-kicker">SYLLABUS BUILDER</div>
              <h2 style={{ margin: '5px 0 0', color: '#102b46' }}>Manage units and chapters</h2>
              <p style={{ margin: '7px 0 0', color: '#657789', fontSize: 13 }}>
                Build a separate syllabus structure for each board and academic session.
              </p>
            </div>
          </div>

          <label style={labelStyle}>
            Select course and board syllabus
            <select
              style={inputStyle}
              value={selectedMappingId}
              onChange={(e) => {
                setSelectedMappingId(e.target.value);
                setSelectedUnitId('');
                setChapters([]);
              }}
            >
              <option value="">Choose a course and board...</option>
              {mappings.filter((mapping) => mapping.is_active).map((mapping) => {
                const course = courses.find((item) => item.id === mapping.course_id);
                if (!course) return null;
                return (
                  <option key={mapping.id} value={mapping.id}>
                    {course.title} — {mapping.board} ({mapping.academic_session})
                  </option>
                );
              })}
            </select>
          </label>

          {!selectedMappingId ? (
            <div style={{ ...emptyStyle, marginTop: 16 }}>
              Create a course and activate at least one board mapping before adding syllabus units.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 18, marginTop: 20 }}>
              <div style={{ border: '1px solid #e2eaed', borderRadius: 11, padding: 16 }}>
                <h3 style={{ margin: '0 0 14px', color: '#102b46' }}>1. Syllabus units</h3>
                <form onSubmit={addUnit} style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                  <input
                    style={{ ...inputStyle, flex: 1, minWidth: 0 }}
                    value={unitTitle}
                    onChange={(e) => setUnitTitle(e.target.value)}
                    placeholder="e.g. Introduction to Accounting"
                    required
                  />
                  <button type="submit" disabled={syllabusSaving} style={primaryButtonStyle}>Add</button>
                </form>

                {syllabusLoading ? (
                  <p style={{ color: '#657789' }}>Loading units...</p>
                ) : units.length === 0 ? (
                  <div style={emptyStyle}>No units added yet.</div>
                ) : (
                  <div style={{ display: 'grid', gap: 8 }}>
                    {units.map((unit, index) => (
                      <div key={unit.id} style={{
                        display: 'flex', alignItems: 'center', gap: 7, padding: 10,
                        border: selectedUnitId === unit.id ? '1px solid #18a5a0' : '1px solid #e2eaed',
                        borderRadius: 8, background: selectedUnitId === unit.id ? '#f0fbfa' : '#fff',
                      }}>
                        <button
                          type="button"
                          onClick={() => setSelectedUnitId(unit.id)}
                          style={{ flex: 1, minWidth: 0, textAlign: 'left', border: 0, background: 'transparent', cursor: 'pointer', color: '#102b46', fontWeight: 700 }}
                        >
                          <span style={{ color: '#657789', marginRight: 6 }}>{index + 1}.</span>{unit.title}
                        </button>
                        <button type="button" onClick={() => renameUnit(unit)} style={smallActionStyle}>Edit</button>
                        <button type="button" onClick={() => removeUnit(unit)} style={smallDeleteStyle}>Delete</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ border: '1px solid #e2eaed', borderRadius: 11, padding: 16 }}>
                <h3 style={{ margin: '0 0 14px', color: '#102b46' }}>2. Chapters</h3>
                {!selectedUnitId ? (
                  <div style={emptyStyle}>Select a unit to manage its chapters.</div>
                ) : (
                  <>
                    <form onSubmit={addChapter} style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                      <input
                        style={{ ...inputStyle, flex: 1, minWidth: 0 }}
                        value={chapterTitle}
                        onChange={(e) => setChapterTitle(e.target.value)}
                        placeholder="Enter chapter title"
                        required
                      />
                      <button type="submit" disabled={syllabusSaving} style={primaryButtonStyle}>Add</button>
                    </form>

                    {chapters.length === 0 ? (
                      <div style={emptyStyle}>No chapters in this unit yet.</div>
                    ) : (
                      <div style={{ display: 'grid', gap: 8 }}>
                        {chapters.map((chapter, index) => (
                          <div key={chapter.id} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: 10, border: '1px solid #e2eaed', borderRadius: 8 }}>
                            <span style={{ color: '#657789', fontSize: 12 }}>{index + 1}.</span>
                            <span style={{ flex: 1, minWidth: 0, color: '#263b4d', fontSize: 13, fontWeight: 600 }}>{chapter.title}</span>
                            <button type="button" onClick={() => renameChapter(chapter)} style={smallActionStyle}>Edit</button>
                            <button type="button" onClick={() => removeChapter(chapter)} style={smallDeleteStyle}>Delete</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {selectedMappingId && (
            <div style={{ ...panelStyle, marginTop: 20, padding: 18 }}>
              <div style={sectionHeadingStyle}>
                <div>
                  <div className="admin-kicker">LESSON MANAGER</div>
                  <h3 style={{ margin: '5px 0 0', color: '#102b46' }}>Add lessons to a chapter</h3>
                  <p style={{ margin: '7px 0 0', color: '#657789', fontSize: 13 }}>
                    Create video, text or live lessons. Mark selected lessons as free previews to let students sample the course.
                  </p>
                </div>
              </div>

              <label style={{ ...labelStyle, maxWidth: 560, marginBottom: 18 }}>
                Select chapter
                <select
                  style={inputStyle}
                  value={selectedChapterId}
                  onChange={(e) => { setSelectedChapterId(e.target.value); setSelectedLessonId(''); resetLessonForm(); resetResourceForm(); }}
                >
                  <option value="">Choose a chapter...</option>
                  {chapters.map((chapter) => <option key={chapter.id} value={chapter.id}>{chapter.title}</option>)}
                </select>
              </label>

              {!selectedChapterId ? (
                <div style={emptyStyle}>Add a syllabus unit and chapter first. Then select the chapter here to manage its lessons.</div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
                  <form onSubmit={saveLesson} style={{ display: 'grid', gap: 13, border: '1px solid #e2eaed', borderRadius: 11, padding: 16 }}>
                    <h4 style={{ margin: 0, color: '#102b46' }}>{lessonEditingId ? 'Edit lesson' : 'Create a lesson'}</h4>
                    <label style={labelStyle}>Lesson title
                      <input style={inputStyle} value={lessonTitle} onChange={(e) => setLessonTitle(e.target.value)} placeholder="e.g. Introduction to Accounting" required />
                    </label>
                    <label style={labelStyle}>Lesson type
                      <select style={inputStyle} value={lessonType} onChange={(e) => setLessonType(e.target.value as 'video' | 'text' | 'live')}>
                        <option value="video">Video lesson</option>
                        <option value="text">Text lesson</option>
                        <option value="live">Live class</option>
                      </select>
                    </label>
                    <label style={labelStyle}>Short description
                      <textarea style={{ ...inputStyle, minHeight: 72, resize: 'vertical' }} value={lessonDescription} onChange={(e) => setLessonDescription(e.target.value)} placeholder="What will students learn?" />
                    </label>
                    {(lessonType === 'video' || lessonType === 'live') && (
                      <label style={labelStyle}>{lessonType === 'live' ? 'Live class / meeting URL' : 'Video URL'}
                        <input style={inputStyle} type="url" value={lessonVideoUrl} onChange={(e) => setLessonVideoUrl(e.target.value)} placeholder="https://..." required={lessonType === 'video'} />
                      </label>
                    )}
                    {lessonType === 'text' && (
                      <label style={labelStyle}>Lesson content
                        <textarea style={{ ...inputStyle, minHeight: 180, resize: 'vertical' }} value={lessonContent} onChange={(e) => setLessonContent(e.target.value)} placeholder="Write the lesson content here..." required />
                      </label>
                    )}
                    <label style={labelStyle}>Duration (minutes)
                      <input style={inputStyle} type="number" min="1" step="1" value={lessonDuration} onChange={(e) => setLessonDuration(e.target.value)} placeholder="Optional" />
                    </label>
                    <label style={{ ...labelStyle, flexDirection: 'row', alignItems: 'center', gap: 9 }}>
                      <input type="checkbox" checked={lessonFreePreview} onChange={(e) => setLessonFreePreview(e.target.checked)} />
                      Free preview (available without course purchase)
                    </label>
                    <label style={labelStyle}>Publication status
                      <select style={inputStyle} value={lessonStatus} onChange={(e) => setLessonStatus(e.target.value as 'draft' | 'published')}>
                        <option value="draft">Draft</option>
                        <option value="published">Published</option>
                      </select>
                    </label>
                    <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
                      <button type="submit" disabled={lessonSaving} style={primaryButtonStyle}>{lessonSaving ? 'Saving...' : lessonEditingId ? 'Update lesson' : 'Save lesson'}</button>
                      {lessonEditingId && <button type="button" onClick={resetLessonForm} style={secondaryButtonStyle}>Cancel edit</button>}
                    </div>
                    <p style={{ margin: 0, color: '#657789', fontSize: 11, lineHeight: 1.5 }}>
                      Note: this form stores the lesson URL and text. Paid lesson access must be protected by student purchase verification before paid courses are launched.
                    </p>
                  </form>

                  <div style={{ display: 'grid', alignContent: 'start', gap: 10 }}>
                    <h4 style={{ margin: 0, color: '#102b46' }}>Lessons in this chapter ({lessons.length})</h4>
                    {lessons.length === 0 ? (
                      <div style={emptyStyle}>No lessons added to this chapter yet.</div>
                    ) : lessons.map((lesson, index) => (
                      <article key={lesson.id} style={{ border: '1px solid #e2eaed', borderRadius: 9, padding: 13, display: 'grid', gap: 8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ color: '#102b46', fontWeight: 800, fontSize: 13 }}>{index + 1}. {lesson.title}</div>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 7 }}>
                              <span style={neutralPillStyle}>{lesson.lesson_type.toUpperCase()}</span>
                              <span style={statusPill(lesson.status)}>{lesson.status}</span>
                              <span style={neutralPillStyle}>{lesson.is_free_preview ? 'FREE PREVIEW' : 'PAID'}</span>
                              {lesson.duration_minutes ? <span style={neutralPillStyle}>{lesson.duration_minutes} min</span> : null}
                            </div>
                          </div>
                        </div>
                        {lesson.description && <p style={{ margin: 0, color: '#657789', fontSize: 12 }}>{lesson.description}</p>}
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button type="button" onClick={() => editLesson(lesson)} style={smallActionStyle}>Edit</button>
                          <button type="button" onClick={() => deleteLesson(lesson)} style={smallDeleteStyle}>Delete</button>
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ marginTop: 24, paddingTop: 22, borderTop: '1px solid #e2eaed' }}>
                <div style={{ marginBottom: 14 }}>
                  <div className="admin-kicker">LEARNING RESOURCES</div>
                  <h3 style={{ margin: '5px 0', color: '#102b46' }}>Manage notes, worksheets and assignments</h3>
                  <p style={{ margin: 0, color: '#657789', fontSize: 12, lineHeight: 1.6 }}>
                    Add resources to a lesson. Free resources can be shown to everyone; paid resources must remain in private storage until secure student access is enabled.
                  </p>
                </div>
                <label style={{ ...labelStyle, maxWidth: 560, marginBottom: 18 }}>
                  Select lesson
                  <select style={inputStyle} value={selectedLessonId} onChange={(e) => { setSelectedLessonId(e.target.value); resetResourceForm(); }}>
                    <option value="">Choose a lesson...</option>
                    {lessons.map((lesson) => <option key={lesson.id} value={lesson.id}>{lesson.title}</option>)}
                  </select>
                </label>
                {!selectedLessonId ? (
                  <div style={emptyStyle}>Create a lesson first, then select it to add its learning resources.</div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
                    <form onSubmit={saveResource} style={{ display: 'grid', gap: 12, border: '1px solid #e2eaed', borderRadius: 11, padding: 16 }}>
                      <h4 style={{ margin: 0, color: '#102b46' }}>{resourceEditingId ? 'Edit resource' : 'Add a learning resource'}</h4>
                      <label style={labelStyle}>Resource title
                        <input style={inputStyle} value={resourceTitle} onChange={(e) => setResourceTitle(e.target.value)} placeholder="e.g. Chapter 1 PDF Notes" required />
                      </label>
                      <label style={labelStyle}>Resource type
                        <select style={inputStyle} value={resourceType} onChange={(e) => setResourceType(e.target.value as CourseResource['resource_type'])}>
                          <option value="pdf">PDF notes</option>
                          <option value="document">Document</option>
                          <option value="worksheet">Worksheet</option>
                          <option value="assignment">Assignment</option>
                          <option value="external_link">External link</option>
                        </select>
                      </label>
                      <label style={labelStyle}>Short description
                        <textarea style={{ ...inputStyle, minHeight: 70, resize: 'vertical' }} value={resourceDescription} onChange={(e) => setResourceDescription(e.target.value)} placeholder="Briefly describe this resource..." />
                      </label>
                      {resourceType === 'external_link' ? (
                        <label style={labelStyle}>External URL
                          <input style={inputStyle} type="url" value={resourceExternalUrl} onChange={(e) => setResourceExternalUrl(e.target.value)} placeholder="https://..." required />
                        </label>
                      ) : (
                        <label style={labelStyle}>Upload PDF to private storage
                          <input style={inputStyle} type="file" accept="application/pdf,.pdf" onChange={uploadCourseResource} disabled={resourceUploading} />
                          <span style={{ display: 'block', marginTop: 5, color: '#657789', fontSize: 11 }}>PDF only · Maximum 20 MB. Files are stored privately under this course.</span>
                        </label>
                        {resourceFilePath && (
                          <div style={{ padding: 10, borderRadius: 8, background: '#f3f7f8', color: '#36546b', fontSize: 11, overflowWrap: 'anywhere' }}>
                            <strong>Uploaded file:</strong> {resourceFilePath}
                            <button type="button" onClick={() => setResourceFilePath('')} style={{ ...smallDeleteStyle, marginLeft: 8 }}>Clear path</button>
                          </div>
                        )}
                        {!resourceFilePath && <p style={{ margin: 0, color: '#946200', fontSize: 11 }}>Upload a PDF before saving this resource.</p>}
                      )}
                      <label style={labelStyle}>Access level
                        <select style={inputStyle} value={resourceAccess} onChange={(e) => setResourceAccess(e.target.value as 'free' | 'paid')} disabled={!!resourceFilePath}>
                          <option value="free">Free (external link only)</option>
                          <option value="paid">Paid (course purchase required)</option>
                        </select>
                        {resourceFilePath && <span style={{ display: 'block', marginTop: 5, color: '#657789', fontSize: 11 }}>Private uploaded files are automatically restricted to paid course access.</span>}
                      </label>
                      <label style={labelStyle}>Publication status
                        <select style={inputStyle} value={resourceStatus} onChange={(e) => setResourceStatus(e.target.value as 'draft' | 'published')}>
                          <option value="draft">Draft</option>
                          <option value="published">Published</option>
                        </select>
                      </label>
                      <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
                        <button type="submit" disabled={resourceSaving || resourceUploading} style={primaryButtonStyle}>{resourceSaving ? 'Saving...' : resourceUploading ? 'Uploading...' : resourceEditingId ? 'Update resource' : 'Save resource'}</button>
                        {resourceEditingId && <button type="button" onClick={resetResourceForm} style={secondaryButtonStyle}>Cancel edit</button>}
                      </div>
                      <p style={{ margin: 0, color: '#657789', fontSize: 11, lineHeight: 1.5 }}>
                        Uploaded PDFs are stored in the private course-resources bucket. Students will receive secure downloads only after the server-side download feature is added.
                      </p>
                    </form>
                    <div style={{ display: 'grid', alignContent: 'start', gap: 10 }}>
                      <h4 style={{ margin: 0, color: '#102b46' }}>Resources for this lesson ({resources.length})</h4>
                      {resources.length === 0 ? <div style={emptyStyle}>No resources added to this lesson yet.</div> : resources.map((resource) => (
                        <article key={resource.id} style={{ border: '1px solid #e2eaed', borderRadius: 9, padding: 13, display: 'grid', gap: 8 }}>
                          <div style={{ color: '#102b46', fontWeight: 800, fontSize: 13 }}>{resource.title}</div>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            <span style={neutralPillStyle}>{resource.resource_type.replace('_', ' ').toUpperCase()}</span>
                            <span style={statusPill(resource.status)}>{resource.status}</span>
                            <span style={neutralPillStyle}>{resource.access_level.toUpperCase()}</span>
                          </div>
                          {resource.description && <p style={{ margin: 0, color: '#657789', fontSize: 12 }}>{resource.description}</p>}
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button type="button" onClick={() => editResource(resource)} style={smallActionStyle}>Edit</button>
                            <button type="button" onClick={() => deleteResource(resource)} style={smallDeleteStyle}>Delete</button>
                          </div>
                        </article>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </section>

        <footer className="admin-footer">EduAxis India · Learn. Prepare. Progress.</footer>
      </section>
    </main>
  );
}

const panelStyle: React.CSSProperties = {
  background: '#ffffff', border: '1px solid #e2eaed', borderRadius: 14,
  padding: 24, boxShadow: '0 5px 20px rgba(16,43,70,0.04)',
};
const sectionHeadingStyle: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  gap: 15, flexWrap: 'wrap', marginBottom: 22,
};
const formGridStyle: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16,
};
const labelStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 7, color: '#263b4d',
  fontSize: 13, fontWeight: 700,
};
const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', border: '1px solid #d7e1e6',
  borderRadius: 8, padding: '11px 12px', color: '#172b3d', background: '#fff',
  font: 'inherit', fontWeight: 400, minHeight: 43,
};
const primaryButtonStyle: React.CSSProperties = {
  border: 0, borderRadius: 8, padding: '12px 20px', background: '#102b46',
  color: '#fff', fontWeight: 700, cursor: 'pointer',
};
const secondaryButtonStyle: React.CSSProperties = {
  border: '1px solid #d7e1e6', borderRadius: 8, padding: '10px 15px',
  background: '#fff', color: '#102b46', fontWeight: 700, cursor: 'pointer',
};
const deleteButtonStyle: React.CSSProperties = {
  border: '1px solid #f0caca', borderRadius: 8, padding: '10px 15px',
  background: '#fff7f7', color: '#a93232', fontWeight: 700, cursor: 'pointer',
};
const boardChoiceStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 9, padding: '11px 14px',
  border: '1px solid #d7e1e6', borderRadius: 9, color: '#263b4d', fontSize: 14,
};
const emptyStyle: React.CSSProperties = {
  padding: 30, textAlign: 'center', color: '#657789', background: '#f7fafb', borderRadius: 10,
};
const courseCardStyle: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 18,
  flexWrap: 'wrap', border: '1px solid #e2eaed', borderRadius: 11, padding: 16,
};
const smallActionStyle: React.CSSProperties = {
  border: '1px solid #d7e1e6', borderRadius: 6, padding: '6px 8px',
  background: '#fff', color: '#102b46', fontSize: 11, fontWeight: 700, cursor: 'pointer',
};
const smallDeleteStyle: React.CSSProperties = {
  border: '1px solid #f0caca', borderRadius: 6, padding: '6px 8px',
  background: '#fff7f7', color: '#a93232', fontSize: 11, fontWeight: 700, cursor: 'pointer',
};
const neutralPillStyle: React.CSSProperties = {
  display: 'inline-block', background: '#eef3f6', color: '#42586a',
  borderRadius: 20, padding: '5px 9px', fontSize: 11, fontWeight: 700,
};
function statusPill(status: string): React.CSSProperties {
  return {
    display: 'inline-block', background: status === 'published' ? '#e6f6ef' : '#fff4df',
    color: status === 'published' ? '#18794e' : '#946200',
    borderRadius: 20, padding: '5px 9px', fontSize: 11, fontWeight: 800,
  };
}
