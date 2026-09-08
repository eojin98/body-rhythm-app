package com.rlrc.bodyrhythm;

import android.app.KeyguardManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.os.Bundle;
import android.os.CountDownTimer;
import android.util.Log;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.appcompat.app.AppCompatActivity;

/**
 * Full-screen alarm Activity shown over the lock screen when a boost-mode alarm fires.
 *
 * Buttons:
 *  - ⏱ 타이머로 실천하기 : starts countdown; on finish saves "timer_complete" (5/8/10P)
 *  - 완료               : saves "done" (boost_complete, 2P), stops alarm, dismisses keyguard
 *  - 나중에             : snoozes 5 min (max 2 times)
 *  - 건너뜀             : saves "skipped" (0P), stops alarm
 *
 * Timer behaviour:
 *  - Tapping the timer button stops alarm sound/vibration immediately (user has acknowledged).
 *  - CountDownTimer runs in the Activity; onPause() cancels it, onResume() restarts from
 *    timerEndEpoch so the remaining time is always accurate even after screen-off/resume.
 *  - FLAG_KEEP_SCREEN_ON is set during countdown to prevent display-off.
 *  - On completion: savePendingAction("timer_complete", timerDurationSeconds) → JS converts
 *    this to boost_timer_complete and picks 5/8/10P based on timerSeconds.
 */
public class BoostAlarmActivity extends AppCompatActivity {

    private static final String TAG        = "BoostAlarmActivity";
    private static final int    MAX_SNOOZE = 2;

    private int hour = -1;

    // Timer state
    private CountDownTimer countdownTimer;
    private int            timerDurationSeconds;
    private boolean        timerRunning  = false;
    private long           timerEndEpoch = 0;

    // View references for timer toggling (cached after setContentView)
    private LinearLayout llActionButtons;
    private LinearLayout llCountdown;
    private TextView     tvCountdown;

    // ─── Lifecycle ────────────────────────────────────────────────────────────────

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        applyLockScreenFlags();
        setContentView(R.layout.activity_boost_alarm);

        llActionButtons = findViewById(R.id.ll_action_buttons);
        llCountdown     = findViewById(R.id.ll_countdown);
        tvCountdown     = findViewById(R.id.tv_countdown);

        hour = getIntent().getIntExtra("hour", -1);
        restoreTimerFromPrefs();
        bindUi();
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        // Another alarm (e.g. snooze) fired while Activity is alive — cancel any running timer first
        // (cancelTimerInternal cancels the AlarmManager backup for the current hour before we update it)
        cancelTimerInternal();
        hour = intent.getIntExtra("hour", hour);
        bindUi();
    }

    @Override
    protected void onPause() {
        super.onPause();
        // Cancel the CountDownTimer object but keep timerRunning=true so onResume() can restore
        if (countdownTimer != null) {
            countdownTimer.cancel();
            countdownTimer = null;
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (timerRunning) {
            long remaining = timerEndEpoch - System.currentTimeMillis();
            if (remaining <= 0) {
                onTimerComplete();
            } else {
                startCountdownTimer(remaining);
            }
        }
    }

    @Override
    protected void onDestroy() {
        cancelCountdownTimerOnly();
        super.onDestroy();
    }

    /** Disable hardware back button — user must explicitly pick an action. */
    @Override
    public void onBackPressed() { /* intentionally empty */ }

    // ─── UI ──────────────────────────────────────────────────────────────────────

    private void bindUi() {
        // Reset view state when UI is refreshed (e.g. snooze-triggered onNewIntent)
        if (!timerRunning) {
            llActionButtons.setVisibility(View.VISIBLE);
            llCountdown.setVisibility(View.GONE);
        }

        // Header: time + label + behavior
        TextView tvTime     = findViewById(R.id.tv_alarm_time);
        TextView tvLabel    = findViewById(R.id.tv_alarm_label);
        TextView tvBehavior = findViewById(R.id.tv_alarm_behavior);
        String   hk         = String.format("%02d", Math.max(hour, 0));

        if (hour >= 0) {
            String period      = hour < 12 ? "오전" : "오후";
            int    displayHour = hour > 12 ? hour - 12 : (hour == 0 ? 12 : hour);
            tvTime.setText(displayHour + ":00");
            tvLabel.setText(period + " 루틴 알람 🔥");

            String behaviorTitle = BoostAlarmBehaviors.getTitle(hk);
            if (behaviorTitle != null && !behaviorTitle.isEmpty()) {
                tvBehavior.setText(behaviorTitle);
                tvBehavior.setVisibility(View.VISIBLE);
            } else {
                tvBehavior.setVisibility(View.GONE);
            }
        }

        // Timer button
        Button btnTimer = findViewById(R.id.btn_timer);
        timerDurationSeconds = BoostAlarmBehaviors.getTimerSeconds(hk);
        if (timerDurationSeconds > 0 && !timerRunning) {
            btnTimer.setText(buildTimerLabel(timerDurationSeconds));
            btnTimer.setVisibility(View.VISIBLE);
            btnTimer.setOnClickListener(v -> startTimer());
        } else {
            btnTimer.setVisibility(View.GONE);
        }

        // Cancel button inside countdown view
        Button btnTimerCancel = findViewById(R.id.btn_timer_cancel);
        btnTimerCancel.setOnClickListener(v -> cancelTimer());

        // Snooze state
        Button   btnDone       = findViewById(R.id.btn_done);
        Button   btnSnooze     = findViewById(R.id.btn_snooze);
        Button   btnSkip       = findViewById(R.id.btn_skip);
        TextView tvSnoozeLimit = findViewById(R.id.tv_snooze_limit);

        int     snoozeCount = getSnoozeCount();
        boolean snoozeMaxed = snoozeCount >= MAX_SNOOZE;
        btnSnooze.setEnabled(!snoozeMaxed);
        btnSnooze.setAlpha(snoozeMaxed ? 0.30f : 1.0f);
        if (tvSnoozeLimit != null) {
            tvSnoozeLimit.setVisibility(snoozeMaxed ? View.VISIBLE : View.GONE);
        }

        // ✅ 완료 — boost_complete (2P), no timer
        btnDone.setOnClickListener(v -> {
            cancelTimerInternal();
            BoostAlarmPlugin.savePendingAction(this, hour, "done");
            stopAlarmService();
            requestDismissKeyguardAndFinish();
        });

        // ⏰ 나중에
        btnSnooze.setOnClickListener(v -> {
            if (getSnoozeCount() >= MAX_SNOOZE) return;
            cancelTimerInternal();
            incrementSnoozeCount();
            BoostAlarmPlugin.setOccurrenceStatus(this, hour, BoostAlarmPlugin.STATUS_SNOOZED);
            BoostAlarmScheduler.cancelSnooze(this, hour);
            BoostAlarmScheduler.scheduleSnooze(this, hour, 5 * 60 * 1000L);
            stopAlarmService();
            finish();
        });

        // 건너뜀
        btnSkip.setOnClickListener(v -> {
            cancelTimerInternal();
            BoostAlarmPlugin.savePendingAction(this, hour, "skipped");
            stopAlarmService();
            finish();
        });
    }

    private String buildTimerLabel(int seconds) {
        if (seconds >= 60 && seconds % 60 == 0) {
            return String.format("⏱  %d분 타이머로 실천하기", seconds / 60);
        }
        if (seconds >= 60) {
            return String.format("⏱  %d분 %d초 타이머로 실천하기", seconds / 60, seconds % 60);
        }
        return String.format("⏱  %d초 타이머로 실천하기", seconds);
    }

    // ─── Timer ────────────────────────────────────────────────────────────────────

    private void startTimer() {
        // Guard: prevent concurrent timer start (singleInstance Activity, but be explicit)
        if (timerRunning) {
            Log.w(TAG, "Guard: timer already running for hour=" + hour);
            return;
        }
        // Stop alarm sound/vibration — user has acknowledged the alarm
        stopAlarmService();
        // Keep screen on during countdown
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        long now = System.currentTimeMillis();
        timerRunning  = true;
        timerEndEpoch = now + timerDurationSeconds * 1000L;
        BoostAlarmPlugin.setOccurrenceStatus(this, hour, BoostAlarmPlugin.STATUS_TIMER_RUNNING);
        BoostAlarmPlugin.persistTimer(this, hour, timerEndEpoch, now, timerDurationSeconds);

        // Schedule AlarmManager backup: fires timerDurationSeconds + 5 s from now.
        // If this Activity is killed mid-countdown, the Receiver calls savePendingAction.
        // If the Activity completes normally, onTimerComplete() cancels this before it fires.
        BoostAlarmScheduler.scheduleTimerComplete(this, hour, timerDurationSeconds * 1000L + 5000L, timerDurationSeconds);

        // Switch views: hide buttons, show countdown
        findViewById(R.id.btn_timer).setVisibility(View.GONE);
        llActionButtons.setVisibility(View.GONE);
        llCountdown.setVisibility(View.VISIBLE);

        startCountdownTimer(timerDurationSeconds * 1000L);
    }

    private void startCountdownTimer(long millisLeft) {
        if (countdownTimer != null) {
            countdownTimer.cancel();
        }
        countdownTimer = new CountDownTimer(millisLeft, 1000) {
            @Override
            public void onTick(long ms) {
                long sec = ms / 1000;
                tvCountdown.setText(String.format("%02d:%02d", sec / 60, sec % 60));
            }
            @Override
            public void onFinish() {
                tvCountdown.setText("00:00");
                timerRunning = false;
                onTimerComplete();
            }
        }.start();
    }

    /** User tapped 취소 during countdown — return to normal alarm UI without saving. */
    private void cancelTimer() {
        cancelTimerInternal();
        BoostAlarmPlugin.setOccurrenceStatus(this, hour, BoostAlarmPlugin.STATUS_RINGING);
        getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        llCountdown.setVisibility(View.GONE);
        // Restore timer button and action buttons
        Button btnTimer = findViewById(R.id.btn_timer);
        if (timerDurationSeconds > 0) btnTimer.setVisibility(View.VISIBLE);
        llActionButtons.setVisibility(View.VISIBLE);
    }

    /** Cancels CountDownTimer AND AlarmManager backup. Call only on explicit user action. */
    private void cancelTimerInternal() {
        if (countdownTimer != null) {
            countdownTimer.cancel();
            countdownTimer = null;
        }
        timerRunning = false;
        BoostAlarmScheduler.cancelTimerComplete(this, hour);
        BoostAlarmPlugin.clearPersistedTimer(this, hour);
    }

    /** Releases only the UI CountDownTimer. Does NOT cancel the AlarmManager backup. */
    private void cancelCountdownTimerOnly() {
        if (countdownTimer != null) {
            countdownTimer.cancel();
            countdownTimer = null;
        }
        timerRunning = false;
    }

    /**
     * Called from onCreate() to restore timer state after process kill.
     * Covers Android back-stack recreation (user returns to Activity after OOM kill).
     * Does NOT affect the onPause/onResume path (already handled by timerRunning + timerEndEpoch).
     *
     * If status == TIMER_RUNNING and time remains → sets timerRunning/timerEndEpoch so onResume()
     * restarts the countdown. If timer already expired → clears persisted state and lets the
     * AlarmManager backup (8200+h) handle completion (2단계 guard prevents double-save).
     */
    private void restoreTimerFromPrefs() {
        if (hour < 0 || timerRunning) return;

        String status = BoostAlarmPlugin.getOccurrenceStatus(this, hour);
        if (!BoostAlarmPlugin.STATUS_TIMER_RUNNING.equals(status)) return;

        SharedPreferences prefs =
                getSharedPreferences(BoostAlarmPlugin.PREFS_NAME, Context.MODE_PRIVATE);
        long timerEndsAt    = prefs.getLong("timer_ends_at_" + hour, 0);
        long timerStartedAt = prefs.getLong("timer_started_at_" + hour, 0);
        int  durationSec    = prefs.getInt ("timer_duration_seconds_" + hour, 0);

        if (timerEndsAt == 0 || timerStartedAt == 0 || durationSec == 0) return;

        long now = System.currentTimeMillis();

        // Sanity: startedAt must be ≤ now (±60 s tolerance for clock drift)
        // and timer duration must be plausible (≤ 2 h)
        long storedDuration = timerEndsAt - timerStartedAt;
        if (timerStartedAt > now + 60_000L
                || storedDuration <= 0
                || storedDuration > 2 * 60 * 60 * 1000L) {
            Log.w(TAG, "Timer restore: sanity check failed (startedAt=" + timerStartedAt
                    + " endsAt=" + timerEndsAt + ") — invalidating");
            BoostAlarmPlugin.clearPersistedTimer(this, hour);
            BoostAlarmScheduler.cancelTimerComplete(this, hour);
            BoostAlarmPlugin.setOccurrenceStatus(this, hour, BoostAlarmPlugin.STATUS_CANCELLED);
            return;
        }

        long remaining = timerEndsAt - now;
        timerDurationSeconds = durationSec;  // used by onTimerComplete → savePendingAction

        if (remaining <= 0) {
            // Timer expired while app was dead — AlarmManager backup handles completion
            Log.d(TAG, "Timer restore: expired for hour=" + hour + ", backup takes over");
            BoostAlarmPlugin.clearPersistedTimer(this, hour);
            return;
        }

        // Timer still counting — restore state so onResume() starts the countdown UI
        timerRunning  = true;
        timerEndEpoch = timerEndsAt;
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        llCountdown.setVisibility(View.VISIBLE);
        llActionButtons.setVisibility(View.GONE);
        Log.d(TAG, "Timer restore: resuming for hour=" + hour
                + " remaining=" + (remaining / 1000) + "s");
    }

    /** Called when countdown reaches 00:00. */
    private void onTimerComplete() {
        getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        // Cancel AlarmManager backup and clear persisted state before saving completion
        BoostAlarmScheduler.cancelTimerComplete(this, hour);
        BoostAlarmPlugin.clearPersistedTimer(this, hour);
        // Save timer_complete with duration so JS awards boost_timer_complete (5/8/10P)
        BoostAlarmPlugin.savePendingAction(this, hour, "timer_complete", timerDurationSeconds);
        requestDismissKeyguardAndFinish();
    }

    // ─── Snooze counter — delegates to BoostAlarmPlugin static helpers ────────────

    private int getSnoozeCount() {
        return BoostAlarmPlugin.getSnoozeCount(this, hour);
    }

    private void incrementSnoozeCount() {
        BoostAlarmPlugin.incrementSnoozeCount(this, hour);
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────────

    private void stopAlarmService() {
        Intent stopIntent = new Intent(this, BoostAlarmService.class);
        stopIntent.setAction(BoostAlarmService.ACTION_STOP);
        startService(stopIntent);
    }

    /**
     * Requests keyguard dismissal, then finishes the activity.
     * API 26+: requestDismissKeyguard() — non-secure locks dismiss immediately;
     *          secure locks (PIN/pattern/biometric) show the auth UI.
     * API < 26: FLAG_DISMISS_KEYGUARD (set in applyLockScreenFlags) handles non-secure locks.
     */
    private void requestDismissKeyguardAndFinish() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            KeyguardManager km = (KeyguardManager) getSystemService(Context.KEYGUARD_SERVICE);
            if (km != null && km.isKeyguardLocked()) {
                km.requestDismissKeyguard(this, new KeyguardManager.KeyguardDismissCallback() {
                    @Override public void onDismissSucceeded() { finish(); }
                    @Override public void onDismissCancelled()  { finish(); }
                    @Override public void onDismissError()      { finish(); }
                });
                return;
            }
        }
        finish();
    }

    /**
     * Applies window flags so the Activity appears on top of the lock screen
     * and turns the screen on if it was off.
     * NOTE: requestDismissKeyguard() is NOT called here to avoid popping the auth UI on open.
     */
    private void applyLockScreenFlags() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
        } else {
            Window window = getWindow();
            //noinspection deprecation
            window.addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
                | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
                | WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
                | WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD
            );
        }
    }
}
