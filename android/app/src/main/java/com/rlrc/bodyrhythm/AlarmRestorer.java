package com.rlrc.bodyrhythm;

import android.app.AlarmManager;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.UserManager;
import android.service.notification.StatusBarNotification;
import android.util.Log;

import com.capacitorjs.plugins.localnotifications.LocalNotification;
import com.capacitorjs.plugins.localnotifications.LocalNotificationManager;
import com.capacitorjs.plugins.localnotifications.LocalNotificationSchedule;
import com.capacitorjs.plugins.localnotifications.NotificationStorage;
import com.getcapacitor.CapConfig;

import java.util.ArrayList;
import java.util.Calendar;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * 앱을 열지 않아도 알람을 다시 예약한다 (재부팅 · 앱 업데이트 · 시간/시간대 변경 · 매일 04:00).
 *
 * - 강화알람: BoostAlarmPlugin이 저장한 강화모드 시간 목록으로 다음 회차를 예약한다.
 *   같은 요청 코드로 덮어쓰므로 여러 번 불려도 회차당 예약은 하나다.
 * - 일반·시간별 알림: Local Notifications 저장소에서 반복(on) 알림만 골라 다음 시각으로 다시 예약한다.
 *   플러그인이 알림 ID를 요청 코드로 쓰고 FLAG_CANCEL_CURRENT로 덮어쓰므로, 플러그인 자체 복구
 *   리시버와 함께 실행돼도 ID당 예약은 하나다. 1회성(at, 스누즈) 알림은 건드리지 않는다.
 * - 다음 회차만 계산해 예약하므로 이미 지난 회차는 울리지 않는다.
 * - 어떤 경로에서도 사용자에게 보이는 알림을 띄우지 않는다.
 */
final class AlarmRestorer {

    private static final String TAG = "AlarmRestore";

    static final String ACTION_MAINTENANCE = "com.rlrc.bodyrhythm.ALARM_MAINTENANCE";
    private static final int REQ_MAINTENANCE = 8300;
    private static final int MAINTENANCE_HOUR = 4;

    private AlarmRestorer() {}

    static void restoreAll(Context ctx, String reason) {
        Log.d(TAG, "restoreAll: " + reason);
        try { restoreBoostAlarms(ctx); } catch (Exception e) { Log.e(TAG, "boost restore failed", e); }
        try { restoreRepeatingNotifications(ctx); } catch (Exception e) { Log.e(TAG, "notification restore failed", e); }
        try { scheduleMaintenance(ctx); } catch (Exception e) { Log.e(TAG, "maintenance schedule failed", e); }
    }

    private static void restoreBoostAlarms(Context ctx) {
        List<Integer> hours = BoostAlarmPlugin.getSavedBoostHours(ctx);
        for (int hour : hours) BoostAlarmScheduler.scheduleDaily(ctx, hour);
        Log.d(TAG, "boost alarms restored: " + hours);
    }

    private static void restoreRepeatingNotifications(Context ctx) {
        UserManager um = ctx.getSystemService(UserManager.class);
        if (um == null || !um.isUserUnlocked()) return;

        NotificationStorage storage = new NotificationStorage(ctx);
        // 다시 예약하면 플러그인이 같은 ID의 알림을 알림창에서 지운다.
        // 사용자가 아직 응답하지 않은 알림이 사라지지 않도록, 알림창에 떠 있는 ID는 건너뛴다.
        Set<Integer> visible = visibleNotificationIds(ctx);

        List<LocalNotification> repeating = new ArrayList<>();
        for (String id : storage.getSavedNotificationIds()) {
            LocalNotification n = storage.getSavedNotification(id);
            if (n == null || n.getId() == null) continue;
            LocalNotificationSchedule schedule = n.getSchedule();
            if (schedule == null || schedule.getOn() == null) continue;   // 1회성(at)·간격(every)은 그대로 둔다
            if (visible.contains(n.getId())) continue;
            repeating.add(n);
        }
        if (repeating.isEmpty()) return;

        LocalNotificationManager manager =
            new LocalNotificationManager(storage, null, ctx, CapConfig.loadDefault(ctx));
        manager.schedule(null, repeating);
        Log.d(TAG, "repeating notifications restored: " + repeating.size() + " (skipped visible: " + visible.size() + ")");
    }

    private static Set<Integer> visibleNotificationIds(Context ctx) {
        Set<Integer> ids = new HashSet<>();
        NotificationManager nm = ctx.getSystemService(NotificationManager.class);
        if (nm == null) return ids;
        try {
            for (StatusBarNotification sbn : nm.getActiveNotifications()) ids.add(sbn.getId());
        } catch (Exception e) {
            Log.w(TAG, "getActiveNotifications failed: " + e.getMessage());
        }
        return ids;
    }

    /**
     * 매일 04:00 자동 재예약. Doze 중에도 실행되도록 RTC_WAKEUP + allowWhileIdle로 예약한다.
     * setAlarmClock은 상태바에 알람 아이콘이 보이므로 쓰지 않는다. 실행 시 알림·서비스는 띄우지 않는다.
     */
    static void scheduleMaintenance(Context ctx) {
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;

        Calendar cal = Calendar.getInstance();
        cal.set(Calendar.HOUR_OF_DAY, MAINTENANCE_HOUR);
        cal.set(Calendar.MINUTE, 0);
        cal.set(Calendar.SECOND, 0);
        cal.set(Calendar.MILLISECOND, 0);
        if (cal.getTimeInMillis() <= System.currentTimeMillis()) cal.add(Calendar.DAY_OF_YEAR, 1);

        Intent intent = new Intent(ctx, AlarmRestoreReceiver.class);
        intent.setAction(ACTION_MAINTENANCE);
        PendingIntent pi = PendingIntent.getBroadcast(
            ctx, REQ_MAINTENANCE, intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !am.canScheduleExactAlarms()) {
            am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, cal.getTimeInMillis(), pi);
        } else {
            am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, cal.getTimeInMillis(), pi);
        }
        Log.d(TAG, "maintenance scheduled at " + cal.getTime());
    }
}
