package app.luna_pay.mobile;

import android.content.Context;
import android.content.SharedPreferences;

/**
 * Almacén del widget de Luna (SharedPreferences, solo lectura/escritura local).
 *
 * Guarda 2 cosas: la "foto" de los pagos de Personal que manda la app (JSON,
 * ver src/lib/lunaWidget.js) y la última vez que se abrió la app — esta
 * última la escribe MainActivity.onResume(), sin depender de JS, y es lo que
 * usa el widget para los estados de "ausencia" (telarañas / salió a pasear).
 */
final class LunaWidgetStore {
    private static final String PREFS = "luna_widget";
    private static final String KEY_SNAPSHOT = "snapshot";
    private static final String KEY_LAST_OPEN = "last_open";
    private static final String KEY_LANG = "lang";

    private LunaWidgetStore() {}

    private static SharedPreferences prefs(Context c) {
        return c.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    static void saveSnapshot(Context c, String json) {
        prefs(c).edit().putString(KEY_SNAPSHOT, json).putLong(KEY_LAST_OPEN, System.currentTimeMillis()).apply();
    }

    /** Idioma de la app (no el del teléfono): el widget lo usa para sus textos. */
    static void saveLang(Context c, String lang) {
        if (lang == null || lang.isEmpty()) return;
        prefs(c).edit().putString(KEY_LANG, lang).apply();
    }

    /** Context con el idioma elegido en la app; si no hay, el del teléfono. */
    static Context localized(Context c) {
        String lang = prefs(c).getString(KEY_LANG, null);
        if (lang == null || lang.isEmpty()) return c;
        android.content.res.Configuration cfg = new android.content.res.Configuration(c.getResources().getConfiguration());
        cfg.setLocale(new java.util.Locale(lang));
        return c.createConfigurationContext(cfg);
    }

    static String loadSnapshot(Context c) {
        return prefs(c).getString(KEY_SNAPSHOT, null);
    }

    /** Cierre de sesión: se borra la foto y la fecha, el widget vuelve a saludar. */
    static void clear(Context c) {
        prefs(c).edit().remove(KEY_SNAPSHOT).remove(KEY_LAST_OPEN).apply();
    }

    static void touchOpen(Context c) {
        prefs(c).edit().putLong(KEY_LAST_OPEN, System.currentTimeMillis()).apply();
    }

    /** 0 = nunca se registró (no cuenta como "ausente"). */
    static long lastOpen(Context c) {
        return prefs(c).getLong(KEY_LAST_OPEN, 0L);
    }
}
