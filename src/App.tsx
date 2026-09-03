import { useState, useEffect, useCallback } from 'react';
import {
  DriveUser,
  DriveFile,
  BreadcrumbItem,
  AuthErrorInfo,
  ProjectInvestigationState,
} from './types';
import {
  initAuth,
  googleSignIn,
  signInWithGis,
  logout,
  getAccessToken,
  clearCachedToken,
} from './lib/firebase';
import {
  findWorkFolders,
  getFolderContents,
  searchAllDriveFiles,
  collectProjectFilesRecursively,
  isDriveAuthError,
} from './lib/drive';
import { Header } from './components/Header';
import { WorkFolderStatus } from './components/WorkFolderStatus';
import { DriveExplorer } from './components/DriveExplorer';
import { ProjectAuditModal } from './components/ProjectAuditModal';

export default function App() {
  const [user, setUser] = useState<DriveUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [authError, setAuthError] = useState<AuthErrorInfo | null>(null);

  // Status for the specific "work" folder search
  const [isSearchingWork, setIsSearchingWork] = useState(false);
  const [workFolders, setWorkFolders] = useState<DriveFile[]>([]);
  const [workSearchError, setWorkSearchError] = useState<string | null>(null);

  // Active folder & explorer state
  const [currentFolder, setCurrentFolder] = useState<BreadcrumbItem | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([
    { id: 'root', name: 'Мой диск' },
  ]);
  const [folderFiles, setFolderFiles] = useState<DriveFile[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);

  // Drive search state
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchingDrive, setIsSearchingDrive] = useState(false);

  // Project AI Investigation state
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [investigation, setInvestigation] = useState<ProjectInvestigationState>({
    status: 'idle',
    folderName: 'work',
  });
  const [investigatingFolder, setInvestigatingFolder] = useState<DriveFile | null>(null);

  // Function to scan Google Drive for "work" folder
  const scanForWorkFolders = useCallback(async (authToken: string) => {
    setIsSearchingWork(true);
    setWorkSearchError(null);
    try {
      const folders = await findWorkFolders(authToken);
      setWorkFolders(folders);

      if (folders.length > 0) {
        // Automatically open the first "work" folder
        const primaryWorkFolder = folders[0];
        setCurrentFolder({ id: primaryWorkFolder.id, name: primaryWorkFolder.name });
        setBreadcrumbs([
          { id: 'root', name: 'Мой диск' },
          { id: primaryWorkFolder.id, name: primaryWorkFolder.name },
        ]);
        await loadFolder(authToken, primaryWorkFolder.id);
      } else {
        // If not found, load root so user can explore their Drive
        setCurrentFolder({ id: 'root', name: 'Мой диск' });
        setBreadcrumbs([{ id: 'root', name: 'Мой диск' }]);
        await loadFolder(authToken, 'root');
      }
    } catch (err: any) {
      console.error('Error finding work folders:', err);
      if (isDriveAuthError(err)) {
        clearCachedToken();
        setToken(null);
        setWorkSearchError('Сессия Google Drive истекла или токен недействителен.');
        setAuthError({
          type: 'session-expired',
          message: 'Сессия Google Drive истекла',
          details: 'Токен доступа устарел. Пожалуйста, обновите авторизацию через кнопку «Обновить сессию Google Drive».',
        });
      } else {
        setWorkSearchError(err.message || 'Ошибка поиска папки work');
      }
    } finally {
      setIsSearchingWork(false);
    }
  }, []);

  const loadFolder = async (authToken: string, folderId: string) => {
    setIsLoadingFiles(true);
    try {
      const items = await getFolderContents(authToken, folderId);
      setFolderFiles(items);
    } catch (err: any) {
      console.error('Error loading folder items:', err);
      if (isDriveAuthError(err)) {
        clearCachedToken();
        setToken(null);
        setAuthError({
          type: 'session-expired',
          message: 'Сессия Google Drive истекла',
          details: 'Срок действия доступа истек при обращении к папке. Пожалуйста, выполните повторный вход.',
        });
      }
    } finally {
      setIsLoadingFiles(false);
    }
  };

  useEffect(() => {
    const unsubscribe = initAuth(
      (authUser: DriveUser, authToken: string) => {
        setUser(authUser);
        setToken(authToken);
        scanForWorkFolders(authToken);
      },
      () => {
        setUser(null);
        setToken(null);
        setWorkFolders([]);
        setFolderFiles([]);
      }
    );

    return () => unsubscribe();
  }, [scanForWorkFolders]);

  const handleSignIn = async () => {
    setAuthError(null);
    setIsLoggingIn(true);
    try {
      let res = null;
      try {
        res = await googleSignIn();
      } catch (firstErr: any) {
        // If popup was blocked or Firebase failed, try GIS directly if available
        if (window.google?.accounts?.oauth2) {
          try {
            res = await signInWithGis();
          } catch (gisErr) {
            throw firstErr;
          }
        } else {
          throw firstErr;
        }
      }

      if (res) {
        setUser(res.user);
        setToken(res.accessToken);
        setAuthError(null);
        await scanForWorkFolders(res.accessToken);
      }
    } catch (err: any) {
      const isPopupBlocked =
        err?.code === 'auth/popup-blocked' ||
        err?.message?.includes('auth/popup-blocked');
      const isPopupClosed =
        err?.code === 'auth/popup-closed-by-user' ||
        err?.code === 'auth/cancelled-popup-request';
      const isAccessDenied =
        err?.code === 'auth/user-cancelled' ||
        err?.message?.includes('access_denied') ||
        err?.message?.includes('403') ||
        err?.message?.includes('не прошло проверку');

      if (isAccessDenied) {
        setAuthError({
          type: 'access-denied',
          message: 'Требуется подтвердить разрешение на доступ к Google Drive',
          details:
            'Google может показать экран «Приложение не проверено». Нажмите «Дополнительные настройки» (Advanced) в окне Google, затем выберите «Перейти на страницу (небезопасно)», чтобы разрешить просмотр диска.',
        });
      } else if (isPopupBlocked) {
        setAuthError({
          type: 'popup-blocked',
          message: 'Браузер заблокировал всплывающее окно авторизации Google.',
          details:
            'Встроенный фрейм предпросмотра ограничивает открытие всплывающих окон. Откройте приложение в отдельной вкладке или разрешите всплывающие окна в адресной строке.',
        });
      } else if (isPopupClosed) {
        setAuthError({
          type: 'popup-closed',
          message: 'Окно авторизации было закрыто до завершения входа.',
          details: 'Пожалуйста, выберите Google аккаунт в открывшемся окне.',
        });
      } else {
        setAuthError({
          type: 'general',
          message: err?.message || 'Ошибка подключения к Google Drive.',
        });
        console.error('Login error:', err);
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleSignOut = async () => {
    await logout();
    setUser(null);
    setToken(null);
    setAuthError(null);
    setWorkFolders([]);
    setFolderFiles([]);
    setBreadcrumbs([{ id: 'root', name: 'Мой диск' }]);
    setCurrentFolder(null);
  };

  const handleSelectWorkFolder = async (folder: DriveFile) => {
    if (!token) return;
    setSearchQuery('');
    setCurrentFolder({ id: folder.id, name: folder.name });
    setBreadcrumbs([
      { id: 'root', name: 'Мой диск' },
      { id: folder.id, name: folder.name },
    ]);
    await loadFolder(token, folder.id);
  };

  const handleNavigateFolder = async (folderId: string, folderName: string) => {
    if (!token) return;
    setSearchQuery('');
    setCurrentFolder({ id: folderId, name: folderName });
    setBreadcrumbs((prev) => [...prev, { id: folderId, name: folderName }]);
    await loadFolder(token, folderId);
  };

  const handleNavigateBreadcrumb = async (index: number) => {
    if (!token) return;
    setSearchQuery('');
    const target = breadcrumbs[index];
    setBreadcrumbs((prev) => prev.slice(0, index + 1));
    setCurrentFolder(target);
    await loadFolder(token, target.id);
  };

  const handleSearchDrive = async (query: string) => {
    if (!token) return;
    setSearchQuery(query);
    setIsSearchingDrive(true);
    try {
      const results = await searchAllDriveFiles(token, query);
      setFolderFiles(results);
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setIsSearchingDrive(false);
    }
  };

  const handleClearSearch = async () => {
    setSearchQuery('');
    if (token && currentFolder) {
      await loadFolder(token, currentFolder.id);
    }
  };

  const handleInvestigateProject = async (targetFolder?: DriveFile) => {
    const currentToken = token || getAccessToken();
    if (!currentToken) {
      await handleSignIn();
      return;
    }

    const folderToAudit = targetFolder || (workFolders.length > 0 ? workFolders[0] : null);
    if (!folderToAudit) {
      setWorkSearchError('Сначала выберите или откройте папку «work» для проведения аудита.');
      return;
    }

    setInvestigatingFolder(folderToAudit);
    setIsAuditModalOpen(true);
    setInvestigation({
      status: 'scanning',
      folderName: folderToAudit.name,
      progressMessage: `Сканируем файлы и подпапки в «${folderToAudit.name}»...`,
      result: null,
      error: null,
    });

    try {
      // 1. Collect project structure and sample contents
      const projectSnapshots = await collectProjectFilesRecursively(
        currentToken,
        folderToAudit.id,
        folderToAudit.name,
        2, // depth 2
        0,
        50 // max 50 files
      );

      setInvestigation((prev) => ({
        ...prev,
        status: 'analyzing',
        progressMessage: `Собрано ${projectSnapshots.length} файлов. Передаём структуру в Gemini AI...`,
      }));

      // 2. Request Gemini AI analysis from server
      const res = await fetch('/api/analyze-project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folderName: folderToAudit.name,
          files: projectSnapshots,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Ошибка сервера: ${res.status}`);
      }

      const auditData = await res.json();
      setInvestigation({
        status: 'complete',
        folderName: folderToAudit.name,
        result: {
          folderName: folderToAudit.name,
          analysis: auditData.analysis,
          filesCount: projectSnapshots.length,
        },
      });
    } catch (err: any) {
      console.error('Project investigation error:', err);
      setInvestigation({
        status: 'error',
        folderName: folderToAudit.name,
        error: err?.message || 'Не удалось выполнить исследование проекта',
      });
    }
  };

  const handleGrantDriveAccess = async () => {
    setIsLoggingIn(true);
    setWorkSearchError(null);
    setAuthError(null);
    try {
      let res = null;
      if (window.google?.accounts?.oauth2) {
        try {
          res = await signInWithGis({
            prompt: 'consent',
            hint: user?.email || undefined,
          });
        } catch (gisErr: any) {
          console.warn('GIS grant access error, falling back to Google sign in:', gisErr);
        }
      }
      if (!res) {
        res = await googleSignIn({ prompt: 'consent' });
      }

      if (res) {
        setUser(res.user);
        setToken(res.accessToken);
        setWorkSearchError(null);
        setAuthError(null);
        await scanForWorkFolders(res.accessToken);
      }
    } catch (err: any) {
      console.error('Error requesting Google Drive scope:', err);
      const isPopupClosed =
        err?.code === 'auth/popup-closed-by-user' ||
        err?.code === 'auth/cancelled-popup-request' ||
        err?.message?.includes('closed');
      if (isPopupClosed) {
        setWorkSearchError('Окно авторизации было закрыто. Нажмите «Обновить сессию Google Drive», чтобы повторить вход.');
      } else {
        setWorkSearchError(err?.message || 'Не удалось получить разрешение Google Drive');
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleRefresh = async () => {
    if (
      !token ||
      workSearchError?.toLowerCase().includes('scope') ||
      workSearchError?.toLowerCase().includes('insufficient') ||
      workSearchError?.toLowerCase().includes('сессия') ||
      workSearchError?.toLowerCase().includes('недействителен') ||
      isDriveAuthError({ message: workSearchError })
    ) {
      await handleGrantDriveAccess();
      return;
    }
    const currentToken = token || getAccessToken();
    if (currentToken) {
      await scanForWorkFolders(currentToken);
    } else {
      await handleSignIn();
    }
  };

  return (
    <div className="min-h-screen bg-[#09090B] text-[#A1A1AA] flex flex-col font-sans selection:bg-[#FACC15] selection:text-black">
      <Header
        user={user}
        onSignOut={handleSignOut}
        onRefresh={handleRefresh}
        isRefreshing={isSearchingWork || isLoadingFiles}
        onSignIn={handleSignIn}
        isSigningIn={isLoggingIn}
      />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {/* Card specifically answering user question: "видишь папку work?" */}
        <WorkFolderStatus
          isAuthenticated={!!user && !!token}
          isLoading={isSearchingWork}
          workFolders={workFolders}
          activeFolderId={currentFolder?.id || null}
          onSelectFolder={handleSelectWorkFolder}
          onSignIn={handleSignIn}
          onGrantAccess={handleGrantDriveAccess}
          onInvestigateProject={handleInvestigateProject}
          isLoggingIn={isLoggingIn}
          error={workSearchError}
          onRetry={handleRefresh}
          authError={authError}
          onDismissAuthError={() => setAuthError(null)}
        />

        {/* Project Audit Modal */}
        <ProjectAuditModal
          isOpen={isAuditModalOpen}
          onClose={() => setIsAuditModalOpen(false)}
          investigation={investigation}
          onRetryInvestigation={() => {
            if (investigatingFolder) {
              handleInvestigateProject(investigatingFolder);
            } else if (workFolders.length > 0) {
              handleInvestigateProject(workFolders[0]);
            }
          }}
        />

        {/* Explorer interface once connected */}
        {user && token && (
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-xs uppercase tracking-widest font-bold text-white">
                {searchQuery
                  ? `Результаты поиска: «${searchQuery}»`
                  : currentFolder?.name
                  ? `Содержимое: ${currentFolder.name}`
                  : 'Файлы Google Диска'}
              </h3>
              <span className="text-xs text-[#52525B]">
                {folderFiles.length}{' '}
                {folderFiles.length === 1
                  ? 'элемент'
                  : folderFiles.length > 1 && folderFiles.length < 5
                  ? 'элемента'
                  : 'элементов'}
              </span>
            </div>

            <DriveExplorer
              currentFolder={currentFolder}
              breadcrumbs={breadcrumbs}
              files={folderFiles}
              isLoading={isLoadingFiles || isSearchingDrive}
              onNavigateFolder={handleNavigateFolder}
              onNavigateBreadcrumb={handleNavigateBreadcrumb}
              onSearch={handleSearchDrive}
              searchQuery={searchQuery}
              isSearching={isSearchingDrive}
              onClearSearch={handleClearSearch}
              onInvestigateProject={() => {
                if (currentFolder && currentFolder.id !== 'root') {
                  handleInvestigateProject({ id: currentFolder.id, name: currentFolder.name } as any);
                } else if (workFolders.length > 0) {
                  handleInvestigateProject(workFolders[0]);
                }
              }}
            />
          </div>
        )}
      </main>

      <footer className="py-6 border-t border-[#1F1F23] text-center text-xs text-[#52525B]">
        Google Drive Integration • Sophisticated Dark Theme
      </footer>
    </div>
  );
}
