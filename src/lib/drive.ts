import { DriveFile, ProjectFileSnapshot } from '../types';

const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';

const FILE_FIELDS =
  'files(id, name, mimeType, modifiedTime, size, webViewLink, iconLink, thumbnailLink, parents, owners, shared, description)';

export const FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder';

export class DriveApiError extends Error {
  status?: number;
  isAuthError: boolean;

  constructor(message: string, status?: number, isAuthError = false) {
    super(message);
    this.name = 'DriveApiError';
    this.status = status;
    this.isAuthError = isAuthError;
  }
}

export function isDriveAuthError(err: any): boolean {
  if (!err) return false;
  if (err.isAuthError) return true;
  if (err.status === 401 || err.status === 403) return true;
  const msg = (typeof err.message === 'string' ? err.message : String(err)).toLowerCase();
  return (
    msg.includes('invalid authentication credentials') ||
    msg.includes('expected oauth 2') ||
    msg.includes('invalid credentials') ||
    msg.includes('unauthenticated') ||
    msg.includes('401') ||
    msg.includes('insufficient') ||
    msg.includes('scope') ||
    msg.includes('permission denied')
  );
}

async function driveFetch(
  url: string,
  accessToken: string,
  actionDescription: string
): Promise<Response> {
  if (!accessToken || !accessToken.trim()) {
    throw new DriveApiError(
      'Токен доступа к Google Drive отсутствует. Пожалуйста, выполните вход через Google.',
      401,
      true
    );
  }

  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
  } catch (netErr: any) {
    throw new DriveApiError(
      `Сетевая ошибка при обращении к Google Drive: ${netErr.message || netErr}`
    );
  }

  if (!response.ok) {
    const errJson = await response.json().catch(() => ({}));
    const rawMsg = errJson?.error?.message || `HTTP ${response.status}`;
    const isAuth =
      response.status === 401 ||
      response.status === 403 ||
      rawMsg.toLowerCase().includes('invalid authentication credentials') ||
      rawMsg.toLowerCase().includes('expected oauth 2') ||
      rawMsg.toLowerCase().includes('invalid credentials') ||
      rawMsg.toLowerCase().includes('unauthenticated');

    let userMessage = rawMsg;
    if (isAuth) {
      userMessage =
        response.status === 401 || rawMsg.toLowerCase().includes('invalid authentication credentials')
          ? 'Сессия Google Drive истекла или токен недействителен. Пожалуйста, выполните вход заново.'
          : 'Недостаточно прав для чтения Google Диска. Требуется предоставить разрешение на доступ.';
    } else {
      userMessage = `${actionDescription}: ${rawMsg}`;
    }

    throw new DriveApiError(userMessage, response.status, isAuth);
  }

  return response;
}

export async function findWorkFolders(accessToken: string): Promise<DriveFile[]> {
  // Search for folders that have "work" in their name (or "Work", "WORK")
  const query = `mimeType = '${FOLDER_MIME_TYPE}' and name contains 'work' and trashed = false`;
  const url = `${DRIVE_API_BASE}/files?q=${encodeURIComponent(
    query
  )}&fields=${encodeURIComponent(FILE_FIELDS)}&pageSize=50&orderBy=name`;

  const response = await driveFetch(url, accessToken, 'Ошибка поиска папки work');
  const data = await response.json();
  return data.files || [];
}

export async function getFolderContents(
  accessToken: string,
  folderId: string
): Promise<DriveFile[]> {
  const query = `'${folderId}' in parents and trashed = false`;
  const url = `${DRIVE_API_BASE}/files?q=${encodeURIComponent(
    query
  )}&fields=${encodeURIComponent(
    FILE_FIELDS
  )}&pageSize=100&orderBy=folder,name`;

  const response = await driveFetch(url, accessToken, 'Ошибка получения содержимого папки');
  const data = await response.json();
  return data.files || [];
}

export function isTextOrCodeFile(name: string, mimeType: string): boolean {
  if (
    mimeType.includes('text') ||
    mimeType.includes('json') ||
    mimeType.includes('javascript') ||
    mimeType.includes('typescript') ||
    mimeType.includes('xml')
  ) {
    return true;
  }
  if (mimeType === 'application/vnd.google-apps.document') {
    return true;
  }
  const textExtensions = [
    '.md',
    '.txt',
    '.json',
    '.ts',
    '.tsx',
    '.js',
    '.jsx',
    '.py',
    '.html',
    '.css',
    '.scss',
    '.yaml',
    '.yml',
    '.env',
    '.sh',
    '.xml',
    '.sql',
    '.rs',
    '.go',
    '.java',
    '.c',
    '.cpp',
    '.h',
    '.toml',
    '.ini',
    '.csv',
    '.log',
    '.gitignore',
  ];
  const lower = name.toLowerCase();
  return textExtensions.some((ext) => lower.endsWith(ext));
}

export async function fetchFileSampleContent(
  accessToken: string,
  fileId: string,
  mimeType: string,
  fileName: string
): Promise<string | undefined> {
  try {
    let url = `${DRIVE_API_BASE}/files/${fileId}?alt=media`;
    if (mimeType === 'application/vnd.google-apps.document') {
      url = `${DRIVE_API_BASE}/files/${fileId}/export?mimeType=text/plain`;
    }
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    if (!res.ok) return undefined;
    const text = await res.text();
    return text.slice(0, 8000);
  } catch (err) {
    console.warn(`Could not read file sample for ${fileName}:`, err);
    return undefined;
  }
}

export async function collectProjectFilesRecursively(
  accessToken: string,
  folderId: string,
  basePath = '',
  maxDepth = 2,
  currentDepth = 0,
  maxFiles = 60
): Promise<ProjectFileSnapshot[]> {
  const items = await getFolderContents(accessToken, folderId);
  const result: ProjectFileSnapshot[] = [];

  for (const item of items) {
    if (result.length >= maxFiles) break;

    const itemPath = basePath ? `${basePath}/${item.name}` : item.name;

    if (item.mimeType === FOLDER_MIME_TYPE) {
      result.push({
        id: item.id,
        name: item.name,
        path: `${itemPath}/`,
        mimeType: item.mimeType,
      });

      if (currentDepth < maxDepth && result.length < maxFiles) {
        try {
          const subItems = await collectProjectFilesRecursively(
            accessToken,
            item.id,
            itemPath,
            maxDepth,
            currentDepth + 1,
            maxFiles - result.length
          );
          result.push(...subItems);
        } catch (err) {
          console.warn(`Failed reading subfolder ${item.name}:`, err);
        }
      }
    } else {
      let sampleContent: string | undefined = undefined;
      const lowerName = item.name.toLowerCase();
      const isPriority =
        lowerName.includes('readme') ||
        lowerName.includes('package') ||
        lowerName.includes('config') ||
        lowerName.includes('manifest') ||
        lowerName.endsWith('.md') ||
        lowerName.endsWith('.json') ||
        lowerName.endsWith('.ts') ||
        lowerName.endsWith('.py') ||
        lowerName.endsWith('.js') ||
        lowerName.endsWith('.txt');

      if (isTextOrCodeFile(item.name, item.mimeType) && isPriority) {
        sampleContent = await fetchFileSampleContent(accessToken, item.id, item.mimeType, item.name);
      }

      result.push({
        id: item.id,
        name: item.name,
        path: itemPath,
        mimeType: item.mimeType,
        size: item.size,
        sampleContent,
      });
    }
  }

  return result;
}

export async function getFileMetadata(
  accessToken: string,
  fileId: string
): Promise<DriveFile> {
  const fields =
    'id, name, mimeType, modifiedTime, size, webViewLink, iconLink, thumbnailLink, parents, owners, shared, description';
  const url = `${DRIVE_API_BASE}/files/${fileId}?fields=${encodeURIComponent(fields)}`;

  const response = await driveFetch(url, accessToken, 'Ошибка получения метаданных файла');
  return response.json();
}

export async function searchAllDriveFiles(
  accessToken: string,
  searchQuery: string
): Promise<DriveFile[]> {
  const clean = searchQuery.replace(/'/g, "\\'");
  const query = `name contains '${clean}' and trashed = false`;
  const url = `${DRIVE_API_BASE}/files?q=${encodeURIComponent(
    query
  )}&fields=${encodeURIComponent(FILE_FIELDS)}&pageSize=50&orderBy=modifiedTime desc`;

  const response = await driveFetch(url, accessToken, 'Ошибка поиска файлов');
  const data = await response.json();
  return data.files || [];
}

export function formatFileSize(bytes?: string): string {
  if (!bytes) return '—';
  const num = parseInt(bytes, 10);
  if (isNaN(num)) return '—';
  if (num < 1024) return `${num} B`;
  if (num < 1024 * 1024) return `${(num / 1024).toFixed(1)} KB`;
  if (num < 1024 * 1024 * 1024) return `${(num / (1024 * 1024)).toFixed(1)} MB`;
  return `${(num / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function formatDate(dateString?: string): string {
  if (!dateString) return '—';
  const date = new Date(dateString);
  return date.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function getFileCategory(mimeType: string): {
  type: string;
  color: string;
  badge: string;
} {
  if (mimeType === FOLDER_MIME_TYPE) {
    return { type: 'folder', color: 'text-[#FACC15] bg-[#18181B] border border-[#FACC15]/30', badge: 'Папка' };
  }
  if (mimeType.includes('document') || mimeType.includes('text') || mimeType.includes('word')) {
    return { type: 'doc', color: 'text-blue-400 bg-[#18181B] border border-blue-900/30', badge: 'Документ' };
  }
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType.includes('csv')) {
    return { type: 'sheet', color: 'text-emerald-400 bg-[#18181B] border border-emerald-900/30', badge: 'Таблица' };
  }
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) {
    return { type: 'presentation', color: 'text-orange-400 bg-[#18181B] border border-orange-900/30', badge: 'Презентация' };
  }
  if (mimeType.includes('pdf')) {
    return { type: 'pdf', color: 'text-red-400 bg-[#18181B] border border-red-900/30', badge: 'PDF' };
  }
  if (mimeType.includes('image')) {
    return { type: 'image', color: 'text-purple-400 bg-[#18181B] border border-purple-900/30', badge: 'Изображение' };
  }
  if (mimeType.includes('video')) {
    return { type: 'video', color: 'text-rose-400 bg-[#18181B] border border-rose-900/30', badge: 'Видео' };
  }
  if (mimeType.includes('audio')) {
    return { type: 'audio', color: 'text-pink-400 bg-[#18181B] border border-pink-900/30', badge: 'Аудио' };
  }
  if (mimeType.includes('zip') || mimeType.includes('compressed') || mimeType.includes('tar')) {
    return { type: 'archive', color: 'text-yellow-400 bg-[#18181B] border border-yellow-900/30', badge: 'Архив' };
  }
  return { type: 'file', color: 'text-[#A1A1AA] bg-[#18181B] border border-[#27272A]', badge: 'Файл' };
}
