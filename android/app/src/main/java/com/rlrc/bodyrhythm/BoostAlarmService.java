package com.rlrc.bodyrhythm;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ServiceInfo;
import android.media.AudioAttributes;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;
import android.util.Log;

import androidx.core.app.NotificationCompat;

/**
 * ForegroundService that plays the alarm sound + vibration and posts a
 * full-screen-intent notification pointing to BoostAlarmActivity.
 *
 * Stopped by:
 *  - BoostAlarmActivity (끄기 / 스누즈 버튼)
 *  - BoostAlarmReceiver (notification action 끄기)
 *  - Auto-timeout after TIMEOUT_MS of no user response
 */
public class BoostAlarmService extends Service {

    private static final String TAG        = "BoostAlarmService";
    private static final long   TIMEOUT_MS = 60_000L;   // 60 s auto-stop if no user action

    static final String CHANNEL_ID   = "boost_alarm_ch_v1";
    static final int    NOTIF_ID     = 9900;
    /** Stop service cleanly (sent by Activity / Receiver). */
    static final String ACTION_STOP   = "com.rlrc.bodyrhythm.BOOST_STOP";
    /** Re-post notification after it was dismissed (fired by setDeleteIntent). */
    static final String ACTION_REPOST = "com.rlrc.bodyrhythm.BOOST_REPOST";

    /**
     * 미사용(unused): 현재 어떤 호출자도 이 메서드를 사용하지 않는다. BoostAlarmActivity,
     * BoostAlarmReceiver, 그리고 이 파일의 auto-timeout 핸들러 모두 BoostAlarmPlugin.savePendingAction(...)을
     * 직접 호출하고 별도로 stopSelf()/stopService(...)를 호출하는 방식으로 종료를 처리한다.
     * 삭제하지 않고 남겨둠 — 실제 사용 여부는 재검토 필요.
     *
     * Unified alarm stop entry point. Saves a pending action (done/skipped/timer_complete)
     * then stops the service. For "snooze", the caller must schedule the snooze first; pass
     * reason="snooze" to skip action saving. For "timeout", uses the "skipped" path (0P).
     *
     * Called by: BoostAlarmActivity buttons, BoostAlarmReceiver notification actions, timeout handler.
     */
    static void stopBoostAlarm(Context context, int hour, String reason) {
        switch (reason) {
            case "snooze":
                break;  // caller already handled rescheduling; just stop the service
            case "timeout":
                // Same path as "skipped" — keeps occurrence tracking consistent
                BoostAlarmPlugin.savePendingAction(context, hour, "skipped");
                break;
            default:
                BoostAlarmPlugin.savePendingAction(context, hour, reason);
                break;
        }
        Intent stopIntent = new Intent(context, BoostAlarmService.class);
        stopIntent.setAction(ACTION_STOP);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(stopIntent);
        } else {
            context.startService(stopIntent);
        }
    }

    /** Notification action prefixes — received by BoostAlarmReceiver. */
    static final String ACTION_NOTIF_DONE   = "com.rlrc.bodyrhythm.BOOST_DONE_";
    static final String ACTION_NOTIF_SNOOZE = "com.rlrc.bodyrhythm.BOOST_NOTIF_SNOOZE_";
    static final String ACTION_NOTIF_SKIP   = "com.rlrc.bodyrhythm.BOOST_SKIP_";

    private MediaPlayer mediaPlayer;
    private Vibrator    vibrator;
    private int         currentHour        = -1;
    private String      activeOccurrenceId = null;
    private Handler     timeoutHandler     = null;

    // ─── Lifecycle ────────────────────────────────────────────────────────────────

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) return START_NOT_STICKY;

        String action = intent.getAction();

        if (ACTION_STOP.equals(action)) {
            stopSelf();
            return START_NOT_STICKY;
        }

        if (ACTION_REPOST.equals(action)) {
            // Notification was dismissed while alarm still active — re-post it
            if (currentHour >= 0) {
                NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
                if (nm != null) nm.notify(NOTIF_ID, buildNotification(currentHour));
            }
            return START_NOT_STICKY;
        }

        int incomingHour = intent.getIntExtra("hour", -1);

        // Duplicate occurrenceId guard: if same occurrence is already ringing, skip restart
        String incomingOccurrenceId = getOccurrenceIdFromPrefs(incomingHour);
        if (incomingOccurrenceId != null
                && incomingOccurrenceId.equals(activeOccurrenceId)
                && mediaPlayer != null) {
            Log.d(TAG, "Duplicate occurrenceId guard — already ringing: " + incomingOccurrenceId);
            return START_NOT_STICKY;
        }

        currentHour        = incomingHour;
        activeOccurrenceId = incomingOccurrenceId;

        // Must call startForeground() within 5 s to avoid ANR on Android 8+.
        Notification notif = buildNotification(currentHour);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIF_ID, notif, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
        } else {
            startForeground(NOTIF_ID, notif);
        }

        startSound();
        startVibration();
        scheduleTimeout();

        return START_NOT_STICKY;
    }

    @Override
    public void onDestroy() {
        cancelTimeout();
        stopSound();
        stopVibration();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            stopForeground(STOP_FOREGROUND_REMOVE);
        } else {
            stopForeground(true);
        }
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) { return null; }

    // ─── Auto-timeout ─────────────────────────────────────────────────────────────

    private void scheduleTimeout() {
        cancelTimeout();
        timeoutHandler = new Handler(Looper.getMainLooper());
        timeoutHandler.postDelayed(() -> {
            Log.d(TAG, "Auto-timeout: no response for hour=" + currentHour);
            // action="timeout" (not "skipped") so JS can tell an unattended alarm apart
            // from the user explicitly tapping 건너뜀 — both still resolve to STATUS_SKIPPED.
            BoostAlarmPlugin.savePendingAction(this, currentHour, "timeout");
            stopSelf();
        }, TIMEOUT_MS);
    }

    private void cancelTimeout() {
        if (timeoutHandler != null) {
            timeoutHandler.removeCallbacksAndMessages(null);
            timeoutHandler = null;
        }
    }

    // ─── Sound ────────────────────────────────────────────────────────────────────

    private void startSound() {
        // Respect ringer mode: skip sound in vibrate or silent mode.
        AudioManager am = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
        if (am != null && am.getRingerMode() != AudioManager.RINGER_MODE_NORMAL) {
            Log.d(TAG, "startSound: skipped (ringer mode=" + am.getRingerMode() + ")");
            return;
        }

        try {
            Uri alarmUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
            if (alarmUri == null) {
                alarmUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
            }
            mediaPlayer = new MediaPlayer();
            mediaPlayer.setDataSource(this, alarmUri);
            mediaPlayer.setAudioAttributes(new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ALARM)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .setLegacyStreamType(AudioManager.STREAM_ALARM)
                .build());
            mediaPlayer.setLooping(true);
            mediaPlayer.prepare();
            mediaPlayer.start();
        } catch (Exception e) {
            Log.e(TAG, "startSound error: " + e.getMessage());
        }
    }

    private void stopSound() {
        if (mediaPlayer != null) {
            try { mediaPlayer.stop(); } catch (Exception ignored) {}
            mediaPlayer.release();
            mediaPlayer = null;
        }
    }

    // ─── Vibration ────────────────────────────────────────────────────────────────

    private void startVibration() {
        long[] pattern = {0, 800, 400, 800, 400};
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                VibratorManager vm = (VibratorManager) getSystemService(Context.VIBRATOR_MANAGER_SERVICE);
                if (vm != null) vibrator = vm.getDefaultVibrator();
            } else {
                vibrator = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
            }
            if (vibrator != null && vibrator.hasVibrator()) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    vibrator.vibrate(VibrationEffect.createWaveform(pattern, 0));
                } else {
                    //noinspection deprecation
                    vibrator.vibrate(pattern, 0);
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "startVibration error: " + e.getMessage());
        }
    }

    private void stopVibration() {
        if (vibrator != null) {
            vibrator.cancel();
            vibrator = null;
        }
    }

    // ─── Notification ─────────────────────────────────────────────────────────────

    private Notification buildNotification(int hour) {
        // fullScreenIntent → BoostAlarmActivity (shown when screen is locked)
        // Also used as contentIntent so tapping the shade notification reopens Activity
        Intent activityIntent = new Intent(this, BoostAlarmActivity.class);
        activityIntent.putExtra("hour", hour);
        activityIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent fullScreenPi = PendingIntent.getActivity(
            this, NOTIF_ID, activityIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        // Notification action buttons → BoostAlarmReceiver
        PendingIntent donePi   = buildActionPi(ACTION_NOTIF_DONE,   9910, hour);
        PendingIntent snoozePi = buildActionPi(ACTION_NOTIF_SNOOZE, 9920, hour);
        PendingIntent skipPi   = buildActionPi(ACTION_NOTIF_SKIP,   9930, hour);

        // "알람 끄기" — directly stops the service (no action recording, just silences the alarm).
        // Useful when the user just wants to stop the sound without choosing done/skip.
        Intent stopDirectIntent = new Intent(this, BoostAlarmService.class);
        stopDirectIntent.setAction(ACTION_STOP);
        PendingIntent stopDirectPi = PendingIntent.getService(
            this, 9950, stopDirectIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        // deleteIntent: re-post notification if it's somehow dismissed while alarm still active.
        // setOngoing(true) should prevent dismissal from the shade, but some OEM skins ignore it
        // for the heads-up peek — this acts as a safety net.
        Intent repostIntent = new Intent(this, BoostAlarmService.class);
        repostIntent.setAction(ACTION_REPOST);
        PendingIntent deletePi = PendingIntent.getService(
            this, 9940, repostIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        String timeLabel = buildTimeLabel(hour);
        String content   = hour >= 0 ? (timeLabel + " 루틴 시간이에요!") : "강화 알람";

        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_boost_alarm)
            .setContentTitle("🔥 강화 알람")
            .setContentText(content)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            // fullScreenIntent: shows BoostAlarmActivity over the lock screen
            .setFullScreenIntent(fullScreenPi, true)
            .setContentIntent(fullScreenPi)
            .setOngoing(true)
            .setAutoCancel(false)
            .setDeleteIntent(deletePi)
            .addAction(0, "알람 끄기", stopDirectPi)
            .addAction(0, "✅ 완료",  donePi)
            .addAction(0, "⏰ 나중에", snoozePi)
            .addAction(0, "건너뜀",   skipPi)
            .build();
    }

    private PendingIntent buildActionPi(String actionPrefix, int baseReqCode, int hour) {
        Intent intent = new Intent(this, BoostAlarmReceiver.class);
        intent.setAction(actionPrefix + hour);
        intent.putExtra("hour", hour);
        return PendingIntent.getBroadcast(
            this, baseReqCode + hour, intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
    }

    private String buildTimeLabel(int hour) {
        if (hour < 0) return "";
        String period    = hour < 12 ? "오전" : "오후";
        int displayHour  = hour > 12 ? hour - 12 : (hour == 0 ? 12 : hour);
        return period + " " + displayHour + ":00";
    }

    private String getOccurrenceIdFromPrefs(int hour) {
        if (hour < 0) return null;
        SharedPreferences prefs = getSharedPreferences(BoostAlarmPlugin.PREFS_NAME, Context.MODE_PRIVATE);
        return prefs.getString("alarm_occurrence_id_" + hour, null);
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;

        NotificationChannel ch = new NotificationChannel(
            CHANNEL_ID,
            "강화 알람 (풀스크린)",
            NotificationManager.IMPORTANCE_HIGH
        );
        ch.setDescription("강화모드 알람 — 잠금 화면 위에 표시됩니다");
        ch.setBypassDnd(true);                              // bypass Do-Not-Disturb
        ch.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        ch.enableVibration(false);                          // vibration managed by service
        ch.enableLights(true);
        ch.setLightColor(0xFF6C5CE7);

        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (nm != null) nm.createNotificationChannel(ch);
    }
}
