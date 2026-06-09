export type Role = 'super_admin' | 'staff' | 'student';

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: Role;
  created_at?: string;
}

export interface Batch {
  id: string;
  name: string;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  created_by: string;
  created_at: string;
}

export interface BatchStudent {
  id: string;
  batch_id: string;
  student_id: string;
  enrolled_at: string;
}

export interface ContentPost {
  id: string;
  batch_id: string;
  title: string;
  description: string | null;
  release_date: string;
  is_published: boolean;
  attachments?: any[];
  created_by: string;
  created_at: string;
}

export interface ContentFile {
  id: string;
  post_id: string;
  file_name: string;
  file_url: string;
  file_type: 'pdf' | 'ppt' | 'assignment' | 'other' | string;
  uploaded_at: string;
}

export interface AttendanceSession {
  id: string;
  post_id: string;
  batch_id: string;
  session_date: string;
  attendance_code: string;
  code_expires_at: string;
  is_open: boolean;
  created_by: string;
  created_at: string;
}

export interface AttendanceRecord {
  id: string;
  session_id: string;
  student_id: string;
  marked_at: string;
  is_approved: boolean;
  approved_by: string | null;
  approved_at: string | null;
}
