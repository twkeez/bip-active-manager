export type GmailMessageListResponse = {
  messages?: Array<{ id?: string; threadId?: string }>;
  nextPageToken?: string;
  resultSizeEstimate?: number;
};

export type GmailMessageDetail = {
  id?: string;
  threadId?: string;
  historyId?: string;
  labelIds?: string[];
  snippet?: string;
  internalDate?: string;
  payload?: {
    mimeType?: string;
    headers?: Array<{ name?: string; value?: string }>;
    body?: { data?: string };
    parts?: Array<{
      mimeType?: string;
      body?: { data?: string };
      headers?: Array<{ name?: string; value?: string }>;
      parts?: Array<unknown>;
    }>;
  };
};

export type UserEmailMessageRow = {
  id: number;
  owner_user_id: string;
  gmail_message_id: string;
  gmail_thread_id: string;
  gmail_history_id: string | null;
  subject: string | null;
  from_email: string | null;
  from_name: string | null;
  to_emails: string[];
  snippet: string | null;
  body_text: string | null;
  body_html: string | null;
  internal_date: string | null;
  label_ids: string[];
  is_read: boolean;
  is_starred: boolean;
  triage_status: "inbox" | "needs_action" | "archived" | "deleted";
  needs_action: boolean;
  is_high_priority: boolean;
  task_id: number | null;
  raw_payload: Record<string, unknown>;
  last_synced_at: string;
  created_at: string;
  updated_at: string;
};
