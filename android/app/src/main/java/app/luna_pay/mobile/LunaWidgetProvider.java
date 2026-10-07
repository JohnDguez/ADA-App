package app.luna_pay.mobile;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.RectF;
import android.widget.RemoteViews;

/**
 * Widget 4x2 de Luna (pantalla de inicio de Android). Solo Personal; los
 * espacios compartidos tendrán su propio widget, sin mezclar datos.
 *
 * Se redibuja cuando: lo pide el sistema (cada ~30 min, ver
 * xml/luna_widget_info.xml), cambia la fecha/hora/zona del teléfono, se abre
 * la app (MainActivity.onResume) o la app manda una foto nueva de los pagos
 * (LunaWidgetPlugin). En todos los casos el estado se recalcula aquí, con
 * LunaWidgetState, sin ejecutar JS.
 *
 * Diseño aprobado en mockup (octubre 2026): fondo con degradado por estado
 * (colores de la app, claro/oscuro con values-night/colors.xml), Luna a la
 * izquierda, frase del estado, mini anillo "hechos/total". Tocarlo abre la app.
 */
public class LunaWidgetProvider extends AppWidgetProvider {

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] appWidgetIds) {
        for (int id : appWidgetIds) {
            manager.updateAppWidget(id, build(context));
        }
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);
        String action = intent != null ? intent.getAction() : null;
        if (Intent.ACTION_DATE_CHANGED.equals(action)
                || Intent.ACTION_TIME_CHANGED.equals(action)
                || Intent.ACTION_TIMEZONE_CHANGED.equals(action)) {
            refreshAll(context);
        }
    }

    /** Redibuja todos los widgets de Luna que haya en la pantalla de inicio. */
    static void refreshAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        int[] ids = manager.getAppWidgetIds(new ComponentName(context, LunaWidgetProvider.class));
        if (ids == null || ids.length == 0) return;
        RemoteViews views = build(context);
        for (int id : ids) {
            manager.updateAppWidget(id, views);
        }
    }

    private static RemoteViews build(Context context) {
        LunaWidgetState s = LunaWidgetState.compute(
                LunaWidgetStore.loadSnapshot(context),
                LunaWidgetStore.lastOpen(context),
                System.currentTimeMillis());

        // Los estados con fondo oscuro fijo usan el layout con texto claro; el
        // resto toma el color de texto del tema (claro/oscuro) al inflarse.
        RemoteViews v = new RemoteViews(context.getPackageName(),
                s.isNight() ? R.layout.luna_widget_4x2_night : R.layout.luna_widget_4x2);

        // Textos en el idioma de la app (no el del teléfono).
        Context lc = LunaWidgetStore.localized(context);

        v.setImageViewResource(R.id.luna_image, imageFor(s.key));
        v.setInt(R.id.luna_root, "setBackgroundResource", backgroundFor(s.key));
        v.setTextViewText(R.id.luna_title, titleFor(lc, s));
        v.setTextViewText(R.id.luna_sub, subFor(lc, s));

        boolean showProgress = s.total > 0;
        v.setViewVisibility(R.id.luna_progress, showProgress ? android.view.View.VISIBLE : android.view.View.GONE);
        if (showProgress) {
            v.setImageViewBitmap(R.id.luna_ring, drawRing(context, s));
            v.setTextViewText(R.id.luna_fraction, s.done + "/" + s.total);
            v.setTextViewText(R.id.luna_count, lc.getString(R.string.luna_progress, s.done, s.total));
        }

        Intent launch = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
        if (launch != null) {
            PendingIntent pi = PendingIntent.getActivity(context, 0, launch,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            v.setOnClickPendingIntent(R.id.luna_root, pi);
        }
        return v;
    }

    // ── Imagen y fondo por estado ────────────────────────────────────────
    private static int imageFor(String key) {
        switch (key) {
            case LunaWidgetState.HAPPY:       return R.drawable.luna_happy;
            case LunaWidgetState.ATTENTIVE:   return R.drawable.luna_attentive;
            case LunaWidgetState.WORRIED:     return R.drawable.luna_worried;
            case LunaWidgetState.CELEBRATING: return R.drawable.luna_celebrating;
            case LunaWidgetState.SLEEPING:    return R.drawable.luna_sleeping;
            case LunaWidgetState.DUSTY:       return R.drawable.luna_dusty;
            case LunaWidgetState.AWAY:        return R.drawable.luna_away;
            default:                          return R.drawable.luna_waving;
        }
    }

    private static int backgroundFor(String key) {
        switch (key) {
            case LunaWidgetState.HAPPY:       return R.drawable.luna_widget_bg_happy;
            case LunaWidgetState.ATTENTIVE:   return R.drawable.luna_widget_bg_attentive;
            case LunaWidgetState.WORRIED:     return R.drawable.luna_widget_bg_worried;
            case LunaWidgetState.CELEBRATING: return R.drawable.luna_widget_bg_celebrating;
            case LunaWidgetState.SLEEPING:    return R.drawable.luna_widget_bg_sleeping;
            case LunaWidgetState.DUSTY:       return R.drawable.luna_widget_bg_dusty;
            case LunaWidgetState.AWAY:        return R.drawable.luna_widget_bg_away;
            default:                          return R.drawable.luna_widget_bg_waving;
        }
    }

    // ── Textos (mismos del strip de la app, ver `luna.*` en es.json/en.json) ──
    private static String whenText(Context c, int days) {
        if (days <= 0) return c.getString(R.string.luna_when_today);
        if (days == 1) return c.getString(R.string.luna_when_tomorrow);
        return c.getResources().getQuantityString(R.plurals.luna_when_in_days, days, days);
    }

    private static String titleFor(Context c, LunaWidgetState s) {
        switch (s.key) {
            case LunaWidgetState.HAPPY:
                return c.getString(R.string.luna_happy_title);
            case LunaWidgetState.ATTENTIVE:
                return c.getString(s.nextDays <= 0 ? R.string.luna_attentive_title_today : R.string.luna_attentive_title_tomorrow, s.nextName);
            case LunaWidgetState.WORRIED:
                return c.getResources().getQuantityString(R.plurals.luna_worried_title, s.overdueCount, s.overdueCount);
            case LunaWidgetState.CELEBRATING:
                return c.getString(R.string.luna_celebrating_title);
            case LunaWidgetState.SLEEPING:
                return c.getString(R.string.luna_sleeping_title);
            case LunaWidgetState.DUSTY:
                return c.getString(R.string.luna_dusty_title);
            case LunaWidgetState.AWAY:
                return c.getString(R.string.luna_away_title);
            default:
                return c.getString(R.string.luna_waving_title);
        }
    }

    private static String subFor(Context c, LunaWidgetState s) {
        switch (s.key) {
            case LunaWidgetState.HAPPY:
                return c.getString(R.string.luna_next_payment, s.nextName, whenText(c, s.nextDays));
            case LunaWidgetState.ATTENTIVE:
                return s.moreThisWeek > 0
                        ? c.getResources().getQuantityString(R.plurals.luna_attentive_sub_more, s.moreThisWeek, s.moreThisWeek)
                        : c.getString(R.string.luna_attentive_sub_none);
            case LunaWidgetState.WORRIED:
                return c.getString(R.string.luna_worried_sub);
            case LunaWidgetState.CELEBRATING:
                return c.getString(R.string.luna_celebrating_sub);
            case LunaWidgetState.SLEEPING:
                return c.getString(R.string.luna_sleeping_sub, s.nextName, whenText(c, s.nextDays));
            case LunaWidgetState.DUSTY:
                return c.getResources().getQuantityString(R.plurals.luna_dusty_sub, s.idleDays, s.idleDays);
            case LunaWidgetState.AWAY:
                return c.getString(R.string.luna_away_sub);
            default:
                return c.getString(s.hasSnapshot ? R.string.luna_waving_sub : R.string.luna_waving_sub_open);
        }
    }

    // ── Mini anillo "hechos/total" (mismo trazo que LunaStrip.jsx) ─────────
    private static Bitmap drawRing(Context c, LunaWidgetState s) {
        final int size = 120;
        final float stroke = size * 5f / 48f;
        final float inset = size * 6f / 48f; // línea central del trazo (r=18 en un viewBox de 48)
        boolean night = s.isNight();
        int bg    = c.getColor(night ? R.color.luna_night_surface : R.color.luna_ring_bg);
        int track = c.getColor(night ? R.color.luna_night_track   : R.color.luna_ring_track);
        int ring  = c.getColor(night ? R.color.luna_night_accent
                : LunaWidgetState.WORRIED.equals(s.key) ? R.color.luna_ring_danger
                : (LunaWidgetState.DUSTY.equals(s.key) || LunaWidgetState.AWAY.equals(s.key)) ? R.color.luna_ring_idle
                : R.color.luna_ring);

        Bitmap bmp = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(bmp);
        Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);
        p.setStyle(Paint.Style.FILL);
        p.setColor(bg);
        canvas.drawCircle(size / 2f, size / 2f, size / 2f, p);

        RectF oval = new RectF(inset, inset, size - inset, size - inset);
        p.setStyle(Paint.Style.STROKE);
        p.setStrokeWidth(stroke);
        p.setColor(track);
        canvas.drawOval(oval, p);

        float pct = s.total > 0 ? (float) s.done / s.total : 0f;
        if (pct > 0f) {
            p.setColor(ring);
            p.setStrokeCap(Paint.Cap.ROUND);
            canvas.drawArc(oval, -90f, 360f * Math.min(1f, pct), false, p);
        }
        return bmp;
    }
}
