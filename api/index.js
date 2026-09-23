let handlerPromise = null;

async function loadPreviewHandler() {
  if (!handlerPromise) {
    handlerPromise = import("../generated/preview-api-runtime.mjs")
      .then((loaded) => {
        const handler = loaded && loaded.default;
        if (typeof handler !== "function") {
          throw new TypeError(
            "Vercel preview runtime did not export a default request handler",
          );
        }
        return handler;
      })
      .catch((error) => {
        handlerPromise = null;
        throw error;
      });
  }

  return handlerPromise;
}

export default async function handler(req, res) {
  try {
    const previewHandler = await loadPreviewHandler();
    return await previewHandler(req, res);
  } catch (error) {
    const missingEnvironmentVariables = [
      "DATABASE_URL",
      "SUPABASE_URL",
      "SUPABASE_ANON_KEY",
      "SESSION_SECRET",
    ].filter((name) => !process.env[name]);

    console.error("[Vercel Preview Bootstrap] initialization failed", {
      message: error instanceof Error ? error.message : String(error),
      missingEnvironmentVariables,
      vercelEnv: process.env.VERCEL_ENV || null,
    });

    res.status(500).json({
      error: "PREVIEW_BOOTSTRAP_FAILED",
      missingEnvironmentVariables,
      message:
        process.env.VERCEL_ENV === "preview"
          ? error instanceof Error
            ? error.message
            : String(error)
          : "Preview API bootstrap failed",
    });
  }
}
