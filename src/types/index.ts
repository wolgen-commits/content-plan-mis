export type UserRole =
  | 'admin'
  | 'content_planner'
  | 'manager_marketing'
  | 'designer'
  | 'videographer';

export type ContentStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'in_production'
  | 'submitted'
  | 'done'
  | 'rejected'
  | 'published';

export type ContentType = 'post' | 'reel' | 'story' | 'carousel' | 'video' | 'thread' | 'short';
export type Channel = 'Instagram' | 'TikTok' | 'YouTube' | 'LinkedIn' | 'Twitter' | 'Facebook' | 'Website';
export type KanbanColumn =
  | 'briefing'
  | 'design_in_progress'
  | 'video_in_progress'
  | 'review'
  | 'approved'
  | 'published';

export type WorkOrder = 'designer_first' | 'videographer_first' | 'parallel';
export type FileType = 'design' | 'video';
export type SubmissionStatus = 'pending' | 'approved' | 'rejected';
export type NotificationType =
  | 'plan_submitted'
  | 'plan_approved'
  | 'plan_rejected'
  | 'submission_received'
  | 'submission_approved'
  | 'submission_rejected'
  | 'assigned_to_plan'
  | 'assigned_to_task'
  | 'task_submitted'
  | 'plan_deadline_approaching';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar_url: string | null;
  created_at: string;
}

export interface ContentReference {
  id: string;
  content_plan_id: string;
  url: string;
  label: string | null;
}

export interface ContentTag {
  id: string;
  content_plan_id: string;
  tag: string;
}

export interface ContentAssignee {
  id: string;
  content_plan_id: string;
  user_id: string;
  role: 'designer' | 'videographer';
  assigned_at: string;
  user?: User;
}

export interface ContentSubmission {
  id: string;
  content_plan_id: string;
  submitted_by: string;
  file_url: string;
  file_name: string | null;
  file_size: number | null;
  file_type: FileType;
  version: number;
  status: SubmissionStatus;
  submission_notes: string | null;
  reviewer_notes: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  submitter?: User;
}

export interface ContentPlan {
  id: string;
  platform: string | null;
  title: string;
  content_type: ContentType[];
  channel: Channel[];
  topic: string | null;
  material: string | null;
  visual_brief: string | null;
  caption: string | null;
  scheduled_date: string | null;
  deadline_date: string | null;
  work_order: WorkOrder | null;
  status: ContentStatus;
  rejection_notes: string | null;
  kanban_column: KanbanColumn;
  position_in_kanban: number;
  created_by: string;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
  creator?: User;
  approver?: User;
  references?: ContentReference[];
  tags?: ContentTag[];
  assignees?: ContentAssignee[];
  submissions?: ContentSubmission[];
  tasks?: ContentPlanTask[];
}

export type TaskStatus = 'pending' | 'submitted' | 'done' | 'rejected';

export interface ContentPlanTask {
  id: string;
  content_plan_id: string;
  name: string;
  deadline: string;
  pic: string | null;
  pic_user_id: string | null;
  pic_user?: { id: string; name: string; role: string };
  reference: string | null;
  description: string | null;
  status: TaskStatus;
  file_url: string | null;
  file_name: string | null;
  storage_path: string | null;
  submission_notes: string | null;
  submitted_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  completed_at: string | null;
  completed_by: string | null;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  content_plan_id: string | null;
  type: NotificationType;
  message: string;
  data: Record<string, unknown> | null;
  read_at: string | null;
  created_at: string;
  content_plan?: Pick<ContentPlan, 'id' | 'title'>;
}

export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  per_page: number;
}
