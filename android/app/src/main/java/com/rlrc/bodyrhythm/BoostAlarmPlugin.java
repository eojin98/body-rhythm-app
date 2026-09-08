package com.rlrc.bodyrhythm;

import android.app.AlarmManager;
import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.util.Log;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

@CapacitorPlugin(name = "BoostAlarm")
public class BoostAlarmPlugin extends Plugin {

    private static final String TAG = "BoostAlarmPlugin";

    static final String PREFS_NAME         = "boost_alarm_prefs";
    static final String KEY_PENDING_ACTIONS = "pending_actions";

    // ─── Occurrence status constants (mirrors JS AlarmOccurrenceStatus) ──────────
    static final String STATUS_SCHEDULED     = "SCHEDULED";
    static final String STATUS_RINGING       = "RINGING";
    static final String STATUS_SNOOZED       = "SNOOZED";
    static final String STATUS_TIMER_RUNNING = "TIMER_RUNNING";
    static final String STATUS_COMPLETED     = "COMPLETED";
    static final String STATUS_CANCELLED     = "CANCELLED";
    static final String STATUS_SKIPPED       = "SKIPPED";
    static final String STATUS_EXPIRED       = "EXPIRED";

    // ─── Scheduling ──────────────────────────────────────────────────────────────

    /**
     * JS → scheduleAlarms({ hours: [7, 9, 12] })
     * Cancels all existing boost alarms, then schedules daily alarms for the given hours.
     */
    @PluginMethod
    public void scheduleAlarms(PluginCall call) {
        JSArray hoursArr = call.getArray("hours");
        if (hoursArr == null) { call.resolve(); return; }

        // Cancel daily + snooze only — timer backups must survive rescheduling
        BoostAlarmScheduler.cancelDailyAndSnoozeAll(getContext());

        try {
            for (int i = 0; i < hoursArr.length(); i++) {
                BoostAlarmScheduler.scheduleDaily(getContext(), hoursArr.getInt(i));
            }
            Log.d(TAG, "Scheduled " + hoursArr.length() + " boost alarms");
        } catch (Exception e) {
            Log.e(TAG, "scheduleAlarms error: " + e.getMessage());
        }
        call.resolve();
    }

    /**
     * JS → cancelAll()
     * Cancels every boost alarm (daily + snooze) for hours 7–23.
     */
    @PluginMethod
    public void cancelAll(PluginCall call) {
        BoostAlarmScheduler.cancelAll(getContext());
        if (call != null) call.resolve();
    }

    /**
     * JS → scheduleTestAlarm({ delayMs: 5000 })
     * Fires a one-shot boost alarm N ms from now (default 5 s) for dev/testing.
     * Uses hour=12 (noon) so the behavior title and time label render correctly.
     * Reuses the snooze slot — will not reschedule itself.
     */
    @PluginMethod
    public void scheduleTestAlarm(PluginCall call) {
        int delayMs = call.getInt("delayMs", 5000);
        Context ctx = getContext();
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        if (am == null) {
            call.reject("AlarmManager not available");
            return;
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !am.canScheduleExactAlarms()) {
            call.reject("SCHEDULE_EXACT_ALARM permission not granted");
            return;
        }
        BoostAlarmScheduler.scheduleSnooze(ctx, 12, delayMs);
        Log.d(TAG, "scheduleTestAlarm: fires in " + delayMs + " ms (hour=12)");
        call.resolve();
    }

    // ─── Pending actions (done/skipped recorded while app was dead) ───────────────

    /**
     * JS → getPendingActions() → { actions: "[{periodId,date,action}, ...]" }
     * Reads and clears pending actions from SharedPreferences.
     * Call this whenever the app becomes visible to sync with localStorage.
     */
    @PluginMethod
    public void getPendingActions(PluginCall call) {
        SharedPreferences prefs = getContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String json = prefs.getString(KEY_PENDING_ACTIONS, "[]");
        prefs.edit().remove(KEY_PENDING_ACTIONS).apply();

        JSObject res = new JSObject();
        res.put("actions", json);
        call.resolve(res);
    }

    /**
     * JS → getActiveTimerState() → { active, hour?, remainingSeconds? }
     * Scans SharedPrefs for any hour whose status is TIMER_RUNNING and timer_ends_at > now.
     * Returns the soonest-expiring one. Used by the WebView cold-start timer banner.
     */
    @PluginMethod
    public void getActiveTimerState(PluginCall call) {
        SharedPreferences prefs = getContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        long now = System.currentTimeMillis();
        int bestHour = -1;
        long bestEndsAt = Long.MAX_VALUE;

        for (int h = 0; h <= 23; h++) {
            String status = prefs.getString("alarm_status_" + h, "");
            if (!STATUS_TIMER_RUNNING.equals(status)) continue;
            long endsAt = prefs.getLong("timer_ends_at_" + h, 0);
            if (endsAt <= now) continue;
            if (endsAt < bestEndsAt) {
                bestEndsAt = endsAt;
                bestHour = h;
            }
        }

        JSObject res = new JSObject();
        try {
            if (bestHour < 0) {
                res.put("active", false);
            } else {
                res.put("active", true);
                res.put("hour", bestHour);
                res.put("remainingSeconds", (int) ((bestEndsAt - now) / 1000));
            }
        } catch (Exception e) {
            Log.e(TAG, "getActiveTimerState: " + e.getMessage());
        }
        call.resolve(res);
    }

    // ─── Snooze count (shared by Activity and Receiver) ──────────────────────────

    static int getSnoozeCount(Context ctx, int hour) {
        return ctx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                  .getInt(snoozeCountKey(hour), 0);
    }

    static void incrementSnoozeCount(Context ctx, int hour) {
        SharedPreferences prefs = ctx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String key = snoozeCountKey(hour);
        prefs.edit().putInt(key, prefs.getInt(key, 0) + 1).apply();
    }

    private static String snoozeCountKey(int hour) {
        String hk   = String.format("%02d", Math.max(hour, 0));
        String date = new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date());
        return "snooze_count_" + hk + "_" + date;
    }

    // ─── Occurrence status helpers ────────────────────────────────────────────────

    static void setOccurrenceStatus(Context ctx, int hour, String status) {
        ctx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
           .edit().putString("alarm_status_" + hour, status).apply();
    }

    static String getOccurrenceStatus(Context ctx, int hour) {
        return ctx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                  .getString("alarm_status_" + hour, STATUS_SCHEDULED);
    }

    // ─── Timer state persistence ──────────────────────────────────────────────────

    /**
     * Saves timer state to SharedPreferences so it survives process kill.
     * Keys: timer_ends_at_{h}, timer_started_at_{h}, timer_duration_seconds_{h}
     * Called when timer starts; cleared on explicit completion or user cancel.
     */
    static void persistTimer(Context ctx, int hour, long endsAt, long startedAt, int durationSec) {
        ctx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
           .edit()
           .putLong("timer_ends_at_" + hour,           endsAt)
           .putLong("timer_started_at_" + hour,        startedAt)
           .putInt ("timer_duration_seconds_" + hour,  durationSec)
           .apply();
    }

    /**
     * Removes the persisted timer state for the given hour.
     * Call on explicit user cancel or normal completion — NOT on system-initiated destroy.
     */
    static void clearPersistedTimer(Context ctx, int hour) {
        ctx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
           .edit()
           .remove("timer_ends_at_" + hour)
           .remove("timer_started_at_" + hour)
           .remove("timer_duration_seconds_" + hour)
           .apply();
    }

    // ─── Pending actions (done/skipped recorded while app was dead) ───────────────

    /** Static helper used by BoostAlarmActivity and BoostAlarmReceiver. */
    static void savePendingAction(Context ctx, int hour, String action) {
        savePendingAction(ctx, hour, action, -1);
    }

    /** Variant for timer_complete — includes timerSeconds so JS can award the correct points. */
    static void savePendingAction(Context ctx, int hour, String action, int timerSeconds) {
        try {
            SharedPreferences prefs = ctx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);

            // Guard: terminal state — don't overwrite a completed or skipped occurrence
            String currentStatus = prefs.getString("alarm_status_" + hour, "");
            if (STATUS_COMPLETED.equals(currentStatus) || STATUS_SKIPPED.equals(currentStatus)) {
                Log.w(TAG, "Guard: hour=" + hour + " already " + currentStatus
                        + ", ignoring action=" + action);
                return;
            }

            String hk       = String.format("%02d", Math.max(hour, 0));
            String periodId = "test_" + hk;

            // Use the time the alarm originally fired as the single source of truth for date
            long firedAt = prefs.getLong("alarm_fired_at_" + hour, System.currentTimeMillis());
            String date  = new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date(firedAt));

            // The moment the user actually pressed the button (or the timeout fired) —
            // used by JS for the 15-minute reaction-deadline check, instead of the time
            // the app happens to next sync pending actions.
            long respondedAt = System.currentTimeMillis();

            // occurrenceId: generated when alarm first fires (DAILY), persists through snoozes
            String occurrenceId = prefs.getString("alarm_occurrence_id_" + hour,
                                                  "boost_" + hour + "_" + firedAt);

            // Determine terminal status for this action
            String newStatus = ("done".equals(action) || "timer_complete".equals(action))
                               ? STATUS_COMPLETED : STATUS_SKIPPED;

            String existing = prefs.getString(KEY_PENDING_ACTIONS, "[]");
            JSONArray  arr  = new JSONArray(existing);
            JSONObject obj  = new JSONObject();
            obj.put("periodId",     periodId);
            obj.put("date",         date);
            obj.put("firedAt",      firedAt);
            obj.put("respondedAt",  respondedAt);
            obj.put("occurrenceId", occurrenceId);
            obj.put("action",       action);
            obj.put("status",       newStatus);
            if (timerSeconds > 0) {
                obj.put("timerSeconds", timerSeconds);
            }
            arr.put(obj);

            prefs.edit()
                 .putString(KEY_PENDING_ACTIONS, arr.toString())
                 .putString("alarm_status_" + hour, newStatus)
                 .apply();
            Log.d(TAG, "Saved pending action: " + obj);
        } catch (Exception e) {
            Log.e(TAG, "savePendingAction error: " + e.getMessage());
        }
    }

    // ─── USE_FULL_SCREEN_INTENT permission (Android 14+) ─────────────────────────

    /**
     * JS → checkFullScreenIntentPermission() → { granted: boolean }
     * On Android 14+ (API 34), USE_FULL_SCREEN_INTENT is restricted by default for
     * apps that are not alarm-clock or call apps. The user must manually allow it in
     * Settings > Apps > [App] > Full screen notifications.
     */
    @PluginMethod
    public void checkFullScreenIntentPermission(PluginCall call) {
        JSObject res = new JSObject();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) { // API 34
            NotificationManager nm = (NotificationManager) getContext().getSystemService(Context.NOTIFICATION_SERVICE);
            res.put("granted", nm != null && nm.canUseFullScreenIntent());
        } else {
            res.put("granted", true);
        }
        call.resolve(res);
    }

    /**
     * JS → openAppNotificationSettings()
     * Opens the system notification settings for this app (Settings > Apps > App > Notifications).
     * Works on Android 5+ (API 21).
     */
    @PluginMethod
    public void openAppNotificationSettings(PluginCall call) {
        try {
            Intent intent = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS);
            intent.putExtra(Settings.EXTRA_APP_PACKAGE, getContext().getPackageName());
            intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
        } catch (Exception e) {
            Log.e(TAG, "openAppNotificationSettings: " + e.getMessage());
        }
        call.resolve();
    }

    /**
     * JS → checkOverlayPermission() → { granted: boolean }
     * Whether the app can draw over other apps (SYSTEM_ALERT_WINDOW).
     * If granted, BoostAlarmActivity launches directly even while the device is in use.
     */
    @PluginMethod
    public void checkOverlayPermission(PluginCall call) {
        JSObject res = new JSObject();
        res.put("granted", Settings.canDrawOverlays(getContext()));
        call.resolve(res);
    }

    /**
     * JS → openOverlaySettings()
     * Opens Settings > Apps > [App] > Display over other apps so the user can grant
     * the SYSTEM_ALERT_WINDOW permission. If granted, boost alarms will launch as a
     * full-screen Activity even while another app is in use (instead of heads-up only).
     */
    @PluginMethod
    public void openOverlaySettings(PluginCall call) {
        try {
            Intent intent = new Intent(
                Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                Uri.parse("package:" + getContext().getPackageName())
            );
            intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
        } catch (Exception e) {
            Log.e(TAG, "openOverlaySettings: " + e.getMessage());
        }
        call.resolve();
    }

    /**
     * JS → openFullScreenIntentSettings()
     * Opens the system setting page where the user can enable full-screen intent for this app.
     * Only meaningful on Android 14+.
     */
    @PluginMethod
    public void openFullScreenIntentSettings(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            try {
                Intent intent = new Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT);
                intent.setData(Uri.parse("package:" + getContext().getPackageName()));
                intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(intent);
            } catch (Exception e) {
                Log.e(TAG, "openFullScreenIntentSettings: " + e.getMessage());
            }
        }
        call.resolve();
    }
}
