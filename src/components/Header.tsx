import { DriveUser } from '../types';
import { LogOut, RefreshCw, HardDrive, ShieldCheck, ExternalLink } from 'lucide-react';

interface HeaderProps {
  user: DriveUser | null;
  onSignOut: () => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  onSignIn?: () => void;
  isSigningIn?: boolean;
}

export function Header({
  user,
  onSignOut,
  onRefresh,
  isRefreshing,
  onSignIn,
  isSigningIn,
}: HeaderProps) {
  const isInIframe = typeof window !== 'undefined' && window.self !== window.top;

  return (
    <header className="bg-[#09090B] border-b border-[#1F1F23] sticky top-0 z-30">
      <div className="max-w-6xl mx-auto px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center space-x-3.5">
          <div className="w-8 h-8 rounded-md bg-[#FACC15] flex items-center justify-center text-black font-bold shadow-xs">
            <HardDrive className="w-4 h-4 text-black" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-semibold text-white tracking-tight leading-tight">
                Work Drive Explorer
              </h1>
              <span className="hidden sm:inline-block px-1.5 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider bg-[#18181B] border border-[#27272A] text-[#FACC15]">
                v3
              </span>
            </div>
            <p className="text-[11px] text-[#52525B] flex items-center gap-1.5 mt-0.5 font-medium">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#FACC15]"></span>
              Google Drive
              {user && (
                <span className="inline-flex items-center gap-1 text-[#71717A]">
                  <ShieldCheck className="w-3 h-3 text-emerald-400" />
                  Read-only
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2.5">
          {isInIframe && (
            <a
              id="header-open-tab-btn"
              href={typeof window !== 'undefined' ? window.location.href : '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden md:flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#71717A] hover:text-white bg-[#18181B] border border-[#27272A] hover:border-[#3F3F46] transition"
              title="Открыть приложение в новой вкладке браузера"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>В новой вкладке</span>
            </a>
          )}

          {user ? (
            <>
              <button
                id="refresh-drive-btn"
                onClick={onRefresh}
                disabled={isRefreshing}
                className="p-2 text-[#71717A] hover:text-white hover:bg-[#18181B] border border-transparent hover:border-[#27272A] rounded-lg transition-colors cursor-pointer"
                title="Обновить данные"
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-[#FACC15]' : ''}`} />
              </button>

              <div className="flex items-center pl-2 border-l border-[#1F1F23] space-x-2.5">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || 'User'}
                    className="w-8 h-8 rounded-full border border-[#27272A]"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-[#27272A] text-[#FACC15] font-semibold flex items-center justify-center text-xs border border-[#3F3F46]">
                    {(user.displayName || user.email || 'U').charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="hidden sm:block text-left">
                  <p className="text-xs font-medium text-white leading-tight">
                    {user.displayName || 'Пользователь'}
                  </p>
                  <p className="text-[11px] text-[#52525B] leading-tight max-w-[150px] truncate">
                    {user.email}
                  </p>
                </div>
                <button
                  id="sign-out-btn"
                  onClick={onSignOut}
                  className="p-1.5 text-[#52525B] hover:text-rose-400 hover:bg-[#18181B] border border-transparent hover:border-rose-900/30 rounded-lg transition-colors cursor-pointer"
                  title="Выйти"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </>
          ) : onSignIn ? (
            <button
              id="header-signin-btn"
              onClick={onSignIn}
              disabled={isSigningIn}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#27272A] hover:bg-[#3F3F46] text-white border border-[#3F3F46] transition flex items-center gap-1.5 cursor-pointer"
            >
              {isSigningIn ? (
                <>
                  <RefreshCw className="w-3 h-3 animate-spin text-[#FACC15]" />
                  <span>Вход...</span>
                </>
              ) : (
                <span>Войти</span>
              )}
            </button>
          ) : (
            <span className="text-xs text-[#71717A] bg-[#18181B] border border-[#27272A] px-2.5 py-1 rounded-md">
              Авторизация Google
            </span>
          )}
        </div>
      </div>
    </header>
  );
}

