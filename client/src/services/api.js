import axios from "axios";

const PIPELINE_BASE_URL = "http://localhost:5000/api/pipeline";

const API = axios.create({
  baseURL: PIPELINE_BASE_URL,
});

const STREAM_UNAVAILABLE_CODE = "STREAM_UNAVAILABLE";

const createStreamUnavailableError = (message) => {
  const error = new Error(message);
  error.code = STREAM_UNAVAILABLE_CODE;
  return error;
};

const isAbortError = (error) =>
  error?.name === "AbortError" ||
  error?.code === "ERR_CANCELED" ||
  error?.message === "canceled";

const isStreamUnavailableError = (error) =>
  error?.code === STREAM_UNAVAILABLE_CODE;

export const analyzeFloorPlan = async (file, options = {}) => {
  const formData = new FormData();
  formData.append("floorPlan", file);

  const response = await API.post("/analyze", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
    signal: options.signal,
  });

  return response.data;
};

const streamAnalyzeFloorPlan = async (file, options = {}) => {
  if (typeof fetch !== "function") {
    throw createStreamUnavailableError("Fetch streaming is not supported");
  }

  if (typeof TextDecoder === "undefined") {
    throw createStreamUnavailableError("TextDecoder is not available");
  }

  const formData = new FormData();
  formData.append("floorPlan", file);

  const response = await fetch(`${PIPELINE_BASE_URL}/analyze/stream`, {
    method: "POST",
    body: formData,
    signal: options.signal,
  });

  if (!response.ok) {
    if ([404, 405, 501].includes(response.status)) {
      throw createStreamUnavailableError("Streaming endpoint is unavailable");
    }
    throw new Error("Unable to start analysis pipeline");
  }

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/x-ndjson")) {
    throw createStreamUnavailableError("Server did not return stream content");
  }

  if (!response.body) {
    throw createStreamUnavailableError(
      "Streaming is not supported by this browser",
    );
  }

  if (typeof response.body.getReader !== "function") {
    throw createStreamUnavailableError(
      "Readable stream reader is not supported",
    );
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  let pending = "";
  let finalResult = null;

  while (true) {
    const { value, done } = await reader.read();

    if (done) {
      break;
    }

    pending += decoder.decode(value, { stream: true });
    const lines = pending.split("\n");
    pending = lines.pop() ?? "";

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;

      const event = JSON.parse(line);
      if (options.onEvent) {
        options.onEvent(event);
      }

      if (event.type === "error") {
        throw new Error(event.message || "Pipeline failed");
      }

      if (event.type === "completed") {
        finalResult = event.result;
      }
    }
  }

  const trailing = pending.trim();
  if (trailing) {
    const event = JSON.parse(trailing);
    if (options.onEvent) {
      options.onEvent(event);
    }

    if (event.type === "error") {
      throw new Error(event.message || "Pipeline failed");
    }

    if (event.type === "completed") {
      finalResult = event.result;
    }
  }

  if (!finalResult) {
    throw new Error("Pipeline ended before a final result was produced");
  }

  return finalResult;
};

export const analyzeFloorPlanWithProgress = async (file, options = {}) => {
  try {
    return await streamAnalyzeFloorPlan(file, options);
  } catch (error) {
    if (isAbortError(error)) {
      throw error;
    }

    if (!isStreamUnavailableError(error)) {
      throw error;
    }

    if (options.onEvent) {
      options.onEvent({
        type: "mode_changed",
        mode: "fallback",
        message:
          "Live pipeline updates are unavailable. Continuing with standard analysis mode.",
      });
    }

    const fallbackResult = await analyzeFloorPlan(file, {
      signal: options.signal,
    });

    if (options.onEvent) {
      options.onEvent({
        type: "completed",
        mode: "fallback",
        result: fallbackResult,
      });
    }

    return fallbackResult;
  }
};

export const chatWithAssistant = async (payload) => {
  const response = await API.post("/chat", payload);
  return response.data;
};
