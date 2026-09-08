package com.rlrc.bodyrhythm;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.media.AudioManager;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "DeviceRinger")
public class DeviceRingerPlugin extends Plugin {

    private BroadcastReceiver ringerReceiver;

    @Override
    public void load() {
        ringerReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                if (AudioManager.RINGER_MODE_CHANGED_ACTION.equals(intent.getAction())) {
                    notifyRingerChange();
                }
            }
        };
        IntentFilter filter = new IntentFilter(AudioManager.RINGER_MODE_CHANGED_ACTION);
        getContext().registerReceiver(ringerReceiver, filter);
    }

    @Override
    protected void handleOnDestroy() {
        if (ringerReceiver != null) {
            try {
                getContext().unregisterReceiver(ringerReceiver);
            } catch (Exception ignored) {}
            ringerReceiver = null;
        }
    }

    @PluginMethod
    public void getRingerMode(PluginCall call) {
        AudioManager am = (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
        int mode = am.getRingerMode();
        JSObject result = new JSObject();
        result.put("mode", mode);
        result.put("isSilent", mode == AudioManager.RINGER_MODE_SILENT || mode == AudioManager.RINGER_MODE_VIBRATE);
        call.resolve(result);
    }

    private void notifyRingerChange() {
        AudioManager am = (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
        int mode = am.getRingerMode();
        JSObject data = new JSObject();
        data.put("mode", mode);
        data.put("isSilent", mode == AudioManager.RINGER_MODE_SILENT || mode == AudioManager.RINGER_MODE_VIBRATE);
        notifyListeners("ringerModeChanged", data);
    }
}
