
type Discovery = {
  id: string;
  source_id: string;
  discovered_title: string;
  discovered_url: string;
  notice_category: NoticeCategory;
  status: 'new' | 'processing' | 'imported' | 'ignored' | 'error';
  discovered_at: string;
  processed_at: string | null;
  error_message: string | null;

  pdf_url: string | null;
  extracted_details: {
    job_title_candidates?: string[];
    department?: string | null;
    vacancies?: string | null;
    qualification?: string | null;
    age_limit?: string | null;
    application_fee?: string | null;
    application_start_date?: string | null;
    last_date?: string | null;
    examination_date?: string | null;
    apply_url?: string | null;
    source_pdf_url?: string;
    extraction_note?: string;
    extracted_text_excerpt?: string;
    pdf_pages?: number;
  } | null;

  extraction_status:
    | 'pending'
    | 'processing'
    | 'completed'
    | 'failed'
    | 'needs_ocr'
    | null;

  extraction_error: string | null;
  extracted_at: string | null;
};
