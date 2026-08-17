package com.pathjournal.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(DaymarkCameraPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
