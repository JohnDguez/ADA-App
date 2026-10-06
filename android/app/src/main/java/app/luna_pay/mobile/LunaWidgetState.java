package app.luna_pay.mobile;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Calendar;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;

/**
 * Estado de Luna para el widget — puerto a Java de src/lib/lunaState.js más 2
 * estados que solo existen en el widget ("ausencia"). Si cambia la regla en
 * uno, cambiarla en el otro (mismo criterio en la app y en la pantalla de
 * inicio del teléfono).
 *
 * Prioridad (el primero que aplique gana):
 *   1. waving      → sin pagos en el periodo (o sin foto: nunca se abrió/cerró sesión)
 *   2. away        → 7+ días sin abrir la app (gana aun con pagos vencidos
 *                    acumulados — si dura mucho sin abrir, vencidos es lo normal)
 *   3. worried     → hay pagos vencidos
 *   4. celebrating → no queda nada por pagar y sí hubo pagos
 *   5. attentive   → algo vence hoy o mañana
 *   6. dusty       → 3+ días sin abrir la app
 *   7. sleeping    → de noche (22:00–5:59) y sin nada urgente
 *   8. happy       → todo en orden
 *
 * Todo con hora/fecha LOCAL, nunca UTC (Regla 22).
 */
final class LunaWidgetState {
    static final int IDLE_DAYS_DUSTY = 3;
    static final int IDLE_DAYS_AWAY = 7;
    static final int NIGHT_FROM = 22;
    static final int NIGHT_UNTIL = 6;

    static final String WAVING = "waving";
    static final String AWAY = "away";
    static final String WORRIED = "worried";
    static final String CELEBRATING = "celebrating";
    static final String ATTENTIVE = "attentive";
    static final String DUSTY = "dusty";
    static final String SLEEPING = "sleeping";
    static final String HAPPY = "happy";

    String key = WAVING;
    boolean hasSnapshot = false;
    int done = 0;
    int total = 0;
    String nextName = null;
    int nextDays = 0;
    int moreThisWeek = 0;
    int overdueCount = 0;
    int idleDays = 0;

    private static final class Item {
        final String name;
        final long dueMillis; // medianoche local del día de vencimiento
        Item(String name, long dueMillis) { this.name = name; this.dueMillis = dueMillis; }
    }

    static LunaWidgetState compute(String snapshotJson, long lastOpenMillis, long nowMillis) {
        LunaWidgetState s = new LunaWidgetState();
        long todayMidnight = midnight(nowMillis);

        if (lastOpenMillis > 0) {
            s.idleDays = (int) Math.max(0, Math.round((todayMidnight - midnight(lastOpenMillis)) / 86400000.0));
        }
        if (snapshotJson == null) return s; // waving, sin foto

        List<Item> pending = new ArrayList<>();
        try {
            JSONObject o = new JSONObject(snapshotJson);
            s.done = o.optInt("done", 0);
            JSONArray arr = o.optJSONArray("pending");
            if (arr != null) {
                for (int i = 0; i < arr.length(); i++) {
                    JSONObject p = arr.getJSONObject(i);
                    long due = parseDate(p.optString("d", ""), todayMidnight);
                    pending.add(new Item(p.optString("n", ""), due));
                }
            }
            s.hasSnapshot = true;
        } catch (JSONException e) {
            return s; // foto ilegible → waving
        }

        Collections.sort(pending, new Comparator<Item>() {
            @Override public int compare(Item a, Item b) { return Long.compare(a.dueMillis, b.dueMillis); }
        });

        List<Item> upcoming = new ArrayList<>();
        for (Item it : pending) {
            if (daysDiff(it.dueMillis, todayMidnight) < 0) s.overdueCount++;
            else upcoming.add(it);
        }
        s.total = s.done + pending.size();

        if (!upcoming.isEmpty()) {
            Item next = upcoming.get(0);
            s.nextName = next.name;
            s.nextDays = daysDiff(next.dueMillis, todayMidnight);
            for (int i = 1; i < upcoming.size(); i++) {
                if (daysDiff(upcoming.get(i).dueMillis, todayMidnight) <= 7) s.moreThisWeek++;
            }
        }

        int hour = hourOf(nowMillis);
        if (s.total == 0)                                       s.key = WAVING;
        else if (s.idleDays >= IDLE_DAYS_AWAY)                  s.key = AWAY;
        else if (s.overdueCount > 0)                            s.key = WORRIED;
        else if (pending.isEmpty())                             s.key = CELEBRATING;
        else if (s.nextName != null && s.nextDays <= 1)         s.key = ATTENTIVE;
        else if (s.idleDays >= IDLE_DAYS_DUSTY)                 s.key = DUSTY;
        else if (hour >= NIGHT_FROM || hour < NIGHT_UNTIL)      s.key = SLEEPING;
        else                                                    s.key = HAPPY;
        return s;
    }

    /** Los estados con fondo oscuro fijo (sin importar el tema del teléfono). */
    boolean isNight() {
        return SLEEPING.equals(key);
    }

    private static int daysDiff(long dueMillis, long todayMidnight) {
        return (int) Math.round((dueMillis - todayMidnight) / 86400000.0);
    }

    private static long midnight(long millis) {
        Calendar c = Calendar.getInstance();
        c.setTimeInMillis(millis);
        c.set(Calendar.HOUR_OF_DAY, 0);
        c.set(Calendar.MINUTE, 0);
        c.set(Calendar.SECOND, 0);
        c.set(Calendar.MILLISECOND, 0);
        return c.getTimeInMillis();
    }

    private static int hourOf(long millis) {
        Calendar c = Calendar.getInstance();
        c.setTimeInMillis(millis);
        return c.get(Calendar.HOUR_OF_DAY);
    }

    /** 'YYYY-MM-DD' → medianoche local de ese día (igual que dateOf() de utils.js). */
    private static long parseDate(String str, long fallback) {
        try {
            String[] p = str.split("-");
            Calendar c = Calendar.getInstance();
            c.clear();
            c.set(Integer.parseInt(p[0]), Integer.parseInt(p[1]) - 1, Integer.parseInt(p[2]), 0, 0, 0);
            return c.getTimeInMillis();
        } catch (Exception e) {
            return fallback;
        }
    }
}
