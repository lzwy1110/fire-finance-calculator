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
    public static final String ACTION_KEY_DIGIT = "com.firecalculator.app.WIDGET_KEY_DIGIT";
    public static final String ACTION_KEY_DEL = "com.firecalculator.app.WIDGET_KEY_DEL";
    public static final String ACTION_KEY_CLEAR = "com.firecalculator.app.WIDGET_KEY_CLEAR";
    public static final String ACTION_KEY_PLUS = "com.firecalculator.app.WIDGET_KEY_PLUS";
    public static final String ACTION_CONFIRM = "com.firecalculator.app.WIDGET_CONFIRM";
    public static final String ACTION_RESET = "com.firecalculator.app.WIDGET_RESET";

    public static final String EXTRA_CAT = "extra_cat";
    public static final String EXTRA_SUB = "extra_sub";
    public static final String EXTRA_DIGIT = "extra_digit";
    public static final String EXTRA_PLUS = "extra_plus";

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
                    .putString("entered_amt", "0")
                    .apply();
            updateAllWidgets(context);

        } else if (ACTION_KEY_DIGIT.equals(action)) {
            String digit = intent.getStringExtra(EXTRA_DIGIT);
            String current = prefs.getString("entered_amt", "0");
            if ("0".equals(current)) {
                current = digit;
            } else {
                if (current.length() < 7) {
                    current = current + digit;
                }
            }
            prefs.edit().putString("entered_amt", current).apply();
            updateAllWidgets(context);

        } else if (ACTION_KEY_DEL.equals(action)) {
            String current = prefs.getString("entered_amt", "0");
            if (current.length() > 1) {
                current = current.substring(0, current.length() - 1);
            } else {
                current = "0";
            }
            prefs.edit().putString("entered_amt", current).apply();
            updateAllWidgets(context);

        } else if (ACTION_KEY_CLEAR.equals(action)) {
            prefs.edit().putString("entered_amt", "0").apply();
            updateAllWidgets(context);

        } else if (ACTION_KEY_PLUS.equals(action)) {
            int plus = intent.getIntExtra(EXTRA_PLUS, 100);
            String current = prefs.getString("entered_amt", "0");
            int val = 0;
            try { val = Integer.parseInt(current); } catch (Exception ignored) {}
            val += plus;
            prefs.edit().putString("entered_amt", String.valueOf(val)).apply();
            updateAllWidgets(context);

        } else if (ACTION_CONFIRM.equals(action)) {
            String current = prefs.getString("entered_amt", "0");
            int amt = 0;
            try { amt = Integer.parseInt(current); } catch (Exception ignored) {}

            if (amt > 0) {
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
                            .putString("entered_amt", "0")
                            .putString("last_logged", "✅ 已記【" + cat + "/" + sub + "】$" + amt)
                            .apply();
                } catch (Exception e) {
                    e.printStackTrace();
                }
            }

            updateAllWidgets(context);

        } else if (ACTION_RESET.equals(action)) {
            prefs.edit().putInt("step", 0).putString("entered_amt", "0").apply();
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
        String enteredAmt = prefs.getString("entered_amt", "0");
        String lastLogged = prefs.getString("last_logged", "");

        // Set Today Expense Text
        views.setTextViewText(R.id.txt_today_expense, "NT$ " + todayExpense);
        views.setTextViewText(R.id.txt_entered_amount, enteredAmt);

        // Attach Reset Intent
        views.setOnClickPendingIntent(R.id.btn_reset_step, createBroadcastIntent(context, ACTION_RESET, null, null, null, 0, 99));

        if (step == 0) {
            // STEP 1: Main Category Selection
            views.setViewVisibility(R.id.layout_step_main, View.VISIBLE);
            views.setViewVisibility(R.id.layout_step_sub, View.GONE);
            views.setViewVisibility(R.id.layout_step_amount, View.GONE);

            String hint = lastLogged.isEmpty() ? "第一步：請選擇【大類】" : lastLogged;
            views.setTextViewText(R.id.txt_step_hint, hint);

            // Read custom main categories from SharedPreferences if configured
            String cat1 = prefs.getString("cfg_cat_1", "飲食");
            String cat2 = prefs.getString("cfg_cat_2", "娛樂");
            String cat3 = prefs.getString("cfg_cat_3", "交通");
            String cat4 = prefs.getString("cfg_cat_4", "日用");
            String cat5 = prefs.getString("cfg_cat_5", "收入");
            String cat6 = prefs.getString("cfg_cat_6", "投資");

            views.setTextViewText(R.id.btn_cat_food, getCatIcon(cat1) + " " + cat1);
            views.setTextViewText(R.id.btn_cat_ent, getCatIcon(cat2) + " " + cat2);
            views.setTextViewText(R.id.btn_cat_trans, getCatIcon(cat3) + " " + cat3);
            views.setTextViewText(R.id.btn_cat_daily, getCatIcon(cat4) + " " + cat4);
            views.setTextViewText(R.id.btn_cat_inc, getCatIcon(cat5) + " " + cat5);
            views.setTextViewText(R.id.btn_cat_inv, getCatIcon(cat6) + " " + cat6);

            views.setOnClickPendingIntent(R.id.btn_cat_food, createBroadcastIntent(context, ACTION_SELECT_MAIN, cat1, null, null, 0, 10));
            views.setOnClickPendingIntent(R.id.btn_cat_ent, createBroadcastIntent(context, ACTION_SELECT_MAIN, cat2, null, null, 0, 11));
            views.setOnClickPendingIntent(R.id.btn_cat_trans, createBroadcastIntent(context, ACTION_SELECT_MAIN, cat3, null, null, 0, 12));
            views.setOnClickPendingIntent(R.id.btn_cat_daily, createBroadcastIntent(context, ACTION_SELECT_MAIN, cat4, null, null, 0, 13));
            views.setOnClickPendingIntent(R.id.btn_cat_inc, createBroadcastIntent(context, ACTION_SELECT_MAIN, cat5, null, null, 0, 14));
            views.setOnClickPendingIntent(R.id.btn_cat_inv, createBroadcastIntent(context, ACTION_SELECT_MAIN, cat6, null, null, 0, 15));

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

            views.setOnClickPendingIntent(R.id.btn_sub_1, createBroadcastIntent(context, ACTION_SELECT_SUB, cat, subList[0], null, 0, 20));
            views.setOnClickPendingIntent(R.id.btn_sub_2, createBroadcastIntent(context, ACTION_SELECT_SUB, cat, subList[1], null, 0, 21));
            views.setOnClickPendingIntent(R.id.btn_sub_3, createBroadcastIntent(context, ACTION_SELECT_SUB, cat, subList[2], null, 0, 22));
            views.setOnClickPendingIntent(R.id.btn_sub_4, createBroadcastIntent(context, ACTION_SELECT_SUB, cat, subList[3], null, 0, 23));
            views.setOnClickPendingIntent(R.id.btn_sub_5, createBroadcastIntent(context, ACTION_SELECT_SUB, cat, subList[4], null, 0, 24));
            views.setOnClickPendingIntent(R.id.btn_sub_6, createBroadcastIntent(context, ACTION_SELECT_SUB, cat, subList[5], null, 0, 25));

        } else if (step == 2) {
            // STEP 3: Amount Keypad Input
            views.setViewVisibility(R.id.layout_step_main, View.GONE);
            views.setViewVisibility(R.id.layout_step_sub, View.GONE);
            views.setViewVisibility(R.id.layout_step_amount, View.VISIBLE);

            views.setTextViewText(R.id.txt_step_hint, "第三步：【" + cat + "/" + sub + "】輸入金額點擊確定");

            views.setOnClickPendingIntent(R.id.key_1, createBroadcastIntent(context, ACTION_KEY_DIGIT, null, null, "1", 0, 31));
            views.setOnClickPendingIntent(R.id.key_2, createBroadcastIntent(context, ACTION_KEY_DIGIT, null, null, "2", 0, 32));
            views.setOnClickPendingIntent(R.id.key_3, createBroadcastIntent(context, ACTION_KEY_DIGIT, null, null, "3", 0, 33));
            views.setOnClickPendingIntent(R.id.key_4, createBroadcastIntent(context, ACTION_KEY_DIGIT, null, null, "4", 0, 34));
            views.setOnClickPendingIntent(R.id.key_5, createBroadcastIntent(context, ACTION_KEY_DIGIT, null, null, "5", 0, 35));
            views.setOnClickPendingIntent(R.id.key_6, createBroadcastIntent(context, ACTION_KEY_DIGIT, null, null, "6", 0, 36));
            views.setOnClickPendingIntent(R.id.key_7, createBroadcastIntent(context, ACTION_KEY_DIGIT, null, null, "7", 0, 37));
            views.setOnClickPendingIntent(R.id.key_8, createBroadcastIntent(context, ACTION_KEY_DIGIT, null, null, "8", 0, 38));
            views.setOnClickPendingIntent(R.id.key_9, createBroadcastIntent(context, ACTION_KEY_DIGIT, null, null, "9", 0, 39));
            views.setOnClickPendingIntent(R.id.key_0, createBroadcastIntent(context, ACTION_KEY_DIGIT, null, null, "0", 0, 40));
            views.setOnClickPendingIntent(R.id.key_00, createBroadcastIntent(context, ACTION_KEY_DIGIT, null, null, "00", 0, 41));

            views.setOnClickPendingIntent(R.id.key_del, createBroadcastIntent(context, ACTION_KEY_DEL, null, null, null, 0, 42));
            views.setOnClickPendingIntent(R.id.key_clear, createBroadcastIntent(context, ACTION_KEY_CLEAR, null, null, null, 0, 43));

            views.setOnClickPendingIntent(R.id.key_plus100, createBroadcastIntent(context, ACTION_KEY_PLUS, null, null, null, 100, 44));
            views.setOnClickPendingIntent(R.id.key_plus500, createBroadcastIntent(context, ACTION_KEY_PLUS, null, null, null, 500, 45));

            views.setOnClickPendingIntent(R.id.key_confirm, createBroadcastIntent(context, ACTION_CONFIRM, null, null, null, 0, 46));
        }

        appWidgetManager.updateAppWidget(appWidgetId, views);
    }

    private String getCatIcon(String cat) {
        if ("飲食".equals(cat)) return "🍔";
        if ("娛樂".equals(cat)) return "🎮";
        if ("交通".equals(cat)) return "🚗";
        if ("日用".equals(cat)) return "🛍️";
        if ("居住".equals(cat)) return "🏠";
        if ("醫療".equals(cat)) return "💊";
        if ("服飾".equals(cat)) return "👕";
        if ("教育".equals(cat)) return "📚";
        if ("收入".equals(cat)) return "💰";
        if ("投資".equals(cat)) return "🚀";
        if ("稅金".equals(cat)) return "🏛️";
        return "🏷️";
    }

    private String[] getSubCategories(String cat) {
        if ("娛樂".equals(cat)) return new String[]{"電影", "遊戲", "聚會", "戶外", "訂閱", "旅遊"};
        if ("交通".equals(cat)) return new String[]{"捷運", "加油", "公車", "高鐵", "叫車", "停車"};
        if ("日用".equals(cat)) return new String[]{"耗材", "清潔", "廚房", "家電", "雜貨", "個人"};
        if ("居住".equals(cat)) return new String[]{"房租", "水電", "瓦斯", "網路", "管理", "維修"};
        if ("醫療".equals(cat)) return new String[]{"看診", "藥品", "保健", "健檢", "保險", "復健"};
        if ("服飾".equals(cat)) return new String[]{"服飾", "鞋包", "剪髮", "美妝", "保養", "飾品"};
        if ("教育".equals(cat)) return new String[]{"書籍", "課程", "證照", "軟體", "文具", "學費"};
        if ("收入".equals(cat)) return new String[]{"正職", "獎金", "副業", "股息", "利息", "二手"};
        if ("投資".equals(cat)) return new String[]{"0050", "VOO", "美股", "定存", "加密幣", "黃金"};
        return new String[]{"早餐", "午餐", "晚餐", "宵夜", "點心", "飲料"};
    }

    private PendingIntent createBroadcastIntent(Context context, String action, String cat, String sub, String digit, int plus, int reqCode) {
        Intent intent = new Intent(context, QuickLogWidgetProvider.class);
        intent.setAction(action);
        if (cat != null) intent.putExtra(EXTRA_CAT, cat);
        if (sub != null) intent.putExtra(EXTRA_SUB, sub);
        if (digit != null) intent.putExtra(EXTRA_DIGIT, digit);
        if (plus > 0) intent.putExtra(EXTRA_PLUS, plus);
        return PendingIntent.getBroadcast(
            context,
            reqCode,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
    }
}
