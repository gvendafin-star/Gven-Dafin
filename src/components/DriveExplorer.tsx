import { useState, FormEvent } from 'react';
import { DriveFile, BreadcrumbItem } from '../types';
import {
  FOLDER_MIME_TYPE,
  formatFileSize,
  formatDate,
  getFileCategory,
} from '../lib/drive';
import {
  Folder,
  FolderOpen,
  FileText,
  FileSpreadsheet,
  Presentation,
  FileCode,
  FileArchive,
  Film,
  Music,
  Image as ImageIcon,
  File,
  ChevronRight,
  ExternalLink,
  Search,
  LayoutGrid,
  List,
  Info,
  X,
  ArrowUp,
  Download,
  Sparkles,
} from 'lucide-react';

interface DriveExplorerProps {
  currentFolder: BreadcrumbItem | null;
  breadcrumbs: BreadcrumbItem[];
  files: DriveFile[];
  isLoading: boolean;
  onNavigateFolder: (folderId: string, folderName: string) => void;
  onNavigateBreadcrumb: (index: number) => void;
  onSearch: (query: string) => void;
  searchQuery: string;
  isSearching: boolean;
  onClearSearch: () => void;
  onInvestigateProject?: () => void;
}

export function DriveExplorer({
  currentFolder,
  breadcrumbs,
  files,
  isLoading,
  onNavigateFolder,
  onNavigateBreadcrumb,
  onSearch,
  searchQuery,
  isSearching,
  onClearSearch,
  onInvestigateProject,
}: DriveExplorerProps) {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedFile, setSelectedFile] = useState<DriveFile | null>(null);
  const [inputSearch, setInputSearch] = useState('');

  const handleSearchSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (inputSearch.trim()) {
      onSearch(inputSearch.trim());
    }
  };

  const getFileIcon = (mimeType: string, className = 'w-5 h-5') => {
    if (mimeType === FOLDER_MIME_TYPE) {
      return <Folder className={`${className} text-amber-500 fill-amber-100`} />;
    }
    if (mimeType.includes('document') || mimeType.includes('text')) {
      return <FileText className={`${className} text-blue-500`} />;
    }
    if (mimeType.includes('spreadsheet') || mimeType.includes('sheet') || mimeType.includes('csv')) {
      return <FileSpreadsheet className={`${className} text-emerald-600`} />;
    }
    if (mimeType.includes('presentation')) {
      return <Presentation className={`${className} text-orange-500`} />;
    }
    if (mimeType.includes('pdf')) {
      return <FileText className={`${className} text-rose-500`} />;
    }
    if (mimeType.includes('image')) {
      return <ImageIcon className={`${className} text-violet-500`} />;
    }
    if (mimeType.includes('video')) {
      return <Film className={`${className} text-red-500`} />;
    }
    if (mimeType.includes('audio')) {
      return <Music className={`${className} text-pink-500`} />;
    }
    if (mimeType.includes('zip') || mimeType.includes('archive')) {
      return <FileArchive className={`${className} text-yellow-600`} />;
    }
    if (mimeType.includes('json') || mimeType.includes('javascript') || mimeType.includes('html')) {
      return <FileCode className={`${className} text-cyan-600`} />;
    }
    return <File className={`${className} text-slate-500`} />;
  };

  const folders = files.filter((f) => f.mimeType === FOLDER_MIME_TYPE);
  const regularFiles = files.filter((f) => f.mimeType !== FOLDER_MIME_TYPE);

  return (
    <div className="bg-[#18181B] rounded-2xl border border-[#27272A] shadow-xs overflow-hidden">
      {/* Top Toolbar: Search & View Controls */}
      <div className="p-4 border-b border-[#27272A] flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-[#09090B]">
        <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-[#52525B] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            id="drive-search-input"
            type="text"
            placeholder="Поиск по всему Google Диску..."
            value={inputSearch}
            onChange={(e) => setInputSearch(e.target.value)}
            className="w-full pl-10 pr-20 py-2 text-xs text-white bg-[#18181B] border border-[#27272A] rounded-lg focus:outline-none focus:border-[#FACC15] focus:ring-1 focus:ring-[#FACC15]/20 transition placeholder-[#52525B]"
          />
          {inputSearch && (
            <button
              type="button"
              onClick={() => {
                setInputSearch('');
                if (searchQuery) onClearSearch();
              }}
              className="absolute right-14 top-1/2 -translate-y-1/2 text-[#52525B] hover:text-white p-1 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            type="submit"
            className="absolute right-1.5 top-1/2 -translate-y-1/2 px-2.5 py-1 text-[11px] font-semibold bg-[#27272A] hover:bg-[#3F3F46] text-white border border-[#3F3F46] rounded-md transition cursor-pointer uppercase tracking-tight"
          >
            Найти
          </button>
        </form>

        <div className="flex items-center justify-between sm:justify-end gap-2 flex-wrap">
          {onInvestigateProject && (
            <button
              id="toolbar-investigate-btn"
              type="button"
              onClick={onInvestigateProject}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#27272A] hover:bg-[#FACC15] hover:text-black border border-[#FACC15]/40 text-[#FACC15] flex items-center gap-1.5 transition cursor-pointer"
              title="Исследовать проект в этой папке с помощью Gemini AI"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Исследовать проект (AI)</span>
            </button>
          )}

          {searchQuery && (
            <div className="flex items-center gap-1.5 text-xs bg-[#18181B] text-[#FACC15] border border-[#FACC15]/30 px-2.5 py-1 rounded-md font-medium">
              <span>Поиск: «{searchQuery}»</span>
              <button
                onClick={onClearSearch}
                className="hover:text-white p-0.5 cursor-pointer"
                title="Сбросить поиск"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          <div className="flex items-center bg-[#131316] p-0.5 rounded-lg border border-[#27272A]">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-md text-xs font-medium transition cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-[#27272A] text-white border border-[#3F3F46] shadow-xs'
                  : 'text-[#52525B] hover:text-[#A1A1AA]'
              }`}
              title="Сетка"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-md text-xs font-medium transition cursor-pointer ${
                viewMode === 'list'
                  ? 'bg-[#27272A] text-white border border-[#3F3F46] shadow-xs'
                  : 'text-[#52525B] hover:text-[#A1A1AA]'
              }`}
              title="Список"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Breadcrumbs Navigation */}
      <div className="px-4 sm:px-6 py-3 bg-[#131316] border-b border-[#27272A] flex items-center gap-2 text-xs overflow-x-auto">
        <span className="text-[10px] uppercase tracking-widest text-[#52525B] font-bold shrink-0">Путь:</span>
        {breadcrumbs.map((crumb, idx) => {
          const isLast = idx === breadcrumbs.length - 1;
          return (
            <div key={crumb.id} className="flex items-center gap-2 shrink-0">
              {idx > 0 && <span className="text-[#52525B]">/</span>}
              <button
                id={`crumb-${crumb.id}`}
                onClick={() => onNavigateBreadcrumb(idx)}
                disabled={isLast}
                className={`font-medium transition-colors cursor-pointer ${
                  isLast
                    ? 'text-white font-semibold cursor-default'
                    : 'text-[#71717A] hover:text-[#FACC15]'
                }`}
              >
                {crumb.name}
              </button>
            </div>
          );
        })}
      </div>

      {/* Main Content Area */}
      <div className="p-4 sm:p-6 min-h-[320px] bg-[#09090B]">
        {isLoading ? (
          <div className="py-16 text-center">
            <div className="w-8 h-8 mx-auto rounded-full border-2 border-[#FACC15] border-t-transparent animate-spin mb-3"></div>
            <p className="text-sm text-[#52525B]">Загрузка файлов...</p>
          </div>
        ) : files.length === 0 ? (
          <div className="py-16 text-center max-w-sm mx-auto">
            <div className="w-12 h-12 mx-auto rounded-xl bg-[#18181B] border border-[#27272A] flex items-center justify-center text-[#52525B] mb-3">
              <FolderOpen className="w-6 h-6" />
            </div>
            <h4 className="text-base font-semibold text-white mb-1">
              В этой папке пусто
            </h4>
            <p className="text-xs text-[#52525B]">
              В выбранной папке пока нет файлов или они не соответствуют текущему запросу.
            </p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="space-y-6">
            {/* Folders Section */}
            {folders.length > 0 && (
              <div>
                <p className="text-[10px] uppercase tracking-widest text-[#52525B] font-bold mb-3">
                  Папки ({folders.length})
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3.5">
                  {folders.map((folder) => (
                    <div
                      key={folder.id}
                      id={`folder-grid-${folder.id}`}
                      onClick={() => onNavigateFolder(folder.id, folder.name)}
                      className="group bg-[#18181B] border border-[#27272A] rounded-xl p-4 hover:border-[#FACC15] transition-colors cursor-pointer flex items-center gap-3"
                    >
                      <div className="w-9 h-9 rounded-lg bg-[#27272A] border border-[#3F3F46] flex items-center justify-center shrink-0 text-[#FACC15]">
                        <Folder className="w-5 h-5 text-[#FACC15]" />
                      </div>
                      <span className="text-xs font-medium text-white group-hover:text-[#FACC15] truncate flex-1 transition-colors">
                        {folder.name}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Files Section */}
            {regularFiles.length > 0 && (
              <div>
                <p className="text-[10px] uppercase tracking-widest text-[#52525B] font-bold mb-3">
                  Файлы ({regularFiles.length})
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {regularFiles.map((file) => {
                    const category = getFileCategory(file.mimeType);
                    return (
                      <div
                        key={file.id}
                        id={`file-grid-${file.id}`}
                        onClick={() => setSelectedFile(file)}
                        className="group bg-[#18181B] border border-[#27272A] rounded-xl p-4 hover:border-[#FACC15] transition-colors cursor-pointer flex flex-col justify-between"
                      >
                        <div className="flex items-start justify-between gap-2 mb-3">
                          <div className="w-10 h-10 rounded-lg bg-[#27272A] border border-[#3F3F46] flex items-center justify-center shrink-0">
                            {getFileIcon(file.mimeType, 'w-5 h-5')}
                          </div>
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded font-medium ${category.color}`}
                          >
                            {category.badge}
                          </span>
                        </div>

                        <div>
                          <p
                            className="text-xs font-medium text-white group-hover:text-[#FACC15] transition-colors truncate mb-1"
                            title={file.name}
                          >
                            {file.name}
                          </p>
                          <div className="flex items-center justify-between text-[10px] text-[#52525B]">
                            <span>{formatFileSize(file.size)}</span>
                            <span>{formatDate(file.modifiedTime)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* List View */
          <div className="divide-y divide-[#1F1F23] border border-[#27272A] rounded-xl overflow-hidden bg-[#131316]">
            {files.map((file) => {
              const isFolder = file.mimeType === FOLDER_MIME_TYPE;
              const category = getFileCategory(file.mimeType);

              return (
                <div
                  key={file.id}
                  id={`file-list-${file.id}`}
                  onClick={() =>
                    isFolder
                      ? onNavigateFolder(file.id, file.name)
                      : setSelectedFile(file)
                  }
                  className="px-4 py-3 flex items-center justify-between hover:bg-[#18181B] transition cursor-pointer group"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1 pr-4">
                    <div className="shrink-0">{getFileIcon(file.mimeType)}</div>
                    <span className="text-sm font-medium text-white group-hover:text-[#FACC15] transition-colors truncate">
                      {file.name}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-[#52525B] shrink-0">
                    <span className={`px-2 py-0.5 rounded font-medium ${category.color}`}>
                      {category.badge}
                    </span>
                    <span className="w-20 text-right hidden sm:inline text-[#71717A]">
                      {formatFileSize(file.size)}
                    </span>
                    <span className="w-32 text-right hidden md:inline text-[#52525B]">
                      {formatDate(file.modifiedTime)}
                    </span>
                    {file.webViewLink && (
                      <a
                        href={file.webViewLink}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="p-1 text-[#52525B] hover:text-white rounded transition"
                        title="Открыть в Google Диске"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* File Details Modal */}
      {selectedFile && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-[#18181B] rounded-2xl border border-[#27272A] shadow-2xl max-w-lg w-full p-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between gap-3 pb-4 border-b border-[#27272A]">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-lg bg-[#27272A] border border-[#3F3F46] flex items-center justify-center shrink-0">
                  {getFileIcon(selectedFile.mimeType, 'w-5 h-5')}
                </div>
                <div className="min-w-0">
                  <h3
                    className="text-base font-semibold text-white truncate"
                    title={selectedFile.name}
                  >
                    {selectedFile.name}
                  </h3>
                  <p className="text-xs text-[#52525B]">
                    {getFileCategory(selectedFile.mimeType).badge}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedFile(null)}
                className="p-1.5 text-[#52525B] hover:text-white rounded-lg hover:bg-[#27272A] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="py-4 space-y-3 text-xs">
              <div className="flex justify-between py-1.5 border-b border-[#27272A]/70">
                <span className="text-[#52525B]">Размер</span>
                <span className="font-medium text-white">
                  {formatFileSize(selectedFile.size)}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[#27272A]/70">
                <span className="text-[#52525B]">Последнее изменение</span>
                <span className="font-medium text-white">
                  {formatDate(selectedFile.modifiedTime)}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[#27272A]/70">
                <span className="text-[#52525B]">Тип MIME</span>
                <span className="font-mono text-[11px] text-[#A1A1AA] truncate max-w-[260px]">
                  {selectedFile.mimeType}
                </span>
              </div>
              {selectedFile.owners && selectedFile.owners[0] && (
                <div className="flex justify-between py-1.5 border-b border-[#27272A]/70">
                  <span className="text-[#52525B]">Владелец</span>
                  <span className="font-medium text-white">
                    {selectedFile.owners[0].displayName || selectedFile.owners[0].emailAddress}
                  </span>
                </div>
              )}
              <div className="flex justify-between py-1.5">
                <span className="text-[#52525B]">ID файла</span>
                <span className="font-mono text-[11px] text-[#71717A] truncate max-w-[260px]">
                  {selectedFile.id}
                </span>
              </div>
            </div>

            <div className="pt-4 border-t border-[#27272A] flex items-center justify-end gap-2.5">
              <button
                onClick={() => setSelectedFile(null)}
                className="px-4 py-2 text-xs font-medium text-[#A1A1AA] hover:text-white bg-[#27272A] hover:bg-[#3F3F46] rounded-md transition cursor-pointer"
              >
                Закрыть
              </button>
              {selectedFile.webViewLink && (
                <a
                  href={selectedFile.webViewLink}
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2 text-xs font-bold text-black bg-[#FACC15] hover:bg-yellow-400 rounded-md flex items-center gap-1.5 transition uppercase tracking-tight"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  В Google Drive
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
