package com.firecalculator.app;

import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "WidgetBridge")
public class WidgetBridgePlugin extends Plugin {

    @PluginMethod
    public void loadWidgetAppData(PluginCall call) {
        SharedPreferences prefs = getContext().getSharedPreferences("widget_data", Context.MODE_PRIVATE);
        String txsJson = prefs.getString("app_transactions_json", "[]");
        JSObject ret = new JSObject();
        ret.put("app_transactions_json", txsJson);
        call.resolve(ret);
    }

    @PluginMethod
    public void saveWidgetAppData(PluginCall call) {
        JSArray txsArr = call.getArray("transactions");
        int todayExpense = call.getInt("todayExpense", 0);
        SharedPreferences prefs = getContext().getSharedPreferences("widget_data", Context.MODE_PRIVATE);
        SharedPreferences.Editor editor = prefs.edit();

        if (txsArr != null) {
            editor.putString("app_transactions_json", txsArr.toString());
        }
        editor.putInt("today_expense", todayExpense);
        editor.apply();

        // Broadcast to trigger Widget UI update immediately
        try {
            AppWidgetManager appWidgetManager = AppWidgetManager.getInstance(getContext());
            ComponentName componentName = new ComponentName(getContext(), QuickLogWidgetProvider.class);
            int[] appWidgetIds = appWidgetManager.getAppWidgetIds(componentName);
            Intent intent = new Intent(getContext(), QuickLogWidgetProvider.class);
            intent.setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE);
            intent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, appWidgetIds);
            getContext().sendBroadcast(intent);
        } catch (Exception ignored) {}

        call.resolve();
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
