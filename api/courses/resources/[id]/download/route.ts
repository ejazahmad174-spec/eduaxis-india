
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const adminClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

function response(message: string, status: number) {
  return NextResponse.json(
    { error: message },
    { status, headers: { 'Cache-Control': 'no-store' } }
  );
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return response('Server configuration is incomplete.', 500);
    }

    const { id } = await context.params;

    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      return response('Invalid resource ID.', 400);
    }

    // Identify the visitor, if signed in.
    const authorization = request.headers.get('authorization');
    const token = authorization?.startsWith('Bearer ')
      ? authorization.slice(7)
      : null;

    let userId: string | null = null;

    if (token) {
      const authClient = createClient(supabaseUrl, anonKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      });

      const { data, error } = await authClient.auth.getUser(token);

      if (!error && data.user) {
        userId = data.user.id;
      }
    }

    // Load the resource.
    const { data: resource, error: resourceError } = await adminClient
      .from('course_resources')
      .select('id, title, resource_type, access_level, file_path, external_url, status, lesson_id')
      .eq('id', id)
      .maybeSingle();

    if (resourceError || !resource) {
      return response('Resource not found.', 404);
    }

    // Load the related lesson.
    const { data: lesson, error: lessonError } = await adminClient
      .from('course_lessons')
      .select('id, status, chapter_id')
      .eq('id', resource.lesson_id)
      .maybeSingle();

    if (lessonError || !lesson) {
      return response('Resource not available.', 404);
    }

    const { data: chapter } = await adminClient
      .from('course_chapters')
      .select('id, unit_id')
      .eq('id', lesson.chapter_id)
      .maybeSingle();

    if (!chapter) return response('Resource not available.', 404);

    const { data: unit } = await adminClient
      .from('course_units')
      .select('id, board_mapping_id')
      .eq('id', chapter.unit_id)
      .maybeSingle();

    if (!unit) return response('Resource not available.', 404);

    const { data: mapping } = await adminClient
      .from('course_board_mappings')
      .select('id, course_id, is_active')
      .eq('id', unit.board_mapping_id)
      .maybeSingle();

    if (!mapping) return response('Resource not available.', 404);

    const { data: course } = await adminClient
      .from('courses')
      .select('id, status')
      .eq('id', mapping.course_id)
      .maybeSingle();

    if (!course) return response('Resource not available.', 404);

    // Check whether the visitor is an administrator.
    let isAdmin = false;

    if (userId) {
      const { data: profile } = await adminClient
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .maybeSingle();

      isAdmin = profile?.role === 'admin';
    }

    if (!isAdmin) {
      // Non-admin visitors can access only published resources
      // belonging to a published course and active board mapping.
      if (
        resource.status !== 'published' ||
        lesson.status !== 'published' ||
        course.status !== 'published' ||
        mapping.is_active !== true
      ) {
        return response('Resource is not available.', 403);
      }

      if (resource.access_level === 'paid') {
        if (!userId) {
          return response('Please log in and enrol in this course.', 401);
        }

        const { data: enrollment } = await adminClient
          .from('course_enrollments')
          .select('id')
          .eq('user_id', userId)
          .eq('course_id', course.id)
          .eq('status', 'active')
          .maybeSingle();

        if (!enrollment) {
          return response('An active course enrolment is required.', 403);
        }
      } else if (resource.access_level !== 'free') {
        return response('Invalid resource access setting.', 403);
      }
    }

    // External links are returned only after access checks.
    if (resource.resource_type === 'external_link') {
      if (!resource.external_url) {
        return response('Resource link is missing.', 404);
      }

      return NextResponse.json(
        { url: resource.external_url },
        { headers: { 'Cache-Control': 'no-store' } }
      );
    }

    if (!resource.file_path) {
      return response('Resource file is missing.', 404);
    }

    // Ensure the file is stored under the correct course folder.
    const firstFolder = resource.file_path.split('/')[0];

    if (firstFolder !== course.id) {
      return response('Resource file path is invalid.', 403);
    }

    // Generate a short-lived private download URL.
    const { data: signedFile, error: signedError } = await adminClient
      .storage
      .from('course-resources')
      .createSignedUrl(resource.file_path, 60, {
        download: true,
      });

    if (signedError || !signedFile?.signedUrl) {
      return response('Unable to prepare the download.', 500);
    }

    return NextResponse.json(
      {
        url: signedFile.signedUrl,
        title: resource.title,
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    console.error('Course resource download error:', error);
    return response('An unexpected error occurred.', 500);
  }
}
