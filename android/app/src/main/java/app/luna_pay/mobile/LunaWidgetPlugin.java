package app.luna_pay.mobile;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Puente Capacitor del widget de Luna. La app (src/lib/lunaWidget.js) manda
 * aquí la "foto" de los pagos de Personal y el widget se redibuja con ella.
 * Registrado en MainActivity (plugin local, no es un paquete de npm).
 */
@CapacitorPlugin(name = "LunaWidget")
public class LunaWidgetPlugin extends Plugin {

    @PluginMethod
    public void sync(PluginCall call) {
        String snapshot = call.getString("snapshot");
        if (snapshot == null) {
            call.reject("snapshot requerido");
            return;
        }
        LunaWidgetStore.saveLang(getContext(), call.getString("lang"));
        LunaWidgetStore.saveSnapshot(getContext(), snapshot);
        LunaWidgetProvider.refreshAll(getContext());
        call.resolve();
    }

    @PluginMethod
    public void clear(PluginCall call) {
        LunaWidgetStore.clear(getContext());
        LunaWidgetProvider.refreshAll(getContext());
        call.resolve();
    }
}
