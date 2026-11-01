package app.luna_pay.mobile;

import android.graphics.Color;

import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Color de la franja de la barra de navegación del sistema (botones / gestos).
 * La WebView respeta esa franja con padding (MainActivity), así que lo que se
 * ve ahí es el fondo de la ventana: aquí se pinta con el mismo color que la
 * barra inferior de la app (--bottom-nav-bg) y los iconos del sistema se ponen
 * claros u oscuros según el brillo del color. JS: src/lib/systemBars.js.
 */
@CapacitorPlugin(name = "NavBarColor")
public class NavBarColorPlugin extends Plugin {

    @PluginMethod
    public void set(PluginCall call) {
        String hex = call.getString("color");
        if (hex == null) {
            call.reject("color requerido");
            return;
        }
        final int color;
        try {
            color = Color.parseColor(hex);
        } catch (IllegalArgumentException e) {
            call.reject("color inválido");
            return;
        }
        getActivity().runOnUiThread(() -> {
            getActivity().getWindow().getDecorView().setBackgroundColor(color);
            // Iconos del sistema oscuros solo si el fondo es claro.
            boolean lightBg = androidx.core.graphics.ColorUtils.calculateLuminance(color) > 0.5;
            WindowInsetsControllerCompat c = WindowCompat.getInsetsController(
                getActivity().getWindow(), getActivity().getWindow().getDecorView());
            c.setAppearanceLightNavigationBars(lightBg);
            call.resolve();
        });
    }
}
