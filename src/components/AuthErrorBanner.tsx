import { useState } from 'react';
import { AlertTriangle, ExternalLink, RefreshCw, X, ChevronDown, ChevronUp, ShieldAlert } from 'lucide-react';
import { AuthErrorInfo } from '../types';

interface AuthErrorBannerProps {
  error: AuthErrorInfo;
  onRetry: () => void;
  onDismiss: () => void;
  isRetrying?: boolean;
}

export function AuthErrorBanner({
  error,
  onRetry,
  onDismiss,
  isRetrying = false,
}: AuthErrorBannerProps) {
  const [showInstructions, setShowInstructions] = useState(error.type === 'popup-blocked');

  const openInNewTab = () => {
    window.open(window.location.href, '_blank', 'noopener,noreferrer');
  };

  const isBlocked = error.type === 'popup-blocked';
  const isAccessDenied = error.type === 'access-denied';
  const isSessionExpired = error.type === 'session-expired';
  const isWarningStyle = isBlocked || isAccessDenied || isSessionExpired;

  return (
    <div
      id="auth-error-banner"
      className={`rounded-2xl border p-5 sm:p-6 transition-all ${
        isWarningStyle
          ? 'bg-[#18181B] border-[#FACC15]/40 shadow-lg shadow-black/40'
          : 'bg-[#18181B] border-rose-900/50'
      }`}
    >
      <div className="flex items-start gap-3.5">
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
            isWarningStyle
              ? 'bg-[#27272A] border border-[#FACC15]/30 text-[#FACC15]'
              : 'bg-rose-950/70 border border-rose-800 text-rose-400'
          }`}
        >
          {isWarningStyle ? (
            <AlertTriangle className="w-5 h-5 text-[#FACC15]" />
          ) : (
            <ShieldAlert className="w-5 h-5 text-rose-400" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <span
                className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded ${
                  isBlocked
                    ? 'bg-[#27272A] text-[#FACC15] border border-[#FACC15]/30'
                    : isSessionExpired
                    ? 'bg-[#27272A] text-[#FACC15] border border-[#FACC15]/30'
                    : isAccessDenied
                    ? 'bg-amber-950/60 text-amber-300 border border-amber-800'
                    : 'bg-rose-950/60 text-rose-300 border border-rose-800'
                }`}
              >
                {isBlocked
                  ? 'auth/popup-blocked'
                  : isSessionExpired
                  ? 'Сессия Google Drive истекла'
                  : isAccessDenied
                  ? 'OAuth 403 / access_denied'
                  : 'Ошибка авторизации'}
              </span>
              <h3 className="text-base font-semibold text-white mt-1.5 leading-snug">
                {isBlocked
                  ? 'Всплывающее окно заблокировано браузером'
                  : error.message}
              </h3>
            </div>

            <button
              id="dismiss-auth-error-btn"
              onClick={onDismiss}
              className="p-1 text-[#71717A] hover:text-white rounded-md transition cursor-pointer"
              title="Закрыть"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <p className="text-xs text-[#A1A1AA] mt-1.5 leading-relaxed">
            {isBlocked
              ? 'Так как приложение запущено во встроенном окне предпросмотра (iframe), браузер заблокировал всплывающее окно входа Google. Самый быстрый способ войти — открыть приложение в отдельной вкладке браузера.'
              : error.details || 'Попробуйте повторить попытку входа.'}
          </p>

          {/* Action buttons */}
          <div className="mt-4 flex flex-wrap items-center gap-2.5">
            <button
              id="auth-retry-signin-btn"
              type="button"
              onClick={onRetry}
              disabled={isRetrying}
              className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                isWarningStyle
                  ? 'bg-[#FACC15] text-black hover:bg-yellow-400 shadow-sm'
                  : 'bg-rose-950/80 hover:bg-rose-900 text-rose-200 border border-rose-800'
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRetrying ? 'animate-spin' : ''}`} />
              {isRetrying
                ? 'Подключение...'
                : isSessionExpired
                ? 'Обновить сессию Google Drive'
                : 'Войти в Google Drive'}
            </button>

            {isBlocked && (
              <button
                id="auth-open-new-tab-btn"
                type="button"
                onClick={openInNewTab}
                className="px-3.5 py-2 rounded-lg text-xs font-semibold bg-[#27272A] hover:bg-[#3F3F46] text-white border border-[#3F3F46] flex items-center gap-1.5 transition cursor-pointer"
              >
                <ExternalLink className="w-3.5 h-3.5 text-white" />
                Открыть в новой вкладке
              </button>
            )}

            {isAccessDenied && (
              <div className="w-full mt-3 p-3 bg-[#27272A]/70 rounded-xl border border-amber-500/30 text-xs text-[#D4D4D8] space-y-1.5">
                <p className="font-medium text-[#FACC15]">💡 Если отображается «Приложение не проверено»:</p>
                <p>1. В появившемся окне Google нажмите <strong>«Дополнительные настройки»</strong> (Advanced).</p>
                <p>2. Нажмите внизу ссылку <strong>«Перейти на страницу (небезопасно)»</strong> (Go to unsafe).</p>
                <p>3. Предоставьте разрешение на просмотр файлов Google Диска.</p>
              </div>
            )}

            {isBlocked && (
              <button
                type="button"
                onClick={() => setShowInstructions((prev) => !prev)}
                className="px-3 py-2 rounded-lg text-xs font-medium text-[#A1A1AA] hover:text-white hover:bg-[#27272A] flex items-center gap-1 transition cursor-pointer"
              >
                <span>Как разрешить в этом окне</span>
                {showInstructions ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </button>
            )}
          </div>

          {/* Detailed instructions for allowing popups in browser */}
          {isBlocked && showInstructions && (
            <div className="mt-4 p-3.5 bg-[#131316] rounded-xl border border-[#27272A] text-xs text-[#A1A1AA] space-y-2">
              <div className="font-semibold text-white flex items-center gap-1.5">
                <span>Как разрешить всплывающие окна в браузере:</span>
              </div>
              <ol className="list-decimal list-inside space-y-1.5 text-[#71717A] pl-0.5">
                <li>
                  Посмотрите на <strong className="text-white">адресную строку браузера</strong> (в правом углу, рядом со значком закладки).
                </li>
                <li>
                  Нажмите на значок <strong className="text-[#FACC15]">«Всплывающее окно заблокировано»</strong> (квадрат с красным крестиком).
                </li>
                <li>
                  Выберите <strong className="text-white">«Всегда разрешать всплывающие окна и перенаправления для этого сайта»</strong>.
                </li>
                <li>
                  Нажмите кнопку <strong className="text-white">«Готово»</strong>, затем нажмите кнопку <strong className="text-white">«Попробовать снова»</strong> выше.
                </li>
              </ol>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
