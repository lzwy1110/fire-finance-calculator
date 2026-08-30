package com.firecalculator.app;

import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.JSArray;
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

        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.LOLLIPOP) {
            getWindow().setStatusBarColor(android.graphics.Color.TRANSPARENT);
            getWindow().setNavigationBarColor(android.graphics.Color.parseColor("#0c0c0e"));
        }
    }

    @CapacitorPlugin(name = "WidgetBridge")
    public static class WidgetBridgePlugin extends Plugin {

        @PluginMethod
        public void consumePendingWidgetTransactions(PluginCall call) {
            SharedPreferences prefs = getContext().getSharedPreferences("widget_data", Context.MODE_PRIVATE);
            String pendingTxsJson = prefs.getString("pending_widget_txs", "[]");
            
            // Atomically clear queue
            prefs.edit().putString("pending_widget_txs", "[]").apply();

            JSObject ret = new JSObject();
            ret.put("pending_transactions_json", pendingTxsJson);
            call.resolve(ret);
        }

        @PluginMethod
        public void getPendingWidgetTransactions(PluginCall call) {
            SharedPreferences prefs = getContext().getSharedPreferences("widget_data", Context.MODE_PRIVATE);
            String pendingTxsJson = prefs.getString("pending_widget_txs", "[]");
            JSObject ret = new JSObject();
            ret.put("pending_txs", pendingTxsJson);
            call.resolve(ret);
        }

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
            Double cashSavingsTWD = call.getDouble("cashSavingsTWD");
            Double cashSavingsUSD = call.getDouble("cashSavingsUSD");
            String categoriesJson = call.getString("categoriesJson");
            String supabaseUrl = call.getString("supabaseUrl");
            String supabaseAnonKey = call.getString("supabaseAnonKey");
            String syncCode = call.getString("syncCode");
            String storageMode = call.getString("storageMode");

            SharedPreferences prefs = getContext().getSharedPreferences("widget_data", Context.MODE_PRIVATE);
            SharedPreferences.Editor editor = prefs.edit();

            if (txsArr != null) {
                editor.putString("app_transactions_json", txsArr.toString());
            }
            editor.putInt("today_expense", todayExpense);
            if (cashSavingsTWD != null) editor.putLong("cash_savings_twd", cashSavingsTWD.longValue());
            if (cashSavingsUSD != null) editor.putLong("cash_savings_usd", cashSavingsUSD.longValue());
            if (categoriesJson != null) editor.putString("all_categories_json", categoriesJson);
            if (supabaseUrl != null) editor.putString("supabase_url", supabaseUrl);
            if (supabaseAnonKey != null) editor.putString("supabase_anon_key", supabaseAnonKey);
            if (syncCode != null) editor.putString("sync_code", syncCode);
            if (storageMode != null) editor.putString("storage_mode", storageMode);
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
            String categoriesJson = call.getString("categoriesJson");
            String catsJson = call.getString("cats");
            String subsJson = call.getString("subs");
            String supabaseUrl = call.getString("supabaseUrl");
            String supabaseAnonKey = call.getString("supabaseAnonKey");
            String syncCode = call.getString("syncCode");
            String storageMode = call.getString("storageMode");

            SharedPreferences prefs = getContext().getSharedPreferences("widget_data", Context.MODE_PRIVATE);
            SharedPreferences.Editor editor = prefs.edit();
            if (categoriesJson != null) editor.putString("all_categories_json", categoriesJson);
            if (catsJson != null) editor.putString("custom_cats_json", catsJson);
            if (subsJson != null) editor.putString("custom_subs_json", subsJson);
            if (supabaseUrl != null) editor.putString("supabase_url", supabaseUrl);
            if (supabaseAnonKey != null) editor.putString("supabase_anon_key", supabaseAnonKey);
            if (syncCode != null) editor.putString("sync_code", syncCode);
            if (storageMode != null) editor.putString("storage_mode", storageMode);
            editor.apply();

            // Broadcast to update widget categories
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
    }
}
