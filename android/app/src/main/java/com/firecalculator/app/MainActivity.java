package com.firecalculator.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(WidgetBridgePlugin.class);
        super.onCreate(savedInstanceState);
    }
}

@CapacitorPlugin(name = "WidgetBridge")
class WidgetBridgePlugin extends Plugin {
    @PluginMethod
    public void getPendingWidgetTransactions(PluginCall call) {
        SharedPreferences prefs = getContext().getSharedPreferences("widget_data", Context.MODE_PRIVATE);
        String txs = prefs.getString("pending_txs", "[]");
        JSObject ret = new JSObject();
        ret.put("pending_txs", txs);
        // Clear pending queue after reading so entries aren't duplicated
        prefs.edit().putString("pending_txs", "[]").apply();
        call.resolve(ret);
    }

    @PluginMethod
    public void saveWidgetCustomConfig(PluginCall call) {
        String catsJson = call.getString("cats");
        String subsJson = call.getString("subs");
        SharedPreferences prefs = getContext().getSharedPreferences("widget_data", Context.MODE_PRIVATE);
        SharedPreferences.Editor editor = prefs.edit();
        if (catsJson != null) editor.putString("custom_cats_json", catsJson);
        if (subsJson != null) editor.putString("custom_subs_json", subsJson);
        editor.apply();
        call.resolve();
    }
}
