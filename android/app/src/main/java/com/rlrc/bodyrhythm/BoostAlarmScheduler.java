package com.rlrc.bodyrhythm;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.util.Log;

import java.util.Calendar;

/**
 * Static helper — schedules/cancels daily exact alarms for boost-mode hourly alarms.
 * Called by both BoostAlarmPlugin (initial schedule) and BoostAlarmReceiver (next-day reschedule).
 */
class BoostAlarmScheduler {

    private static final String TAG = "BoostAlarmScheduler";

    /** AlarmManager request codes: 8000 + hour (daily), 8100 + hour (snooze), 8200 + hour (timer backup) */
    static final int BASE_DAILY  = 8000;
    static final int BASE_SNOOZE = 8100;
    static final int BASE_TIMER  = 8200;

    static final String ACTION_DAILY  = "com.rlrc.bodyrhythm.BOOST_DAILY_";
    static final String ACTION_SNOOZE = "com.rlrc.bodyrhythm.BOOST_SNOOZE_";
    static final String ACTION_TIMER  = "com.rlrc.bodyrhythm.BOOST_TIMER_";

    /** Schedule (or reschedule) a daily boost alarm for the given hour. */
    static void scheduleDaily(Context ctx, int hour) {
        Calendar cal = Calendar.getInstance();
        cal.set(Calendar.HOUR_OF_DAY, hour);
        cal.set(Calendar.MINUTE, 0);
        cal.set(Calendar.SECOND, 0);
        cal.set(Calendar.MILLISECOND, 0);
        if (cal.getTimeInMillis() <= System.currentTimeMillis()) {
            cal.add(Calendar.DAY_OF_YEAR, 1);
        }
        schedule(ctx, hour, cal.getTimeInMillis(), ACTION_DAILY + hour, BASE_DAILY + hour);
    }

    /** Schedule a one-shot snooze alarm for the given hour, delayMs from now. */
    static void scheduleSnooze(Context ctx, int hour, long delayMs) {
        long triggerAt = System.currentTimeMillis() + delayMs;
        schedule(ctx, hour, triggerAt, ACTION_SNOOZE + hour, BASE_SNOOZE + hour);
    }

    private static void schedule(Context ctx, int hour, long triggerAtMs, String action, int requestCode) {
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !am.canScheduleExactAlarms()) {
            Log.w(TAG, "Cannot schedule exact alarm — permission not granted (hour=" + hour + ")");
            return;
        }

        Intent intent = new Intent(ctx, BoostAlarmReceiver.class);
        intent.setAction(action);
        intent.putExtra("hour", hour);

        PendingIntent pi = PendingIntent.getBroadcast(
            ctx, requestCode, intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMs, pi);
        Log.d(TAG, "Scheduled boost alarm: action=" + action + " hour=" + hour + " at=" + triggerAtMs);
    }

    /** Cancel the daily alarm for a specific hour. */
    static void cancelDaily(Context ctx, int hour) {
        cancel(ctx, ACTION_DAILY + hour, BASE_DAILY + hour);
    }

    /** Cancel the snooze alarm for a specific hour. */
    static void cancelSnooze(Context ctx, int hour) {
        cancel(ctx, ACTION_SNOOZE + hour, BASE_SNOOZE + hour);
    }

    /**
     * Schedule a one-shot timer-complete backup alarm.
     * Fires at now + delayMs — if BoostAlarmActivity is alive it cancels this; if the
     * process is killed mid-countdown this acts as the fallback to save the pending action.
     */
    static void scheduleTimerComplete(Context ctx, int hour, long delayMs, int timerSeconds) {
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !am.canScheduleExactAlarms()) return;

        Intent intent = new Intent(ctx, BoostAlarmReceiver.class);
        intent.setAction(ACTION_TIMER + hour);
        intent.putExtra("hour", hour);
        intent.putExtra("timerSeconds", timerSeconds);

        PendingIntent pi = PendingIntent.getBroadcast(
            ctx, BASE_TIMER + hour, intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, System.currentTimeMillis() + delayMs, pi);
        Log.d(TAG, "scheduleTimerComplete: hour=" + hour + " delay=" + delayMs + " timerSeconds=" + timerSeconds);
    }

    /** Cancel the timer-complete backup alarm for the given hour. */
    static void cancelTimerComplete(Context ctx, int hour) {
        cancel(ctx, ACTION_TIMER + hour, BASE_TIMER + hour);
    }

    private static void cancel(Context ctx, String action, int requestCode) {
        Intent intent = new Intent(ctx, BoostAlarmReceiver.class);
        intent.setAction(action);
        PendingIntent pi = PendingIntent.getBroadcast(
            ctx, requestCode, intent,
            PendingIntent.FLAG_NO_CREATE | PendingIntent.FLAG_IMMUTABLE
        );
        if (pi != null) {
            AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
            if (am != null) am.cancel(pi);
            pi.cancel();
        }
    }

    /**
     * Cancel daily + snooze alarms for hours 7–23.
     * Does NOT cancel timer-complete backups — those must survive a reschedule so that
     * an in-flight countdown can still deliver points if the Activity is killed.
     * Call this from scheduleAlarms(); call cancelAll() only for full teardown.
     */
    static void cancelDailyAndSnoozeAll(Context ctx) {
        for (int h = 7; h <= 23; h++) {
            cancelDaily(ctx, h);
            cancelSnooze(ctx, h);
        }
    }

    /** Cancel all boost alarms (daily + snooze + timer backup) for hours 7–23. Full teardown only. */
    static void cancelAll(Context ctx) {
        for (int h = 7; h <= 23; h++) {
            cancelDaily(ctx, h);
            cancelSnooze(ctx, h);
            cancelTimerComplete(ctx, h);
        }
    }
}
