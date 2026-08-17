package com.pathjournal.app;

import android.content.Context;
import android.content.SharedPreferences;
import java.io.File;
import java.io.IOException;
import java.util.UUID;

/** Owns the small durable hand-off between CameraX and the WebView process. */
final class PendingCaptureStore {
    private static final String PREFERENCES = "daymark-camera";
    private static final String PATH = "pending-path";
    private static final String READY = "pending-ready";

    private PendingCaptureStore() {}

    static File begin(Context context) throws IOException {
        discard(context);
        File directory = new File(context.getCacheDir(), "daymark-captures");
        if (!directory.exists() && !directory.mkdirs()) {
            throw new IOException("Could not create camera cache");
        }
        File output = new File(directory, "capture-" + UUID.randomUUID() + ".jpg");
        preferences(context).edit().putString(PATH, output.getAbsolutePath()).putBoolean(READY, false).commit();
        return output;
    }

    static void markReady(Context context, File output) {
        // Commit before returning from the camera. If Android recreates the WebView
        // immediately afterward, startup can still recover this exact file.
        preferences(context).edit().putString(PATH, output.getAbsolutePath()).putBoolean(READY, true).commit();
    }

    static File readyFile(Context context) {
        SharedPreferences preferences = preferences(context);
        if (!preferences.getBoolean(READY, false)) return null;
        String path = preferences.getString(PATH, null);
        if (path == null) return null;
        File file = new File(path);
        return file.isFile() ? file : null;
    }

    static void discard(Context context) {
        String path = preferences(context).getString(PATH, null);
        if (path != null) {
            File output = new File(path);
            delete(output);
            delete(new File(path + ".raw"));
            delete(new File(path + ".tmp"));
        }
        preferences(context).edit().clear().commit();
    }

    private static SharedPreferences preferences(Context context) {
        return context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE);
    }

    private static void delete(File file) {
        if (file.exists()) file.delete();
    }
}
