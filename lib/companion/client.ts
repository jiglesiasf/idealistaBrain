"use client";

import type { CreateJobResponse } from "@/lib/jobs/contracts";

type ChromeRuntimeLike = {
  lastError?: { message?: string };
  sendMessage?: (
    extensionId: string,
    message: unknown,
    callback: (response?: { ok?: boolean; error?: string; busy?: boolean; activeJobId?: string }) => void
  ) => void;
};

function getChromeRuntime(): ChromeRuntimeLike | null {
  const runtime = (
    globalThis as typeof globalThis & {
      chrome?: { runtime?: ChromeRuntimeLike };
    }
  ).chrome?.runtime;

  return runtime ?? null;
}

export function normalizeCompanionRuntimeError(message?: string) {
  if (!message) {
    return "No he podido contactar con el companion instalado.";
  }

  if (/message port closed before a response was received/i.test(message)) {
    return "Chrome ha podido encontrar la extension, pero el companion no ha respondido. Esto suele apuntar a la extension o a su service worker, no a un bloqueo de Idealista. Recarga la extension en chrome://extensions y vuelve a probar.";
  }

  if (/receiving end does not exist|could not establish connection/i.test(message)) {
    return "La web no encuentra una extension activa para este perfil de Chrome. Verifica que el companion este instalado, habilitado y recargado.";
  }

  return message;
}

function resolveExtensionId(): string {
  const injected = (
    globalThis as typeof globalThis & { __IDEALISTA_BRAIN_EXTENSION_ID__?: string }
  ).__IDEALISTA_BRAIN_EXTENSION_ID__;
  return injected || process.env.NEXT_PUBLIC_COMPANION_EXTENSION_ID || "";
}

export async function getCompanionStatus() {
  const extensionId = resolveExtensionId();
  const runtime = getChromeRuntime();

  if (!extensionId) {
    return { ok: false, error: "Falta configurar NEXT_PUBLIC_COMPANION_EXTENSION_ID." };
  }

  if (!runtime?.sendMessage) {
    return {
      ok: false,
      error: "Este navegador no puede hablar con la extension. Abre la web en Chrome, con el companion instalado y habilitado.",
    };
  }

  return await new Promise<{ ok: boolean; error?: string; busy?: boolean; activeJobId?: string }>((resolve) => {
    try {
      runtime.sendMessage?.(
        extensionId,
        {
          type: "IDEALISTA_BRAIN_PING",
        },
        (response) => {
          if (runtime.lastError?.message) {
            resolve({ ok: false, error: normalizeCompanionRuntimeError(runtime.lastError.message) });
            return;
          }

          if (!response?.ok) {
            resolve({ ok: false, error: "No he podido contactar con el companion instalado." });
            return;
          }

          resolve({
            ok: true,
            busy: Boolean(response.busy),
            activeJobId: response.activeJobId,
          });
        }
      );
    } catch (error) {
      resolve({
        ok: false,
        error: error instanceof Error ? error.message : "Error inesperado al comprobar el companion.",
      });
    }
  });
}

export async function pingCompanion() {
  const status = await getCompanionStatus();

  if (!status.ok) {
    return status;
  }

  if (status.busy) {
    return {
      ok: false,
      error: status.activeJobId
        ? `El companion ya esta ocupado con el job ${status.activeJobId}.`
        : "El companion esta ocupado ahora mismo.",
    };
  }

  return { ok: true };
}

export async function dispatchToCompanion(payload: CreateJobResponse["dispatch"]) {
  const extensionId = resolveExtensionId();
  const runtime = getChromeRuntime();

  if (!extensionId) {
    return { ok: false, error: "Falta configurar NEXT_PUBLIC_COMPANION_EXTENSION_ID." };
  }

  if (!runtime?.sendMessage) {
    return { ok: false, error: "El runtime del companion no esta disponible en este navegador." };
  }

  return await new Promise<{ ok: boolean; error?: string }>((resolve) => {
    try {
      runtime.sendMessage?.(
        extensionId,
        {
          type: "IDEALISTA_BRAIN_EXECUTE_JOB",
          payload,
        },
        (response) => {
          if (runtime.lastError?.message) {
            resolve({ ok: false, error: normalizeCompanionRuntimeError(runtime.lastError.message) });
            return;
          }

          if (!response?.ok) {
            resolve({ ok: false, error: response?.error ?? "El companion ha rechazado el job." });
            return;
          }

          resolve({ ok: true });
        }
      );
    } catch (error) {
      resolve({
        ok: false,
        error: error instanceof Error ? error.message : "Error inesperado al enviar el job al companion.",
      });
    }
  });
}
