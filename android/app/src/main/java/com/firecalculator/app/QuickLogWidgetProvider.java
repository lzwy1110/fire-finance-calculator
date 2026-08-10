package com.firecalculator.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.view.View;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

public class QuickLogWidgetProvider extends AppWidgetProvider {

    public static final String ACTION_SELECT_MAIN = "com.firecalculator.app.WIDGET_SELECT_MAIN";
    public static final String ACTION_SELECT_SUB = "com.firecalculator.app.WIDGET_SELECT_SUB";
    public static final String ACTION_SELECT_AMT = "com.firecalculator.app.WIDGET_SELECT_AMT";
    public static final String ACTION_RESET = "com.firecalculator.app.WIDGET_RESET";

    public static final String EXTRA_CAT = "extra_cat";
    public static final String EXTRA_SUB = "extra_sub";
    public static final String EXTRA_AMT = "extra_amt";

    private static final String PREF_NAME = "widget_data";

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            updateWidgetView(context, appWidgetManager, appWidgetId);
        }
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);
        String action = intent.getAction();
        SharedPreferences prefs = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);

        if (ACTION_SELECT_MAIN.equals(action)) {
            String cat = intent.getStringExtra(EXTRA_CAT);
            prefs.edit()
                    .putString("selected_cat", cat)
                    .putInt("step", 1)
                    .apply();
            updateAllWidgets(context);

        } else if (ACTION_SELECT_SUB.equals(action)) {
            String sub = intent.getStringExtra(EXTRA_SUB);
            prefs.edit()
                    .putString("selected_sub", sub)
                    .putInt("step", 2)
                    .apply();
            updateAllWidgets(context);

        } else if (ACTION_SELECT_AMT.equals(action)) {
            int amt = intent.getIntExtra(EXTRA_AMT, 0);
            String cat = prefs.getString("selected_cat", "飲食");
            String sub = prefs.getString("selected_sub", "午餐");

            // Calculate Today Expense
            String todayStr = new SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(new Date());
            String lastDate = prefs.getString("today_date", "");
            int currentExpense = prefs.getInt("today_expense", 0);

            if (!todayStr.equals(lastDate)) {
                currentExpense = 0;
            }

            if (!"收入".equals(cat)) {
                currentExpense += amt;
            }

            // Save pending transaction to SharedPreferences
            try {
                String queueJson = prefs.getString("pending_txs", "[]");
                JSONArray arr = new JSONArray(queueJson);
                JSONObject obj = new JSONObject();
                obj.put("id", "t-widget-" + System.currentTimeMillis());
                obj.put("type", "收入".equals(cat) ? "income" : "投資".equals(cat) ? "investment" : "expense");
                obj.put("amount", amt);
                obj.put("mainCategory", cat);
                obj.put("subCategory", sub);
                obj.put("date", todayStr);
                obj.put("note", "來自 Android 桌面小工具 1 秒速記");
                obj.put("isQuickPreset", true);
                arr.put(obj);

                prefs.edit()
                        .putString("pending_txs", arr.toString())
                        .putString("today_date", todayStr)
                        .putInt("today_expense", currentExpense)
                        .putInt("step", 0)
                        .putString("last_logged", "✅ 已記【" + cat + "/" + sub + "】$" + amt)
                        .apply();
            } catch (Exception e) {
                e.printStackTrace();
            }

            updateAllWidgets(context);

        } else if (ACTION_RESET.equals(action)) {
            prefs.edit().putInt("step", 0).apply();
            updateAllWidgets(context);
        }
    }

    private void updateAllWidgets(Context context) {
        AppWidgetManager appWidgetManager = AppWidgetManager.getInstance(context);
        ComponentName componentName = new ComponentName(context, QuickLogWidgetProvider.class);
        int[] appWidgetIds = appWidgetManager.getAppWidgetIds(componentName);
        for (int appWidgetId : appWidgetIds) {
            updateWidgetView(context, appWidgetManager, appWidgetId);
        }
    }

    private void updateWidgetView(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        SharedPreferences prefs = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_quick_log);

        String todayStr = new SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(new Date());
        String lastDate = prefs.getString("today_date", "");
        int todayExpense = todayStr.equals(lastDate) ? prefs.getInt("today_expense", 0) : 0;
        int step = prefs.getInt("step", 0);
        String cat = prefs.getString("selected_cat", "飲食");
        String sub = prefs.getString("selected_sub", "午餐");
        String lastLogged = prefs.getString("last_logged", "");

        // Set Today Expense Text
        views.setTextViewText(R.id.txt_today_expense, "NT$ " + todayExpense);

        // Attach Reset Intent
        views.setOnClickPendingIntent(R.id.btn_reset_step, createBroadcastIntent(context, ACTION_RESET, null, null, 0, 99));

        if (step == 0) {
            // STEP 1: Main Category Selection
            views.setViewVisibility(R.id.layout_step_main, View.VISIBLE);
            views.setViewVisibility(R.id.layout_step_sub, View.GONE);
            views.setViewVisibility(R.id.layout_step_amount, View.GONE);

            String hint = lastLogged.isEmpty() ? "第一步：請選擇【大類】" : lastLogged;
            views.setTextViewText(R.id.txt_step_hint, hint);

            views.setOnClickPendingIntent(R.id.btn_cat_food, createBroadcastIntent(context, ACTION_SELECT_MAIN, "飲食", null, 0, 10));
            views.setOnClickPendingIntent(R.id.btn_cat_ent, createBroadcastIntent(context, ACTION_SELECT_MAIN, "娛樂", null, 0, 11));
            views.setOnClickPendingIntent(R.id.btn_cat_trans, createBroadcastIntent(context, ACTION_SELECT_MAIN, "交通", null, 0, 12));
            views.setOnClickPendingIntent(R.id.btn_cat_daily, createBroadcastIntent(context, ACTION_SELECT_MAIN, "日用", null, 0, 13));
            views.setOnClickPendingIntent(R.id.btn_cat_inc, createBroadcastIntent(context, ACTION_SELECT_MAIN, "收入", null, 0, 14));
            views.setOnClickPendingIntent(R.id.btn_cat_inv, createBroadcastIntent(context, ACTION_SELECT_MAIN, "投資", null, 0, 15));

        } else if (step == 1) {
            // STEP 2: Sub Category Selection
            views.setViewVisibility(R.id.layout_step_main, View.GONE);
            views.setViewVisibility(R.id.layout_step_sub, View.VISIBLE);
            views.setViewVisibility(R.id.layout_step_amount, View.GONE);

            views.setTextViewText(R.id.txt_step_hint, "第二步：已選【" + cat + "】，請選擇細類");

            String[] subList = getSubCategories(cat);
            views.setTextViewText(R.id.btn_sub_1, subList[0]);
            views.setTextViewText(R.id.btn_sub_2, subList[1]);
            views.setTextViewText(R.id.btn_sub_3, subList[2]);
            views.setTextViewText(R.id.btn_sub_4, subList[3]);
            views.setTextViewText(R.id.btn_sub_5, subList[4]);
            views.setTextViewText(R.id.btn_sub_6, subList[5]);

            views.setOnClickPendingIntent(R.id.btn_sub_1, createBroadcastIntent(context, ACTION_SELECT_SUB, cat, subList[0], 0, 20));
            views.setOnClickPendingIntent(R.id.btn_sub_2, createBroadcastIntent(context, ACTION_SELECT_SUB, cat, subList[1], 0, 21));
            views.setOnClickPendingIntent(R.id.btn_sub_3, createBroadcastIntent(context, ACTION_SELECT_SUB, cat, subList[2], 0, 22));
            views.setOnClickPendingIntent(R.id.btn_sub_4, createBroadcastIntent(context, ACTION_SELECT_SUB, cat, subList[3], 0, 23));
            views.setOnClickPendingIntent(R.id.btn_sub_5, createBroadcastIntent(context, ACTION_SELECT_SUB, cat, subList[4], 0, 24));
            views.setOnClickPendingIntent(R.id.btn_sub_6, createBroadcastIntent(context, ACTION_SELECT_SUB, cat, subList[5], 0, 25));

        } else if (step == 2) {
            // STEP 3: Amount Selection
            views.setViewVisibility(R.id.layout_step_main, View.GONE);
            views.setViewVisibility(R.id.layout_step_sub, View.GONE);
            views.setViewVisibility(R.id.layout_step_amount, View.VISIBLE);

            views.setTextViewText(R.id.txt_step_hint, "第三步：【" + cat + "/" + sub + "】點擊金額即完成");

            views.setOnClickPendingIntent(R.id.btn_amt_50, createBroadcastIntent(context, ACTION_SELECT_AMT, cat, sub, 50, 30));
            views.setOnClickPendingIntent(R.id.btn_amt_85, createBroadcastIntent(context, ACTION_SELECT_AMT, cat, sub, 85, 31));
            views.setOnClickPendingIntent(R.id.btn_amt_130, createBroadcastIntent(context, ACTION_SELECT_AMT, cat, sub, 130, 32));
            views.setOnClickPendingIntent(R.id.btn_amt_180, createBroadcastIntent(context, ACTION_SELECT_AMT, cat, sub, 180, 33));
            views.setOnClickPendingIntent(R.id.btn_amt_250, createBroadcastIntent(context, ACTION_SELECT_AMT, cat, sub, 250, 34));
            views.setOnClickPendingIntent(R.id.btn_amt_500, createBroadcastIntent(context, ACTION_SELECT_AMT, cat, sub, 500, 35));
        }

        appWidgetManager.updateAppWidget(appWidgetId, views);
    }

    private String[] getSubCategories(String cat) {
        if ("娛樂".equals(cat)) return new String[]{"電影", "遊戲", "聚會", "戶外", "訂閱", "旅遊"};
        if ("交通".equals(cat)) return new String[]{"捷運", "加油", "公車", "高鐵", "叫車", "停車"};
        if ("日用".equals(cat)) return new String[]{"耗材", "清潔", "廚房", "家電", "雜貨", "個人"};
        if ("收入".equals(cat)) return new String[]{"正職", "獎金", "副業", "股息", "利息", "二手"};
        if ("投資".equals(cat)) return new String[]{"0050", "VOO", "美股", "定存", "加密幣", "黃金"};
        return new String[]{"早餐", "午餐", "晚餐", "宵夜", "點心", "飲料"};
    }

    private PendingIntent createBroadcastIntent(Context context, String action, String cat, String sub, int amt, int reqCode) {
        Intent intent = new Intent(context, QuickLogWidgetProvider.class);
        intent.setAction(action);
        if (cat != null) intent.putExtra(EXTRA_CAT, cat);
        if (sub != null) intent.putExtra(EXTRA_SUB, sub);
        if (amt > 0) intent.putExtra(EXTRA_AMT, amt);
        return PendingIntent.getBroadcast(
            context,
            reqCode,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
    }
}
