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
        // 매일 04:00 자동 재예약이 걸려 있도록 한다 (같은 요청 코드로 덮어써 중복되지 않음)
        AlarmRestorer.scheduleMaintenance(this);
    }
}
