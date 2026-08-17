package com.firecalculator.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.view.View;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Locale;

public class QuickLogWidgetProvider extends AppWidgetProvider {

    public static final String ACTION_SELECT_MAIN = "com.firecalculator.app.WIDGET_SELECT_MAIN";
    public static final String ACTION_NEXT_CAT_PAGE = "com.firecalculator.app.WIDGET_NEXT_CAT_PAGE";
    public static final String ACTION_SELECT_SUB = "com.firecalculator.app.WIDGET_SELECT_SUB";
    public static final String ACTION_NEXT_SUB_PAGE = "com.firecalculator.app.WIDGET_NEXT_SUB_PAGE";
    public static final String ACTION_KEY_DIGIT = "com.firecalculator.app.WIDGET_KEY_DIGIT";
    public static final String ACTION_KEY_DEL = "com.firecalculator.app.WIDGET_KEY_DEL";
    public static final String ACTION_KEY_CLEAR = "com.firecalculator.app.WIDGET_KEY_CLEAR";
    public static final String ACTION_KEY_PLUS = "com.firecalculator.app.WIDGET_KEY_PLUS";
    public static final String ACTION_CONFIRM = "com.firecalculator.app.WIDGET_CONFIRM";
    public static final String ACTION_RESET = "com.firecalculator.app.WIDGET_RESET";
    public static final String ACTION_PREV_STEP = "com.firecalculator.app.WIDGET_PREV_STEP";

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
        if (action == null) return;

        SharedPreferences prefs = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);

        if (ACTION_SELECT_MAIN.equals(action)) {
            String cat = intent.getStringExtra(EXTRA_CAT);
            if (cat == null) cat = "飲食";
            prefs.edit()
                    .putString("selected_cat", cat)
                    .putInt("step", 1)
                    .putInt("sub_page", 0)
                    .apply();
            updateAllWidgets(context);

        } else if (ACTION_NEXT_CAT_PAGE.equals(action)) {
            int currentPage = prefs.getInt("cat_page", 0);
            prefs.edit().putInt("cat_page", currentPage + 1).apply();
            updateAllWidgets(context);

        } else if (ACTION_SELECT_SUB.equals(action)) {
            String sub = intent.getStringExtra(EXTRA_SUB);
            if (sub == null) sub = "一般";
            prefs.edit()
                    .putString("selected_sub", sub)
                    .putInt("step", 2)
                    .putString("entered_amt", "0")
                    .apply();
            updateAllWidgets(context);

        } else if (ACTION_NEXT_SUB_PAGE.equals(action)) {
            int currentPage = prefs.getInt("sub_page", 0);
            prefs.edit().putInt("sub_page", currentPage + 1).apply();
            updateAllWidgets(context);

        } else if (ACTION_KEY_DIGIT.equals(action)) {
            String digit = intent.getStringExtra(EXTRA_DIGIT);
            if (digit != null) {
                String current = prefs.getString("entered_amt", "0");
                if ("0".equals(current)) {
                    current = digit;
                } else {
                    if (current.length() < 7) {
                        current = current + digit;
                    }
                }
                prefs.edit().putString("entered_amt", current).apply();
            }
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
                final String cat = prefs.getString("selected_cat", "飲食");
                final String sub = prefs.getString("selected_sub", "一般");
                final String todayStr = new SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(new Date());
                final int finalAmt = amt;

                try {
                    final String txId = "t-widget-" + System.currentTimeMillis();
                    final String txType = "收入".equals(cat) ? "income" : "投資".equals(cat) ? "investment" : "expense";
                    final int cashDelta = "income".equals(txType) ? finalAmt : -finalAmt;

                    long currentTwd = prefs.getLong("cash_savings_twd", 0);
                    final long newTwd = currentTwd + cashDelta;

                    final JSONObject newTx = new JSONObject();
                    newTx.put("id", txId);
                    newTx.put("type", txType);
                    newTx.put("amount", finalAmt);
                    newTx.put("mainCategory", cat);
                    newTx.put("subCategory", sub);
                    newTx.put("date", todayStr);
                    newTx.put("note", "來自 Android 桌面小工具 1 秒速記");
                    newTx.put("isQuickPreset", true);

                    final JSONArray tagsArr = new JSONArray();
                    tagsArr.put("Widget");
                    newTx.put("tags", tagsArr);

                    // 1. 本地持久化與隊列保存 (0ms 即時反饋)
                    String pendingStr = prefs.getString("pending_widget_txs", "[]");
                    JSONArray pendingArr = new JSONArray(pendingStr);
                    pendingArr.put(newTx);

                    String txsJsonStr = prefs.getString("app_transactions_json", "[]");
                    JSONArray arr = new JSONArray(txsJsonStr);
                    JSONArray newArr = new JSONArray();
                    newArr.put(newTx);
                    for (int i = 0; i < arr.length(); i++) {
                        newArr.put(arr.get(i));
                    }

                    prefs.edit()
                            .putString("pending_widget_txs", pendingArr.toString())
                            .putString("app_transactions_json", newArr.toString())
                            .putLong("cash_savings_twd", newTwd)
                            .putInt("step", 0)
                            .putInt("cat_page", 0)
                            .putInt("sub_page", 0)
                            .putString("entered_amt", "0")
                            .putString("last_logged", "✅ 已記【" + cat + "/" + sub + "】$" + finalAmt)
                            .apply();

                    // 2. 原生後台直連 Supabase 上傳 (雙表連動：交易明細 + 現金儲備)
                    final String supabaseUrl = prefs.getString("supabase_url", "");
                    final String supabaseAnonKey = prefs.getString("supabase_anon_key", "");
                    final String syncCode = prefs.getString("sync_code", "FIRE-DEFAULT-2026");
                    final String storageMode = prefs.getString("storage_mode", "cloud");

                    if (!"local".equals(storageMode) && supabaseUrl != null && !supabaseUrl.isEmpty() && supabaseAnonKey != null && !supabaseAnonKey.isEmpty()) {
                        new Thread(new Runnable() {
                            @Override
                            public void run() {
                                try {
                                    String cleanUrl = supabaseUrl.trim().replaceAll("/+$", "");

                                    // A. 寫入 transactions 表
                                    URL url = new URL(cleanUrl + "/rest/v1/transactions");
                                    HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                                    conn.setRequestMethod("POST");
                                    conn.setRequestProperty("apikey", supabaseAnonKey);
                                    conn.setRequestProperty("Authorization", "Bearer " + supabaseAnonKey);
                                    conn.setRequestProperty("Content-Type", "application/json");
                                    conn.setRequestProperty("Prefer", "resolution=merge-duplicates");
                                    conn.setDoOutput(true);
                                    conn.setConnectTimeout(8000);
                                    conn.setReadTimeout(8000);

                                    JSONObject postRow = new JSONObject();
                                    postRow.put("id", txId);
                                    postRow.put("sync_code", syncCode);
                                    postRow.put("type", txType);
                                    postRow.put("amount", finalAmt);
                                    postRow.put("main_category", cat);
                                    postRow.put("sub_category", sub);
                                    postRow.put("date", todayStr);
                                    postRow.put("note", "來自 Android 桌面小工具 1 秒速記");
                                    postRow.put("is_quick_preset", true);
                                    postRow.put("tags", tagsArr);

                                    byte[] input = postRow.toString().getBytes(StandardCharsets.UTF_8);
                                    try (OutputStream os = conn.getOutputStream()) {
                                        os.write(input, 0, input.length);
                                    }

                                    int respCode = conn.getResponseCode();
                                    android.util.Log.d("WidgetSync", "Direct background sync to Supabase transactions: " + respCode);

                                    // B. 同步更新 fire_configs 現金儲備 (扣除/增減現金)
                                    try {
                                        URL configUrl = new URL(cleanUrl + "/rest/v1/fire_configs?sync_code=eq." + syncCode);
                                        HttpURLConnection configConn = (HttpURLConnection) configUrl.openConnection();
                                        configConn.setRequestMethod("PATCH");
                                        configConn.setRequestProperty("apikey", supabaseAnonKey);
                                        configConn.setRequestProperty("Authorization", "Bearer " + supabaseAnonKey);
                                        configConn.setRequestProperty("Content-Type", "application/json");
                                        configConn.setRequestProperty("Prefer", "return=minimal");
                                        configConn.setDoOutput(true);
                                        configConn.setConnectTimeout(8000);
                                        configConn.setReadTimeout(8000);

                                        JSONObject patchConfig = new JSONObject();
                                        patchConfig.put("cash_savings", newTwd);
                                        patchConfig.put("updated_at", new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).format(new Date()));

                                        byte[] configInput = patchConfig.toString().getBytes(StandardCharsets.UTF_8);
                                        try (OutputStream os = configConn.getOutputStream()) {
                                            os.write(configInput, 0, configInput.length);
                                        }
                                        int cfgResp = configConn.getResponseCode();
                                        android.util.Log.d("WidgetSync", "Direct cash savings patch status: " + cfgResp);
                                    } catch (Exception cfgEx) {
                                        android.util.Log.w("WidgetSync", "Direct cash savings patch exception: " + cfgEx.getMessage());
                                    }

                                } catch (Exception e) {
                                    android.util.Log.w("WidgetSync", "Background sync exception: " + e.getMessage());
                                }
                            }
                        }).start();
                    }

                } catch (Exception e) {
                    e.printStackTrace();
                }
            }

            updateAllWidgets(context);

        } else if (ACTION_RESET.equals(action)) {
            prefs.edit()
                    .putInt("step", 0)
                    .putInt("cat_page", 0)
                    .putInt("sub_page", 0)
                    .putString("entered_amt", "0")
                    .apply();
            updateAllWidgets(context);

        } else if (ACTION_PREV_STEP.equals(action)) {
            int currentStep = prefs.getInt("step", 0);
            int prevStep = Math.max(0, currentStep - 1);
            prefs.edit().putInt("step", prevStep).apply();
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

        int todayExpense = calculateTodayExpense(prefs, todayStr);
        int step = prefs.getInt("step", 0);
        String selectedCat = prefs.getString("selected_cat", "飲食");
        String selectedSub = prefs.getString("selected_sub", "午餐");
        String enteredAmt = prefs.getString("entered_amt", "0");
        String lastLogged = prefs.getString("last_logged", "");

        // 1. Top Bar Total Expense
        views.setTextViewText(R.id.txt_today_expense, "NT$ " + formatNumber(todayExpense));

        // 2. Control Layout Visibility based on Step
        views.setViewVisibility(R.id.layout_step_main, step == 0 ? View.VISIBLE : View.GONE);
        views.setViewVisibility(R.id.layout_step_sub, step == 1 ? View.VISIBLE : View.GONE);
        views.setViewVisibility(R.id.layout_step_amount, step == 2 ? View.VISIBLE : View.GONE);
        views.setViewVisibility(R.id.btn_prev_step, step > 0 ? View.VISIBLE : View.GONE);

        // 3. Breadcrumb / Step Hint
        if (step == 0) {
            if (lastLogged != null && !lastLogged.isEmpty()) {
                views.setTextViewText(R.id.txt_step_hint, lastLogged);
            } else {
                views.setTextViewText(R.id.txt_step_hint, "第一步：請選擇【大類】");
            }
        } else if (step == 1) {
            views.setTextViewText(R.id.txt_step_hint, "【" + selectedCat + "】➡ 第二步：選擇【細項】");
        } else {
            views.setTextViewText(R.id.txt_step_hint, "【" + selectedCat + " / " + selectedSub + "】➡ 輸入金額");
            views.setTextViewText(R.id.txt_entered_amount, enteredAmt);
        }

        // 4. Setup Dynamic Categories for STEP 1 (with Pagination)
        setupDynamicCategories(context, views, prefs, appWidgetId);

        // 5. Setup Dynamic Subcategories for STEP 2 (with Pagination)
        setupDynamicSubCategories(context, views, prefs, selectedCat, appWidgetId);

        // 6. Setup Step 3 Numeric Keypad PendingIntents
        setupKeypadPendingIntents(context, views, appWidgetId);

        // 7. Navigation Buttons
        views.setOnClickPendingIntent(R.id.btn_prev_step, getPendingSelfIntent(context, ACTION_PREV_STEP, appWidgetId));
        views.setOnClickPendingIntent(R.id.btn_reset_step, getPendingSelfIntent(context, ACTION_RESET, appWidgetId));

        // 8. Launch App Quick Add Modal Intent
        Intent launchAppIntent = new Intent(Intent.ACTION_VIEW, Uri.parse("fireplanner://app/quick-add"));
        launchAppIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent launchPi = PendingIntent.getActivity(
                context,
                appWidgetId + 9999,
                launchAppIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        views.setOnClickPendingIntent(R.id.btn_launch_app_modal, launchPi);

        appWidgetManager.updateAppWidget(appWidgetId, views);
    }

    private void setupDynamicCategories(Context context, RemoteViews views, SharedPreferences prefs, int appWidgetId) {
        List<String> allCats = new ArrayList<>();
        try {
            String allCatsJson = prefs.getString("all_categories_json", "");
            if (allCatsJson != null && !allCatsJson.isEmpty()) {
                JSONArray arr = new JSONArray(allCatsJson);
                for (int i = 0; i < arr.length(); i++) {
                    JSONObject obj = arr.getJSONObject(i);
                    String name = obj.optString("name", "");
                    if (!name.isEmpty() && !allCats.contains(name)) {
                        allCats.add(name);
                    }
                }
            }
        } catch (Exception ignored) {}

        if (allCats.isEmpty()) {
            allCats.add("🍔 飲食");
            allCats.add("🎮 娛樂");
            allCats.add("🚗 交通");
            allCats.add("🛍️ 日用");
            allCats.add("💰 收入");
            allCats.add("🚀 投資");
        }

        int[] catBtnIds = new int[]{
                R.id.btn_cat_1, R.id.btn_cat_2, R.id.btn_cat_3,
                R.id.btn_cat_4, R.id.btn_cat_5, R.id.btn_cat_6
        };

        int totalCats = allCats.size();
        if (totalCats <= 6) {
            for (int i = 0; i < 6; i++) {
                int btnId = catBtnIds[i];
                if (i < totalCats) {
                    String catName = allCats.get(i);
                    views.setViewVisibility(btnId, View.VISIBLE);
                    views.setTextViewText(btnId, catName);
                    views.setOnClickPendingIntent(btnId, getCategorySelectIntent(context, catName, appWidgetId));
                } else {
                    views.setViewVisibility(btnId, View.INVISIBLE);
                }
            }
        } else {
            // Pagination: 5 items per page + 1 "More" button
            int pageSize = 5;
            int totalPages = (int) Math.ceil((double) totalCats / pageSize);
            int catPage = prefs.getInt("cat_page", 0) % totalPages;
            int startIndex = catPage * pageSize;

            for (int i = 0; i < 5; i++) {
                int btnId = catBtnIds[i];
                int catIndex = startIndex + i;
                if (catIndex < totalCats) {
                    String catName = allCats.get(catIndex);
                    views.setViewVisibility(btnId, View.VISIBLE);
                    views.setTextViewText(btnId, catName);
                    views.setOnClickPendingIntent(btnId, getCategorySelectIntent(context, catName, appWidgetId));
                } else {
                    views.setViewVisibility(btnId, View.INVISIBLE);
                }
            }

            // Button 6 is "More" pagination
            int moreBtnId = catBtnIds[5];
            views.setViewVisibility(moreBtnId, View.VISIBLE);
            views.setTextViewText(moreBtnId, "➡️ 更多 (" + (catPage + 1) + "/" + totalPages + ")");
            views.setOnClickPendingIntent(moreBtnId, getPendingSelfIntent(context, ACTION_NEXT_CAT_PAGE, appWidgetId));
        }
    }

    private void setupDynamicSubCategories(Context context, RemoteViews views, SharedPreferences prefs, String mainCat, int appWidgetId) {
        List<String> subList = new ArrayList<>();
        try {
            String allCatsJson = prefs.getString("all_categories_json", "");
            if (allCatsJson != null && !allCatsJson.isEmpty()) {
                JSONArray arr = new JSONArray(allCatsJson);
                for (int i = 0; i < arr.length(); i++) {
                    JSONObject obj = arr.getJSONObject(i);
                    String name = obj.optString("name", "");
                    if (name.equals(mainCat) || cleanEmoji(name).equals(cleanEmoji(mainCat))) {
                        JSONArray subsArr = obj.optJSONArray("subCategories");
                        if (subsArr != null) {
                            for (int j = 0; j < subsArr.length(); j++) {
                                String s = subsArr.optString(j, "");
                                if (!s.isEmpty()) subList.add(s);
                            }
                        }
                        break;
                    }
                }
            }
        } catch (Exception ignored) {}

        if (subList.isEmpty()) {
            if (mainCat.contains("飲食") || mainCat.contains("food")) {
                subList = List.of("早餐", "午餐", "晚餐", "宵夜", "飲料", "生鮮");
            } else if (mainCat.contains("娛樂")) {
                subList = List.of("電影", "遊戲", "聚會", "旅遊", "訂閱", "運動");
            } else if (mainCat.contains("交通")) {
                subList = List.of("捷運", "公車", "加油", "計程車", "停車", "高鐵");
            } else if (mainCat.contains("收入")) {
                subList = List.of("薪資", "獎金", "副業", "股息", "利息", "發票");
            } else {
                subList = List.of("一般", "自訂項目", "固定扣款", "其它");
            }
        }

        int[] subBtnIds = new int[]{
                R.id.btn_sub_1, R.id.btn_sub_2, R.id.btn_sub_3,
                R.id.btn_sub_4, R.id.btn_sub_5, R.id.btn_sub_6
        };

        int totalSubs = subList.size();
        if (totalSubs <= 6) {
            for (int i = 0; i < 6; i++) {
                int btnId = subBtnIds[i];
                if (i < totalSubs) {
                    String subName = subList.get(i);
                    views.setViewVisibility(btnId, View.VISIBLE);
                    views.setTextViewText(btnId, subName);
                    views.setOnClickPendingIntent(btnId, getSubSelectIntent(context, subName, appWidgetId));
                } else {
                    views.setViewVisibility(btnId, View.INVISIBLE);
                }
            }
        } else {
            // Pagination: 5 items per page + 1 "More" button
            int pageSize = 5;
            int totalPages = (int) Math.ceil((double) totalSubs / pageSize);
            int subPage = prefs.getInt("sub_page", 0) % totalPages;
            int startIndex = subPage * pageSize;

            for (int i = 0; i < 5; i++) {
                int btnId = subBtnIds[i];
                int subIndex = startIndex + i;
                if (subIndex < totalSubs) {
                    String subName = subList.get(subIndex);
                    views.setViewVisibility(btnId, View.VISIBLE);
                    views.setTextViewText(btnId, subName);
                    views.setOnClickPendingIntent(btnId, getSubSelectIntent(context, subName, appWidgetId));
                } else {
                    views.setViewVisibility(btnId, View.INVISIBLE);
                }
            }

            int moreBtnId = subBtnIds[5];
            views.setViewVisibility(moreBtnId, View.VISIBLE);
            views.setTextViewText(moreBtnId, "➡️ 更多 (" + (subPage + 1) + "/" + totalPages + ")");
            views.setOnClickPendingIntent(moreBtnId, getPendingSelfIntent(context, ACTION_NEXT_SUB_PAGE, appWidgetId));
        }
    }

    private void setupKeypadPendingIntents(Context context, RemoteViews views, int appWidgetId) {
        int[] digitIds = new int[]{
                R.id.key_0, R.id.key_1, R.id.key_2, R.id.key_3, R.id.key_4,
                R.id.key_5, R.id.key_6, R.id.key_7, R.id.key_8, R.id.key_9
        };
        for (int i = 0; i <= 9; i++) {
            views.setOnClickPendingIntent(digitIds[i], getDigitIntent(context, String.valueOf(i), appWidgetId));
        }
        views.setOnClickPendingIntent(R.id.key_00, getDigitIntent(context, "00", appWidgetId));

        views.setOnClickPendingIntent(R.id.key_plus100, getPlusIntent(context, 100, appWidgetId));
        views.setOnClickPendingIntent(R.id.key_plus500, getPlusIntent(context, 500, appWidgetId));
        views.setOnClickPendingIntent(R.id.key_del, getPendingSelfIntent(context, ACTION_KEY_DEL, appWidgetId));
        views.setOnClickPendingIntent(R.id.key_clear, getPendingSelfIntent(context, ACTION_KEY_CLEAR, appWidgetId));
        views.setOnClickPendingIntent(R.id.key_confirm, getPendingSelfIntent(context, ACTION_CONFIRM, appWidgetId));
    }

    private PendingIntent getCategorySelectIntent(Context context, String catName, int appWidgetId) {
        Intent intent = new Intent(context, QuickLogWidgetProvider.class);
        intent.setAction(ACTION_SELECT_MAIN);
        intent.putExtra(EXTRA_CAT, catName);
        return PendingIntent.getBroadcast(
                context,
                appWidgetId * 100 + Math.abs(catName.hashCode() % 1000),
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
    }

    private PendingIntent getSubSelectIntent(Context context, String subName, int appWidgetId) {
        Intent intent = new Intent(context, QuickLogWidgetProvider.class);
        intent.setAction(ACTION_SELECT_SUB);
        intent.putExtra(EXTRA_SUB, subName);
        return PendingIntent.getBroadcast(
                context,
                appWidgetId * 1000 + Math.abs(subName.hashCode() % 1000),
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
    }

    private PendingIntent getDigitIntent(Context context, String digit, int appWidgetId) {
        Intent intent = new Intent(context, QuickLogWidgetProvider.class);
        intent.setAction(ACTION_KEY_DIGIT);
        intent.putExtra(EXTRA_DIGIT, digit);
        return PendingIntent.getBroadcast(
                context,
                appWidgetId * 10000 + Math.abs(digit.hashCode() % 1000),
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
    }

    private PendingIntent getPlusIntent(Context context, int plus, int appWidgetId) {
        Intent intent = new Intent(context, QuickLogWidgetProvider.class);
        intent.setAction(ACTION_KEY_PLUS);
        intent.putExtra(EXTRA_PLUS, plus);
        return PendingIntent.getBroadcast(
                context,
                appWidgetId * 100000 + plus,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
    }

    private PendingIntent getPendingSelfIntent(Context context, String action, int appWidgetId) {
        Intent intent = new Intent(context, QuickLogWidgetProvider.class);
        intent.setAction(action);
        return PendingIntent.getBroadcast(
                context,
                appWidgetId * 10 + Math.abs(action.hashCode() % 1000),
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
    }

    private int calculateTodayExpense(SharedPreferences prefs, String todayStr) {
        int sum = 0;
        try {
            String txsJson = prefs.getString("app_transactions_json", "[]");
            JSONArray arr = new JSONArray(txsJson);
            for (int i = 0; i < arr.length(); i++) {
                JSONObject obj = arr.getJSONObject(i);
                String date = obj.optString("date", "");
                String type = obj.optString("type", "expense");
                int amt = obj.optInt("amount", 0);
                if (todayStr.equals(date) && !"income".equals(type)) {
                    sum += amt;
                }
            }
        } catch (Exception ignored) {}

        if (sum == 0) {
            sum = prefs.getInt("today_expense", 0);
        }
        return sum;
    }

    private String cleanEmoji(String s) {
        if (s == null) return "";
        return s.replaceAll("[^\\p{L}\\p{N}]", "").trim();
    }

    private String formatNumber(int val) {
        return String.format(Locale.getDefault(), "%,d", val);
    }
}
