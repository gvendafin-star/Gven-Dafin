import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "15mb" }));

const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is not configured");
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
};

function formatGeminiError(err: any): string {
  const msg = typeof err?.message === "string" ? err.message : String(err || "");
  if (msg.includes("503") || msg.includes("UNAVAILABLE") || msg.includes("high demand")) {
    return "Модели Gemini AI сейчас испытывают временную высокую нагрузку (503). Пожалуйста, подождите пару секунд и нажмите «Попробовать снова».";
  }
  if (msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED") || msg.includes("quota")) {
    return "Временный лимит запросов Gemini исчерпан (429). Пожалуйста, подождите минуту и повторите попытку.";
  }
  if (msg.includes("GEMINI_API_KEY") || msg.includes("api key")) {
    return "Ключ Gemini API не настроен на сервере.";
  }
  return "Сервис Gemini временно недоступен. Пожалуйста, повторите попытку через несколько секунд.";
}

async function generateWithGeminiFallback(prompt: string): Promise<string> {
  const ai = getGeminiClient();
  // Try candidate models: gemini-3.8-flash first, then gemini-3.1-flash-lite, then gemini-flash-latest
  const candidateModels = ["gemini-3.8-flash", "gemini-3.1-flash-lite", "gemini-flash-latest"];
  let lastError: any = null;

  for (const model of candidateModels) {
    // Up to 2 retries with backoff for transient 503/429 spikes
    for (let attempt = 0; attempt <= 2; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: prompt,
        });
        if (response.text) {
          return response.text;
        }
      } catch (err: any) {
        lastError = err;
        const errMsg = typeof err?.message === "string" ? err.message : String(err);
        const isTransient =
          errMsg.includes("503") ||
          errMsg.includes("429") ||
          errMsg.includes("UNAVAILABLE") ||
          errMsg.includes("high demand") ||
          errMsg.includes("RESOURCE_EXHAUSTED");

        if (attempt < 2 && isTransient) {
          const delayMs = 1000 * Math.pow(2, attempt) + Math.floor(Math.random() * 500);
          await new Promise((res) => setTimeout(res, delayMs));
          continue;
        }
        // Move to next candidate model
        break;
      }
    }
  }

  throw new Error(formatGeminiError(lastError));
}

// Endpoint to analyze project structure and files with Gemini
app.post("/api/analyze-project", async (req, res) => {
  try {
    const { folderName, files } = req.body;

    if (!files || !Array.isArray(files)) {
      return res.status(400).json({ error: "Files array is required" });
    }

    // Prepare compact files summary for prompt (limit to 40 items)
    const fileListFormatted = files
      .slice(0, 40)
      .map((f: any) => `- ${f.path || f.name} (${f.mimeType || 'unknown'}, ${f.size || 'unknown size'})`)
      .join("\n");

    // Sample code contents: top 8 files, max 2500 chars each for fast, reliable processing
    const sampleContentsFormatted = files
      .filter((f: any) => f.sampleContent && f.sampleContent.trim().length > 0)
      .slice(0, 8)
      .map((f: any) => `### Файл: ${f.path || f.name}\n\`\`\`\n${f.sampleContent.slice(0, 2500)}\n\`\`\``)
      .join("\n\n");

    const prompt = `
Ты — опытный архитектор ПО и технический аудитор.
Пользователь просит исследовать проект, находящийся в папке "${folderName || 'work'}" на его Google Диске.

Вот список файлов и структура каталогов проекта:
${fileListFormatted || 'Список файлов пуст'}

Вот фрагменты содержимого ключевых файлов проекта:
${sampleContentsFormatted || 'Содержимое текстовых файлов отсутствует или файлы бинарные'}

Проанализируй этот проект и верни структурированный ответ на русском языке. Ответ должен быть информативным, полезным и профессиональным:

1. **Суть и назначение проекта**: Что это за проект, какую задачу он решает, для кого предназначен?
2. **Технологический стек и инструменты**: Языки программирования, фреймворки, библиотеки, системы сборки, базы данных или сервисы.
3. **Архитектура и структура**: Как организованы файлы и модули, логика разделения по папкам.
4. **Ключевые компоненты и файлы**: Описание важнейших файлов, точек входа, конфигураций.
5. **Текущий статус и готовность**: На какой стадии находится проект (прототип, MVP, продакшн, заброшен, разработка в процессе), есть ли тесты, документация.
6. **Рекомендации и дальнейшие шаги**: Что стоит улучшить, доработать, исправить или добавить в проект.

Оформи ответ в чистом, красивом Markdown с понятными заголовками, маркерами и акцентами. Будь конкретен на основе обнаруженных файлов.
`;

    const analysisText = await generateWithGeminiFallback(prompt);

    return res.json({
      success: true,
      analysis: analysisText,
      folderName: folderName || "work",
      filesCount: files.length,
    });
  } catch (error: any) {
    return res.status(500).json({
      error: error?.message || "Ошибка при анализе проекта с помощью Gemini AI",
    });
  }
});

// Endpoint for follow-up questions about the project
app.post("/api/ask-project", async (req, res) => {
  try {
    const { folderName, question, projectContext, filesSummary } = req.body;

    if (!question) {
      return res.status(400).json({ error: "Question is required" });
    }

    const prompt = `
Ты — технический эксперт по проекту "${folderName || 'work'}".
Контекст предыдущего анализа проекта:
${projectContext ? projectContext.slice(0, 2500) : 'Нет'}

Краткий обзор файлов проекта:
${filesSummary ? filesSummary.slice(0, 1000) : 'Нет'}

Вопрос пользователя о проекте:
${question}

Дай точный, понятный и полезный ответ на русском языке, опираясь на контекст проекта.
`;

    const answerText = await generateWithGeminiFallback(prompt);

    return res.json({
      success: true,
      answer: answerText,
    });
  } catch (error: any) {
    return res.status(500).json({
      error: error?.message || "Ошибка при ответе на вопрос",
    });
  }
});

// Vite middleware setup
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
