export interface DriveUser {
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
  uid: string;
}

export interface DriveOwner {
  displayName?: string;
  emailAddress?: string;
  picture?: string;
}

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  size?: string;
  webViewLink?: string;
  iconLink?: string;
  thumbnailLink?: string;
  parents?: string[];
  owners?: DriveOwner[];
  shared?: boolean;
  description?: string;
}

export interface BreadcrumbItem {
  id: string;
  name: string;
}

export interface AuthErrorInfo {
  type: 'popup-blocked' | 'popup-closed' | 'access-denied' | 'session-expired' | 'general';
  message: string;
  details?: string;
}

export interface ProjectFileSnapshot {
  id: string;
  name: string;
  path: string;
  mimeType: string;
  size?: string;
  sampleContent?: string;
}

export interface ProjectInvestigationResult {
  folderName: string;
  analysis: string;
  filesCount: number;
}

export interface ProjectInvestigationState {
  status: 'idle' | 'scanning' | 'analyzing' | 'complete' | 'error';
  progressMessage?: string;
  folderName?: string;
  result?: ProjectInvestigationResult | null;
  error?: string | null;
}
