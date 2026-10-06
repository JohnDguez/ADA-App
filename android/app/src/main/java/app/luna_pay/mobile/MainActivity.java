package app.luna_pay.mobile;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Plugin local del widget de Luna — se registra ANTES de super.onCreate().
        registerPlugin(LunaWidgetPlugin.class);
        super.onCreate(savedInstanceState);
    }

    @Override
    public void onResume() {
        super.onResume();
        // "Última vez que se abrió la app" — lo usan los estados de ausencia
        // del widget (telarañas / salió a pasear). Va aquí y no en JS para que
        // cuente aunque la app abra sin red o sin sesión.
        LunaWidgetStore.touchOpen(this);
        LunaWidgetProvider.refreshAll(this);
    }
}
