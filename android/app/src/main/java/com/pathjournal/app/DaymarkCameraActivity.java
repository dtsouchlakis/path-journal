package com.pathjournal.app;

import android.app.Activity;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import android.graphics.Matrix;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.util.Size;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.TextView;
import android.widget.Toast;
import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.camera.core.CameraSelector;
import androidx.camera.core.ImageCapture;
import androidx.camera.core.ImageCaptureException;
import androidx.camera.core.Preview;
import androidx.camera.core.resolutionselector.ResolutionSelector;
import androidx.camera.core.resolutionselector.ResolutionStrategy;
import androidx.camera.lifecycle.ProcessCameraProvider;
import androidx.camera.view.PreviewView;
import androidx.core.content.ContextCompat;
import androidx.exifinterface.media.ExifInterface;
import com.google.common.util.concurrent.ListenableFuture;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** A small in-process camera that avoids handing the foreground to Samsung Camera. */
public class DaymarkCameraActivity extends AppCompatActivity {
    public static final String EXTRA_OUTPUT_PATH = "daymark-output-path";
    private static final int MAX_OUTPUT_EDGE = 1000;

    private final ExecutorService cameraExecutor = Executors.newSingleThreadExecutor();
    private PreviewView previewView;
    private ImageCapture imageCapture;
    private Button shutterButton;
    private TextView statusText;
    private File outputFile;
    private boolean captureStarted;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        String outputPath = getIntent().getStringExtra(EXTRA_OUTPUT_PATH);
        if (outputPath == null) {
            finishWithFailure("The photo destination was lost");
            return;
        }
        outputFile = new File(outputPath);
        buildCameraLayout();
        startCamera();
    }

    private void buildCameraLayout() {
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.rgb(7, 26, 58));

        previewView = new PreviewView(this);
        previewView.setImplementationMode(PreviewView.ImplementationMode.COMPATIBLE);
        previewView.setScaleType(PreviewView.ScaleType.FILL_CENTER);
        root.addView(previewView, new FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.MATCH_PARENT
        ));

        Button closeButton = new Button(this);
        closeButton.setText("×");
        closeButton.setTextSize(32);
        closeButton.setTextColor(Color.WHITE);
        closeButton.setGravity(Gravity.CENTER);
        closeButton.setPadding(0, 0, 0, 4);
        closeButton.setBackground(circle(Color.argb(150, 7, 26, 58), 0, Color.TRANSPARENT));
        closeButton.setOnClickListener(view -> cancelCapture());
        FrameLayout.LayoutParams closeParams = new FrameLayout.LayoutParams(dp(52), dp(52), Gravity.TOP | Gravity.START);
        closeParams.setMargins(dp(20), dp(24), 0, 0);
        root.addView(closeButton, closeParams);

        statusText = new TextView(this);
        statusText.setText("Getting camera ready…");
        statusText.setTextColor(Color.WHITE);
        statusText.setTextSize(15);
        statusText.setGravity(Gravity.CENTER);
        statusText.setBackground(rounded(Color.argb(150, 7, 26, 58), dp(18)));
        statusText.setPadding(dp(18), dp(8), dp(18), dp(8));
        FrameLayout.LayoutParams statusParams = new FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.WRAP_CONTENT,
            ViewGroup.LayoutParams.WRAP_CONTENT,
            Gravity.TOP | Gravity.CENTER_HORIZONTAL
        );
        statusParams.topMargin = dp(32);
        root.addView(statusText, statusParams);

        shutterButton = new Button(this);
        shutterButton.setEnabled(false);
        shutterButton.setContentDescription("Take photo");
        shutterButton.setBackground(circle(Color.WHITE, dp(5), Color.rgb(60, 139, 255)));
        shutterButton.setOnClickListener(view -> takePhoto());
        FrameLayout.LayoutParams shutterParams = new FrameLayout.LayoutParams(dp(78), dp(78), Gravity.BOTTOM | Gravity.CENTER_HORIZONTAL);
        shutterParams.bottomMargin = dp(42);
        root.addView(shutterButton, shutterParams);

        setContentView(root);
    }

    private void startCamera() {
        ListenableFuture<ProcessCameraProvider> providerFuture = ProcessCameraProvider.getInstance(this);
        providerFuture.addListener(() -> {
            try {
                ProcessCameraProvider provider = providerFuture.get();
                Preview preview = new Preview.Builder().build();
                preview.setSurfaceProvider(previewView.getSurfaceProvider());

                ResolutionSelector resolutionSelector = new ResolutionSelector.Builder()
                    .setResolutionStrategy(new ResolutionStrategy(
                        new Size(900, 1200),
                        ResolutionStrategy.FALLBACK_RULE_CLOSEST_LOWER_THEN_HIGHER
                    ))
                    .build();
                imageCapture = new ImageCapture.Builder()
                    .setCaptureMode(ImageCapture.CAPTURE_MODE_MINIMIZE_LATENCY)
                    .setJpegQuality(76)
                    .setResolutionSelector(resolutionSelector)
                    .setTargetRotation(previewView.getDisplay().getRotation())
                    .build();

                provider.unbindAll();
                provider.bindToLifecycle(this, CameraSelector.DEFAULT_BACK_CAMERA, preview, imageCapture);
                shutterButton.setEnabled(true);
                statusText.setVisibility(View.GONE);
            } catch (Exception error) {
                finishWithFailure("The camera could not start");
            }
        }, ContextCompat.getMainExecutor(this));
    }

    private void takePhoto() {
        if (captureStarted || imageCapture == null) return;
        captureStarted = true;
        shutterButton.setEnabled(false);
        statusText.setText("Saving photo…");
        statusText.setVisibility(View.VISIBLE);

        File rawFile = new File(outputFile.getAbsolutePath() + ".raw");
        ImageCapture.OutputFileOptions options = new ImageCapture.OutputFileOptions.Builder(rawFile).build();
        imageCapture.takePicture(options, cameraExecutor, new ImageCapture.OnImageSavedCallback() {
            @Override
            public void onImageSaved(@NonNull ImageCapture.OutputFileResults result) {
                try {
                    writeBoundedJpeg(rawFile, outputFile);
                    rawFile.delete();
                    PendingCaptureStore.markReady(DaymarkCameraActivity.this, outputFile);
                    runOnUiThread(() -> {
                        setResult(Activity.RESULT_OK);
                        finish();
                    });
                } catch (Exception error) {
                    rawFile.delete();
                    runOnUiThread(() -> finishWithFailure("The photo could not be saved"));
                }
            }

            @Override
            public void onError(@NonNull ImageCaptureException error) {
                rawFile.delete();
                runOnUiThread(() -> finishWithFailure("The photo could not be captured"));
            }
        });
    }

    private void writeBoundedJpeg(File source, File destination) throws IOException {
        BitmapFactory.Options bounds = new BitmapFactory.Options();
        bounds.inJustDecodeBounds = true;
        BitmapFactory.decodeFile(source.getAbsolutePath(), bounds);
        int sampleSize = 1;
        while (Math.max(bounds.outWidth, bounds.outHeight) / (sampleSize * 2) >= MAX_OUTPUT_EDGE) sampleSize *= 2;

        BitmapFactory.Options decode = new BitmapFactory.Options();
        decode.inSampleSize = sampleSize;
        Bitmap sampled = BitmapFactory.decodeFile(source.getAbsolutePath(), decode);
        if (sampled == null) throw new IOException("Camera JPEG could not be decoded");

        Bitmap oriented = rotateFromExif(sampled, source);
        if (oriented != sampled) sampled.recycle();
        float scale = Math.min(1f, (float) MAX_OUTPUT_EDGE / Math.max(oriented.getWidth(), oriented.getHeight()));
        Bitmap bounded = scale < 1f
            ? Bitmap.createScaledBitmap(oriented, Math.round(oriented.getWidth() * scale), Math.round(oriented.getHeight() * scale), true)
            : oriented;
        if (bounded != oriented) oriented.recycle();

        File temporary = new File(destination.getAbsolutePath() + ".tmp");
        try (FileOutputStream output = new FileOutputStream(temporary)) {
            if (!bounded.compress(Bitmap.CompressFormat.JPEG, 76, output)) throw new IOException("JPEG compression failed");
        } finally {
            bounded.recycle();
        }
        if (destination.exists() && !destination.delete()) throw new IOException("Old camera output could not be removed");
        if (!temporary.renameTo(destination)) {
            copyFile(temporary, destination);
            temporary.delete();
        }
    }

    private Bitmap rotateFromExif(Bitmap bitmap, File source) throws IOException {
        int orientation = new ExifInterface(source).getAttributeInt(
            ExifInterface.TAG_ORIENTATION,
            ExifInterface.ORIENTATION_NORMAL
        );
        float degrees = switch (orientation) {
            case ExifInterface.ORIENTATION_ROTATE_90 -> 90f;
            case ExifInterface.ORIENTATION_ROTATE_180 -> 180f;
            case ExifInterface.ORIENTATION_ROTATE_270 -> 270f;
            default -> 0f;
        };
        if (degrees == 0f) return bitmap;
        Matrix matrix = new Matrix();
        matrix.postRotate(degrees);
        return Bitmap.createBitmap(bitmap, 0, 0, bitmap.getWidth(), bitmap.getHeight(), matrix, true);
    }

    private void copyFile(File source, File destination) throws IOException {
        byte[] buffer = new byte[16 * 1024];
        try (FileInputStream input = new FileInputStream(source); FileOutputStream output = new FileOutputStream(destination)) {
            int count;
            while ((count = input.read(buffer)) != -1) output.write(buffer, 0, count);
        }
    }

    private void cancelCapture() {
        if (captureStarted) return;
        PendingCaptureStore.discard(this);
        setResult(Activity.RESULT_CANCELED);
        finish();
    }

    private void finishWithFailure(String message) {
        PendingCaptureStore.discard(this);
        Toast.makeText(this, message, Toast.LENGTH_SHORT).show();
        setResult(Activity.RESULT_CANCELED);
        finish();
    }

    @Override
    public void onBackPressed() {
        cancelCapture();
    }

    @Override
    protected void onDestroy() {
        cameraExecutor.shutdown();
        super.onDestroy();
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    private GradientDrawable circle(int fill, int strokeWidth, int strokeColor) {
        GradientDrawable drawable = new GradientDrawable();
        drawable.setShape(GradientDrawable.OVAL);
        drawable.setColor(fill);
        if (strokeWidth > 0) drawable.setStroke(strokeWidth, strokeColor);
        return drawable;
    }

    private GradientDrawable rounded(int fill, int radius) {
        GradientDrawable drawable = new GradientDrawable();
        drawable.setColor(fill);
        drawable.setCornerRadius(radius);
        return drawable;
    }
}
