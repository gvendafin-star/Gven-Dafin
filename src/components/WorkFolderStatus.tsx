import { DriveFile, AuthErrorInfo } from '../types';
import { formatDate } from '../lib/drive';
import {
  FolderCheck,
  FolderX,
  ExternalLink,
  FolderOpen,
  FolderSearch,
  Sparkles,
  AlertCircle,
  Clock,
  User,
  KeyRound,
} from 'lucide-react';
import { SignInButton } from './SignInButton';
import { AuthErrorBanner } from './AuthErrorBanner';

interface WorkFolderStatusProps {
  isAuthenticated: boolean;
  isLoading: boolean;
  workFolders: DriveFile[];
  activeFolderId: string | null;
  onSelectFolder: (folder: DriveFile) => void;
  onSignIn: () => void;
  isLoggingIn: boolean;
  error: string | null;
  onRetry: () => void;
  onGrantAccess?: () => void;
  onInvestigateProject?: (folder: DriveFile) => void;
  authError?: AuthErrorInfo | null;
  onDismissAuthError?: () => void;
}

export function WorkFolderStatus({
  isAuthenticated,
  isLoading,
  workFolders,
  activeFolderId,
  onSelectFolder,
  onSignIn,
  isLoggingIn,
  error,
  onRetry,
  onGrantAccess,
  onInvestigateProject,
  authError,
  onDismissAuthError,
}: WorkFolderStatusProps) {
  const isInIframe = typeof window !== 'undefined' && window.self !== window.top;

  const handleOpenNewTab = () => {
    window.open(window.location.href, '_blank', 'noopener,noreferrer');
  };

  if (!isAuthenticated) {
    return (
      <div className="space-y-4">
        {authError && onDismissAuthError && (
          <AuthErrorBanner
            error={authError}
            onRetry={onSignIn}
            onDismiss={onDismissAuthError}
            isRetrying={isLoggingIn}
          />
        )}

        <div
          id="work-folder-status-unauth"
          className="bg-[#18181B] rounded-2xl border border-[#27272A] p-6 sm:p-10 text-center"
        >
          <div className="w-14 h-14 mx-auto rounded-xl bg-[#27272A] border border-[#3F3F46] flex items-center justify-center text-[#FACC15] mb-5">
            <FolderSearch className="w-7 h-7" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-light text-white mb-2 tracking-tight">
            Проверка папки «work»
          </h2>
          <p className="text-[#A1A1AA] max-w-lg mx-auto text-sm leading-relaxed mb-6 font-normal">
            Чтобы просмотреть и проанализировать папку <span className="font-semibold text-white">«work»</span> в вашем личном Google Диске, подключите Google аккаунт. Доступ запрашивается исключительно в режиме безопасного чтения.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <SignInButton
              onClick={onSignIn}
              isLoading={isLoggingIn}
              text="Войти через Google и проверить диск"
            />

            {isInIframe && (
              <button
                id="unauth-open-tab-btn"
                type="button"
                onClick={handleOpenNewTab}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-[#A1A1AA] hover:text-white bg-[#27272A] hover:bg-[#3F3F46] border border-[#3F3F46] flex items-center gap-1.5 transition cursor-pointer"
                title="Открыть в отдельной вкладке без ограничений фрейма"
              >
                <ExternalLink className="w-4 h-4 text-[#FACC15]" />
                <span>Открыть в новой вкладке</span>
              </button>
            )}
          </div>

          {isInIframe && !authError && (
            <p className="text-[11px] text-[#52525B] mt-4 max-w-md mx-auto">
              Подсказка: если браузер блокирует всплывающее окно во фрейме, используйте кнопку «Открыть в новой вкладке».
            </p>
          )}
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div
        id="work-folder-status-loading"
        className="bg-[#18181B] rounded-2xl border border-[#27272A] p-10 text-center"
      >
        <div className="w-12 h-12 mx-auto rounded-xl bg-[#27272A] border border-[#3F3F46] flex items-center justify-center text-[#FACC15] mb-4">
          <FolderSearch className="w-6 h-6 animate-spin" />
        </div>
        <h3 className="text-lg font-medium text-white mb-1">
          Сканирование вашего Google Диска...
        </h3>
        <p className="text-[#52525B] text-sm">
          Ищем папки с названием «work» через Google Drive API v3
        </p>
      </div>
    );
  }

  if (error) {
    const isSessionExpired =
      error.toLowerCase().includes('истекла') ||
      error.toLowerCase().includes('недействителен') ||
      error.toLowerCase().includes('invalid authentication credentials') ||
      error.toLowerCase().includes('expected oauth 2') ||
      error.toLowerCase().includes('invalid credentials') ||
      error.toLowerCase().includes('unauthenticated') ||
      error.includes('401');

    const isScopeError =
      isSessionExpired ||
      error.toLowerCase().includes('insufficient') ||
      error.toLowerCase().includes('scope') ||
      error.toLowerCase().includes('права') ||
      error.includes('403');

    if (isScopeError) {
      return (
        <div
          id="work-folder-status-scope-error"
          className="bg-[#18181B] rounded-2xl border border-[#FACC15]/40 p-6 sm:p-7 shadow-lg shadow-black/40 text-[#A1A1AA]"
        >
          <div className="flex items-start gap-4">
            <div className="w-11 h-11 rounded-xl bg-[#27272A] border border-[#FACC15]/30 text-[#FACC15] flex items-center justify-center shrink-0 mt-0.5">
              <KeyRound className="w-5 h-5 text-[#FACC15]" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded bg-[#27272A] text-[#FACC15] border border-[#FACC15]/30">
                  {isSessionExpired ? 'Сессия истекла' : 'Требуется разрешение'}
                </span>
              </div>
              <h3 className="text-base font-semibold text-white mt-1.5 leading-snug">
                {isSessionExpired
                  ? 'Обновите сессию Google Drive'
                  : 'Предоставьте доступ к чтению Google Диска'}
              </h3>
              <p className="text-xs sm:text-sm text-[#A1A1AA] mt-1.5 leading-relaxed">
                {isSessionExpired
                  ? 'Срок действия временного ключа доступа истек или авторизация требует обновления. Нажмите кнопку ниже, чтобы обновить сессию и продолжить поиск папки «work».'
                  : 'Вы успешно вошли в аккаунт, но Google требует подтвердить разрешение на просмотр файлов Google Диска.'}
              </p>

              {!isSessionExpired && (
                <div className="mt-3.5 p-3.5 bg-[#27272A]/70 rounded-xl border border-[#3F3F46] text-xs text-[#D4D4D8] space-y-1.5">
                  <p className="font-semibold text-[#FACC15]">Как разрешить доступ:</p>
                  <p>1. Нажмите кнопку <strong>«Предоставить доступ к Google Диску»</strong> ниже.</p>
                  <p>2. В появившемся окне подтверждения Google обязательно <strong>отметьте галочкой пункт «Просмотр и скачивание файлов Google Диска»</strong>.</p>
                  <p>3. Нажмите кнопку <strong>«Продолжить»</strong> (Continue).</p>
                </div>
              )}

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button
                  id="grant-drive-access-btn"
                  type="button"
                  onClick={onGrantAccess || onSignIn}
                  disabled={isLoggingIn}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold bg-[#FACC15] text-black hover:bg-yellow-400 flex items-center gap-2 transition uppercase tracking-tight cursor-pointer shadow-sm"
                >
                  <KeyRound className="w-4 h-4 text-black" />
                  <span>
                    {isLoggingIn
                      ? 'Подключение к Google...'
                      : isSessionExpired
                      ? 'Обновить сессию Google Drive'
                      : 'Предоставить доступ к Google Диску'}
                  </span>
                </button>

                <button
                  id="retry-search-btn"
                  type="button"
                  onClick={onRetry}
                  disabled={isLoggingIn}
                  className="px-3.5 py-2.5 text-xs font-semibold bg-[#27272A] border border-[#3F3F46] text-[#A1A1AA] hover:text-white rounded-xl hover:bg-[#3F3F46] transition cursor-pointer"
                >
                  Попробовать снова
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div
        id="work-folder-status-error"
        className="bg-[#18181B] rounded-2xl border border-rose-900/40 p-6 text-[#A1A1AA]"
      >
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-white">
              Не удалось выполнить поиск на Google Диске
            </h3>
            <p className="text-xs text-rose-400 mt-1">{error}</p>
            <button
              id="retry-search-btn"
              onClick={onRetry}
              className="mt-3 px-3.5 py-1.5 text-xs font-semibold bg-rose-950/60 border border-rose-800 text-rose-300 rounded-lg hover:bg-rose-900 transition cursor-pointer"
            >
              Попробовать снова
            </button>
          </div>
        </div>
      </div>
    );
  }

  const hasFound = workFolders.length > 0;

  if (hasFound) {
    return (
      <div
        id="work-folder-status-found"
        className="bg-[#18181B] rounded-2xl border border-emerald-900/30 p-5 sm:p-7"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#27272A]">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-emerald-950/60 border border-emerald-800/60 text-emerald-400 flex items-center justify-center shrink-0">
              <FolderCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400 bg-[#18181B] border border-emerald-900/40 px-2 py-0.5 rounded">
                  Ответ: Да, вижу!
                </span>
                <span className="text-xs text-[#71717A] font-medium">
                  {workFolders.length === 1
                    ? 'Найдена 1 папка'
                    : `Найдено папок: ${workFolders.length}`}
                </span>
              </div>
              <h2 className="text-xl font-light text-white mt-1">
                Папка «work» обнаружена в Google Диске
              </h2>
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3">
          {workFolders.map((folder) => {
            const isSelected = activeFolderId === folder.id;
            const owner = folder.owners?.[0]?.displayName || folder.owners?.[0]?.emailAddress;

            return (
              <div
                key={folder.id}
                id={`folder-card-${folder.id}`}
                className={`p-4 rounded-xl border transition-all ${
                  isSelected
                    ? 'bg-[#1e1e1e] border-[#FACC15] ring-1 ring-[#FACC15]/20'
                    : 'bg-[#131316] border-[#27272A] hover:border-[#FACC15]/60 hover:bg-[#18181B]'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-3.5">
                    <div className="w-10 h-10 rounded-lg bg-[#27272A] border border-[#3F3F46] flex items-center justify-center text-[#FACC15] shrink-0 mt-0.5">
                      <FolderOpen className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-base font-medium text-white">
                          {folder.name}
                        </span>
                        {isSelected && (
                          <span className="text-[10px] font-bold uppercase tracking-widest text-black bg-[#FACC15] px-2 py-0.5 rounded">
                            Активна
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-[#52525B] mt-1 flex-wrap">
                        {owner && (
                          <span className="flex items-center gap-1">
                            <User className="w-3.5 h-3.5 text-[#52525B]" />
                            {owner}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-[#52525B]" />
                          Изменено: {formatDate(folder.modifiedTime)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center flex-wrap">
                    {onInvestigateProject && (
                      <button
                        id={`investigate-folder-${folder.id}`}
                        type="button"
                        onClick={() => onInvestigateProject(folder)}
                        className="px-3.5 py-1.5 rounded-md text-xs font-semibold bg-[#27272A] border border-[#FACC15]/40 text-[#FACC15] hover:bg-[#FACC15] hover:text-black flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                        title="Глубокий технический анализ кодовой базы и файлов в Gemini AI"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Исследовать проект (AI)</span>
                      </button>
                    )}

                    <button
                      id={`open-folder-${folder.id}`}
                      onClick={() => onSelectFolder(folder)}
                      className={`px-3.5 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                        isSelected
                          ? 'bg-[#FACC15] text-black uppercase tracking-tight'
                          : 'bg-[#27272A] hover:bg-[#3F3F46] text-white'
                      }`}
                    >
                      <FolderOpen className="w-3.5 h-3.5" />
                      {isSelected ? 'Открыта' : 'Открыть файлы'}
                    </button>

                    {folder.webViewLink && (
                      <a
                        href={folder.webViewLink}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-1.5 rounded-md text-xs font-medium text-[#A1A1AA] hover:text-white bg-[#18181B] border border-[#27272A] hover:border-[#3F3F46] flex items-center gap-1 transition"
                        title="Открыть в Google Диске"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Google Drive</span>
                      </a>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Not found
  return (
    <div
      id="work-folder-status-notfound"
      className="bg-[#18181B] rounded-2xl border border-[#27272A] p-6 sm:p-7"
    >
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-xl bg-[#27272A] border border-[#3F3F46] flex items-center justify-center text-[#FACC15] shrink-0">
          <FolderX className="w-6 h-6" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#FACC15] bg-[#18181B] border border-[#FACC15]/30 px-2 py-0.5 rounded">
              Ответ: Пока нет
            </span>
          </div>
          <h2 className="text-xl font-light text-white mt-1">
            Папка с названием «work» не найдена
          </h2>
          <p className="text-sm text-[#A1A1AA] mt-1 leading-relaxed font-normal">
            Поиск по вашему Google Диску не обнаружил папок, содержащих «work» в названии.
          </p>

          <div className="mt-4 p-4 bg-[#131316] rounded-xl border border-[#27272A] text-xs text-[#A1A1AA] space-y-2">
            <div className="font-semibold text-white flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#FACC15]" />
              Возможные причины и решения:
            </div>
            <ul className="list-disc list-inside space-y-1 text-[#71717A] pl-1">
              <li>Папка называется по-русски (например, «Работа», «Проекты» или «Рабочее»).</li>
              <li>Папка находится в корзине или доступ к ней ограничен.</li>
              <li>
                Вы можете создать папку «work» в своем Google Диске и нажать кнопку обновления вверху.
              </li>
              <li>Или воспользуйтесь строкой поиска ниже, чтобы найти любые файлы.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
