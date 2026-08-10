package com.firecalculator.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.widget.RemoteViews;

public class QuickLogWidgetProvider extends AppWidgetProvider {

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_quick_log);

            // Preset 1: 早餐 $85
            views.setOnClickPendingIntent(R.id.btn_preset_1, createPendingIntent(context, 1, "飲食", "早餐", 85));

            // Preset 2: 午餐 $130
            views.setOnClickPendingIntent(R.id.btn_preset_2, createPendingIntent(context, 2, "飲食", "午餐", 130));

            // Preset 3: 晚餐 $180
            views.setOnClickPendingIntent(R.id.btn_preset_3, createPendingIntent(context, 3, "飲食", "晚餐", 180));

            // Preset 4: 捷運 $35
            views.setOnClickPendingIntent(R.id.btn_preset_4, createPendingIntent(context, 4, "交通", "公車捷運", 35));

            // Preset 5: 加油 $150
            views.setOnClickPendingIntent(R.id.btn_preset_5, createPendingIntent(context, 5, "交通", "機車/汽車加油", 150));

            // Preset 6: 日用 $260
            views.setOnClickPendingIntent(R.id.btn_preset_6, createPendingIntent(context, 6, "日用品", "生活耗材", 260));

            // Full Custom Quick Add Button
            Intent customIntent = new Intent(context, MainActivity.class);
            customIntent.setData(Uri.parse("fireflow://quick-add"));
            customIntent.setAction(Intent.ACTION_VIEW);
            PendingIntent pendingCustom = PendingIntent.getActivity(
                context,
                100,
                customIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );
            views.setOnClickPendingIntent(R.id.btn_quick_add, pendingCustom);
            views.setOnClickPendingIntent(R.id.widget_root, pendingCustom);

            appWidgetManager.updateAppWidget(appWidgetId, views);
        }
    }

    private PendingIntent createPendingIntent(Context context, int requestCode, String cat, String sub, int amt) {
        Intent intent = new Intent(context, MainActivity.class);
        String url = "fireflow://quick-add?cat=" + Uri.encode(cat) + "&sub=" + Uri.encode(sub) + "&amt=" + amt;
        intent.setData(Uri.parse(url));
        intent.setAction(Intent.ACTION_VIEW);
        return PendingIntent.getActivity(
            context,
            requestCode,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
    }
}
