package com.rlrc.bodyrhythm;

import java.util.HashMap;
import java.util.Map;

/**
 * Java mirror of TEST_HOURLY_BEHAVIORS in alarmContent.js.
 * Provides the behavior title and timerSeconds shown in BoostAlarmActivity.
 */
class BoostAlarmBehaviors {

    private static final Map<String, String>  TITLES        = new HashMap<>();
    private static final Map<String, Integer> TIMER_SECONDS = new HashMap<>();

    static {
        TITLES.put("07", "기상 후 물 한 잔 마시기");
        TITLES.put("08", "햇빛 5분 쬐기");
        TITLES.put("09", "목·어깨 가볍게 풀기");
        TITLES.put("10", "눈 감고 1분 휴식");
        TITLES.put("11", "허리 펴고 자세 교정하기");
        TITLES.put("12", "점심 전 물 한 컵 마시기");
        TITLES.put("13", "짧게 눈 붙이기 (파워냅)");
        TITLES.put("14", "가볍게 5분 걷기");
        TITLES.put("15", "전신 스트레칭");
        TITLES.put("16", "심호흡하기");
        TITLES.put("17", "물 한 컵 먼저 마시기");
        TITLES.put("18", "가벼운 운동 10분");
        TITLES.put("19", "느린 호흡 6회");
        TITLES.put("20", "식후 가볍게 걷기");
        TITLES.put("21", "조명 낮추고 스트레칭");
        TITLES.put("22", "천천히 호흡하며 이완하기");
        TITLES.put("23", "화면 끄고 조용히 눈 감기");

        // Mirror of timerSeconds in alarmContent.js TEST_HOURLY_BEHAVIORS
        TIMER_SECONDS.put("07", 10);
        TIMER_SECONDS.put("08", 300);
        TIMER_SECONDS.put("09", 45);
        TIMER_SECONDS.put("10", 60);
        TIMER_SECONDS.put("11", 30);
        TIMER_SECONDS.put("12", 10);
        TIMER_SECONDS.put("13", 600);
        TIMER_SECONDS.put("14", 300);
        TIMER_SECONDS.put("15", 60);
        TIMER_SECONDS.put("16", 30);
        TIMER_SECONDS.put("17", 10);
        TIMER_SECONDS.put("18", 600);
        TIMER_SECONDS.put("19", 60);
        TIMER_SECONDS.put("20", 300);
        TIMER_SECONDS.put("21", 60);
        TIMER_SECONDS.put("22", 60);
        TIMER_SECONDS.put("23", 300);
    }

    /** Returns the behavior title for the given two-digit hour key (e.g. "07"), or "". */
    static String getTitle(String hk) {
        return TITLES.getOrDefault(hk, "");
    }

    /** Returns the timer duration in seconds for the given hour key, or 0 if none defined. */
    static int getTimerSeconds(String hk) {
        Integer val = TIMER_SECONDS.get(hk);
        return val != null ? val : 0;
    }
}
