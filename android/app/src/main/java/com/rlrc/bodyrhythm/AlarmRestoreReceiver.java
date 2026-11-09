package com.rlrc.bodyrhythm;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/**
 * 재부팅 · 앱 업데이트 · 시간/시간대 변경 · 매일 04:00 자동 재예약 신호를 받아 알람을 다시 예약한다.
 * 실제 작업은 AlarmRestorer. 사용자에게 보이는 알림은 띄우지 않는다.
 */
public class AlarmRestoreReceiver extends BroadcastReceiver {

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || intent.getAction() == null) return;
        switch (intent.getAction()) {
            case Intent.ACTION_BOOT_COMPLETED:
            case "android.intent.action.QUICKBOOT_POWERON":
            case "com.htc.intent.action.QUICKBOOT_POWERON":
            case Intent.ACTION_MY_PACKAGE_REPLACED:
            case Intent.ACTION_TIME_CHANGED:      // android.intent.action.TIME_SET
            case Intent.ACTION_TIMEZONE_CHANGED:
            case AlarmRestorer.ACTION_MAINTENANCE:
                AlarmRestorer.restoreAll(context, intent.getAction());
                break;
            default:
                break;
        }
    }
}
