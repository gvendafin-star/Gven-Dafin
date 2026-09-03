import React, { useState } from 'react';
import { Sparkles, X, Send, Bot, FileText, CheckCircle2, Loader2, AlertCircle, RefreshCw, FolderGit2 } from 'lucide-react';
import { ProjectInvestigationState, ProjectInvestigationResult } from '../types';

interface ProjectAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  investigation: ProjectInvestigationState;
  onRetryInvestigation: () => void;
}

export const ProjectAuditModal: React.FC<ProjectAuditModalProps> = ({
  isOpen,
  onClose,
  investigation,
  onRetryInvestigation,
}) => {
  const [question, setQuestion] = useState('');
  const [isAsking, setIsAsking] = useState(false);
  const [chatMessages, setChatMessages] = useState<Array<{ sender: 'user' | 'assistant'; text: string }>>([]);

  if (!isOpen) return null;

  const handleAskQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || isAsking) return;

    const userQ = question.trim();
    setQuestion('');
    setChatMessages((prev) => [...prev, { sender: 'user', text: userQ }]);
    setIsAsking(true);

    try {
      const res = await fetch('/api/ask-project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folderName: investigation.folderName || 'work',
          question: userQ,
          projectContext: investigation.result?.analysis || '',
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Не удалось получить ответ');
      }

      const data = await res.json();
      setChatMessages((prev) => [...prev, { sender: 'assistant', text: data.answer }]);
    } catch (err: any) {
      setChatMessages((prev) => [
        ...prev,
        { sender: 'assistant', text: `Ошибка: ${err.message || 'Сервис Gemini недоступен'}` },
      ]);
    } finally {
      setIsAsking(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs overflow-y-auto">
      <div className="bg-[#18181B] border border-[#27272A] rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-[#27272A] bg-[#121214] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#27272A] border border-[#FACC15]/30 text-[#FACC15] flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-[#FACC15]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#FACC15] bg-[#27272A] px-2 py-0.5 rounded border border-[#FACC15]/20">
                  AI Исследование
                </span>
                <span className="text-xs text-[#71717A]">Gemini 3.8 Flash</span>
              </div>
              <h2 className="text-base font-semibold text-white mt-0.5 flex items-center gap-2">
                <FolderGit2 className="w-4 h-4 text-[#FACC15]" />
                Проект «{investigation.folderName || 'work'}»
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-[#71717A] hover:text-white rounded-lg hover:bg-[#27272A] transition cursor-pointer"
            title="Закрыть"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Status: Scanning or Analyzing */}
          {(investigation.status === 'scanning' || investigation.status === 'analyzing') && (
            <div className="py-16 text-center space-y-4">
              <div className="relative w-14 h-14 mx-auto flex items-center justify-center">
                <div className="w-14 h-14 rounded-full border-2 border-[#FACC15] border-t-transparent animate-spin"></div>
                <Sparkles className="w-6 h-6 text-[#FACC15] absolute" />
              </div>
              <div>
                <h3 className="text-base font-medium text-white">
                  {investigation.status === 'scanning'
                    ? 'Сбор структуры и исходных файлов проекта...'
                    : 'Gemini анализирует архитектуру и код проекта...'}
                </h3>
                <p className="text-xs text-[#71717A] mt-1 max-w-md mx-auto">
                  {investigation.progressMessage || 'Читаем манифесты, конфигурации и исходный код в папке work'}
                </p>
              </div>
            </div>
          )}

          {/* Status: Error */}
          {investigation.status === 'error' && (
            <div className="p-5 rounded-xl bg-rose-950/30 border border-rose-800/40 text-rose-300 flex items-start gap-3.5">
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-white">Не удалось завершить исследование проекта</h4>
                <p className="text-xs text-rose-400 mt-1">{investigation.error}</p>
                <button
                  onClick={onRetryInvestigation}
                  className="mt-3 px-3.5 py-1.5 rounded-lg bg-rose-900/60 hover:bg-rose-900 text-xs font-semibold text-white flex items-center gap-1.5 transition cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Попробовать снова
                </button>
              </div>
            </div>
          )}

          {/* Status: Complete */}
          {investigation.status === 'complete' && investigation.result && (
            <div className="space-y-6">
              {/* Summary stat badge */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-[#121214] border border-[#27272A] rounded-xl text-xs">
                <div className="flex items-center gap-2 text-[#A1A1AA]">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>
                    Исследовано файлов в проекте:{' '}
                    <strong className="text-white">{investigation.result.filesCount}</strong>
                  </span>
                </div>
                <button
                  onClick={onRetryInvestigation}
                  className="text-xs text-[#FACC15] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Перезапустить исследование
                </button>
              </div>

              {/* Formatted Analysis text */}
              <div className="prose prose-invert max-w-none text-xs sm:text-sm text-[#D4D4D8] leading-relaxed space-y-3 bg-[#131316] p-5 sm:p-6 rounded-xl border border-[#27272A]/70 whitespace-pre-wrap font-sans">
                {investigation.result.analysis}
              </div>

              {/* Chat & Follow-up with Gemini about this project */}
              <div className="border-t border-[#27272A] pt-5 space-y-3">
                <h4 className="text-xs uppercase tracking-wider font-semibold text-[#A1A1AA] flex items-center gap-2">
                  <Bot className="w-4 h-4 text-[#FACC15]" />
                  Задать уточняющий вопрос о проекте
                </h4>

                {/* Conversation history */}
                {chatMessages.length > 0 && (
                  <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                    {chatMessages.map((msg, i) => (
                      <div
                        key={i}
                        className={`p-3 rounded-xl text-xs ${
                          msg.sender === 'user'
                            ? 'bg-[#27272A] text-white ml-6'
                            : 'bg-[#121214] border border-[#27272A] text-[#D4D4D8] mr-6 whitespace-pre-wrap'
                        }`}
                      >
                        <div className="text-[10px] uppercase tracking-wider font-bold mb-1 text-[#71717A]">
                          {msg.sender === 'user' ? 'Вы' : 'Gemini AI'}
                        </div>
                        {msg.text}
                      </div>
                    ))}
                  </div>
                )}

                <form onSubmit={handleAskQuestion} className="flex gap-2">
                  <input
                    type="text"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder="Например: как запустить этот проект? есть ли база данных?..."
                    disabled={isAsking}
                    className="flex-1 bg-[#121214] border border-[#27272A] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-[#52525B] focus:outline-none focus:border-[#FACC15]"
                  />
                  <button
                    type="submit"
                    disabled={isAsking || !question.trim()}
                    className="px-4 py-2.5 rounded-xl bg-[#FACC15] text-black font-semibold text-xs hover:bg-yellow-400 transition disabled:opacity-50 flex items-center gap-1.5 cursor-pointer uppercase tracking-tight"
                  >
                    {isAsking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    <span>Спросить</span>
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-[#27272A] bg-[#121214] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-[#A1A1AA] hover:text-white bg-[#27272A] hover:bg-[#3F3F46] rounded-xl transition cursor-pointer"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
};
