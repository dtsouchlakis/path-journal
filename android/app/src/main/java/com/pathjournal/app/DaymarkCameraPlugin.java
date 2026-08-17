package com.pathjournal.app;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.io.File;

@CapacitorPlugin(
    name = "DaymarkCamera",
    permissions = @Permission(alias = "camera", strings = { Manifest.permission.CAMERA })
)
public class DaymarkCameraPlugin extends Plugin {
    @PluginMethod
    public void takePhoto(PluginCall call) {
        if (getPermissionState("camera") != PermissionState.GRANTED) {
            requestPermissionForAlias("camera", call, "cameraPermissionResult");
            return;
        }
        launchCamera(call);
    }

    @PermissionCallback
    private void cameraPermissionResult(PluginCall call) {
        if (getPermissionState("camera") == PermissionState.GRANTED) launchCamera(call);
        else call.reject("Camera permission is required", "PERMISSION_DENIED");
    }

    private void launchCamera(PluginCall call) {
        try {
            File output = PendingCaptureStore.begin(getContext());
            Intent intent = new Intent(getContext(), DaymarkCameraActivity.class);
            intent.putExtra(DaymarkCameraActivity.EXTRA_OUTPUT_PATH, output.getAbsolutePath());
            startActivityForResult(call, intent, "cameraResult");
        } catch (Exception error) {
            PendingCaptureStore.discard(getContext());
            call.reject("The camera could not be prepared", error);
        }
    }

    @ActivityCallback
    private void cameraResult(PluginCall call, ActivityResult result) {
        File file = PendingCaptureStore.readyFile(getContext());
        if (result.getResultCode() == Activity.RESULT_OK && file != null) {
            call.resolve(photoResult(file));
            return;
        }
        PendingCaptureStore.discard(getContext());
        call.reject("Camera cancelled", "CANCELLED");
    }

    @PluginMethod
    public void getPendingPhoto(PluginCall call) {
        File file = PendingCaptureStore.readyFile(getContext());
        call.resolve(file == null ? new JSObject() : photoResult(file));
    }

    @PluginMethod
    public void acknowledgePhoto(PluginCall call) {
        PendingCaptureStore.discard(getContext());
        call.resolve();
    }

    private JSObject photoResult(File file) {
        JSObject result = new JSObject();
        result.put("path", file.getAbsolutePath());
        result.put("mimeType", "image/jpeg");
        return result;
    }
}
