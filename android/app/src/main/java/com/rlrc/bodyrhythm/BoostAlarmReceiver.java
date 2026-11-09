package com.rlrc.bodyrhythm;

import android.app.ActivityManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.provider.Settings;
import android.util.Log;

/**
 * Receives AlarmManager broadcasts and notification action broadcasts for boost-mode alarms.
 *
 * Action prefixes handled:
 *  BOOST_DAILY_{hour}        : daily alarm → start service + reschedule tomorrow
 *  BOOST_SNOOZE_{hour}       : one-shot snooze → start service only
 *  BOOST_DONE_{hour}         : notification "✅ 완료"  → save "done"    + stop service
 *  BOOST_NOTIF_SNOOZE_{hour} : notification "⏰ 나중에" → snooze 5 min (max 2×) + stop service
 *  BOOST_SKIP_{hour}         : notification "건너뜀"   → save "skipped" + stop service
 *  BOOST_DISMISS_{hour}      : legacy "끄기" (backward compat) → save "done" + stop service
 */
public class BoostAlarmReceiver extends BroadcastReceiver {

    private static final String TAG            = "BoostAlarmReceiver";
    private static final int    MAX_SNOOZE     = 2;
    private static final long   SNOOZE_DELAY   = 5 * 60 * 1000L; // 5 min
    /** 예약 시각보다 이만큼 넘게 늦게 도착하면(시간을 앞으로 바꾼 경우 등) 울리지 않는다 */
    private static final long   STALE_MS       = 30 * 60 * 1000L; // 30 min

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null) return;

        String action = intent.getAction();
        int hour = intent.getIntExtra("hour", -1);
        if (action == null || hour < 0) {
            Log.e(TAG, "Invalid intent: action=" + action + " hour=" + hour);
            return;
        }

        Log.d(TAG, "onReceive action=" + action + " hour=" + hour);

        if (isStale(intent, action)) {
            Log.w(TAG, "Stale alarm ignored: action=" + action + " hour=" + hour);
            if (action.startsWith(BoostAlarmScheduler.ACTION_DAILY)) BoostAlarmScheduler.scheduleDaily(context, hour);
            return;
        }

        if (action.startsWith(BoostAlarmScheduler.ACTION_DAILY)) {
            // New occurrence: generate unique ID from first-fire timestamp
            long firstFiredAt = System.currentTimeMillis();
            context.getSharedPreferences(BoostAlarmPlugin.PREFS_NAME, Context.MODE_PRIVATE)
                   .edit()
                   .putString("alarm_occurrence_id_" + hour, "boost_" + hour + "_" + firstFiredAt)
                   .putString("alarm_status_" + hour, BoostAlarmPlugin.STATUS_RINGING)
                   .apply();
            startAlarmService(context, hour);
            BoostAlarmScheduler.scheduleDaily(context, hour);

        } else if (action.startsWith(BoostAlarmScheduler.ACTION_SNOOZE)) {
            // Continuation of existing occurrence — update status, keep occurrenceId
            BoostAlarmPlugin.setOccurrenceStatus(context, hour, BoostAlarmPlugin.STATUS_RINGING);
            startAlarmService(context, hour);

        } else if (action.startsWith(BoostAlarmScheduler.ACTION_TIMER)) {
            // Timer-complete backup — fires only if Activity was killed during countdown
            int timerSec = intent.getIntExtra("timerSeconds", 0);
            BoostAlarmPlugin.savePendingAction(context, hour, "timer_complete", timerSec);

        } else if (action.startsWith(BoostAlarmService.ACTION_NOTIF_DONE)) {
            // Notification "✅ 완료"
            BoostAlarmPlugin.savePendingAction(context, hour, "done");
            stopAlarmService(context);

        } else if (action.startsWith(BoostAlarmService.ACTION_NOTIF_SNOOZE)) {
            // Notification "⏰ 나중에" — enforce max-2 limit
            int count = BoostAlarmPlugin.getSnoozeCount(context, hour);
            if (count < MAX_SNOOZE) {
                BoostAlarmPlugin.incrementSnoozeCount(context, hour);
                BoostAlarmPlugin.setOccurrenceStatus(context, hour, BoostAlarmPlugin.STATUS_SNOOZED);
                BoostAlarmScheduler.cancelSnooze(context, hour);
                BoostAlarmScheduler.scheduleSnooze(context, hour, SNOOZE_DELAY);
                Log.d(TAG, "Snooze scheduled (count=" + (count + 1) + ")");
            } else {
                Log.d(TAG, "Snooze maxed (" + MAX_SNOOZE + "), alarm stopped without rescheduling");
            }
            stopAlarmService(context);

        } else if (action.startsWith(BoostAlarmService.ACTION_NOTIF_SKIP)) {
            // Notification "건너뜀"
            BoostAlarmPlugin.savePendingAction(context, hour, "skipped");
            stopAlarmService(context);

        } else if (action.startsWith("com.rlrc.bodyrhythm.BOOST_DISMISS_")) {
            // Legacy "끄기" button (backward compatibility for already-issued notifications)
            BoostAlarmPlugin.savePendingAction(context, hour, "done");
            stopAlarmService(context);
        }
    }

    /** 예약 시각이 담긴 일일·스누즈 알람이 STALE_MS 넘게 늦게 도착했는지. 예전에 예약된 알람(값 없음)은 그대로 울린다. */
    private boolean isStale(Intent intent, String action) {
        if (!action.startsWith(BoostAlarmScheduler.ACTION_DAILY) && !action.startsWith(BoostAlarmScheduler.ACTION_SNOOZE)) return false;
        long triggerAt = intent.getLongExtra(BoostAlarmScheduler.EXTRA_TRIGGER_AT, 0L);
        return triggerAt > 0 && System.currentTimeMillis() - triggerAt > STALE_MS;
    }

    private void startAlarmService(Context context, int hour) {
        // Record the exact time this alarm fired — used by savePendingAction for correct date
        context.getSharedPreferences(BoostAlarmPlugin.PREFS_NAME, Context.MODE_PRIVATE)
               .edit()
               .putLong("alarm_fired_at_" + hour, System.currentTimeMillis())
               .apply();

        Intent serviceIntent = new Intent(context, BoostAlarmService.class);
        serviceIntent.putExtra("hour", hour);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(serviceIntent);
        } else {
            context.startService(serviceIntent);
        }

        // Launch BoostAlarmActivity directly when:
        //  1. The user has granted SYSTEM_ALERT_WINDOW (draw over other apps), OR
        //  2. The app is already in the foreground (visible Activity).
        // Without either condition, the foreground-service notification's setFullScreenIntent
        // handles the lock-screen case; the heads-up handles the in-use case (with setDeleteIntent
        // as a safety net if it is dismissed by OEM firmware).
        if (Settings.canDrawOverlays(context) || isAppInForeground()) {
            try {
                Intent activityIntent = new Intent(context, BoostAlarmActivity.class);
                activityIntent.putExtra("hour", hour);
                activityIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
                context.startActivity(activityIntent);
            } catch (Exception e) {
                Log.w(TAG, "Direct Activity launch failed: " + e.getMessage());
            }
        }
    }

    /** True when the app's main process has a visible (foreground) Activity. */
    private boolean isAppInForeground() {
        ActivityManager.RunningAppProcessInfo info = new ActivityManager.RunningAppProcessInfo();
        ActivityManager.getMyMemoryState(info);
        return info.importance == ActivityManager.RunningAppProcessInfo.IMPORTANCE_FOREGROUND;
    }

    private void stopAlarmService(Context context) {
        context.stopService(new Intent(context, BoostAlarmService.class));
    }
}
