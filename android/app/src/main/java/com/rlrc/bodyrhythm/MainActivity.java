package com.rlrc.bodyrhythm;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(DeviceRingerPlugin.class);
        registerPlugin(BatteryOptPlugin.class);
        registerPlugin(BoostAlarmPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
