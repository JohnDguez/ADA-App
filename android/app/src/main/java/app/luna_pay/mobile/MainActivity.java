package app.luna_pay.mobile;

import android.graphics.Color;
import android.os.Bundle;
import android.view.View;
import android.webkit.WebView;

import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.WebViewListener;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Plugin local del widget de Luna — se registra ANTES de super.onCreate().
        registerPlugin(LunaWidgetPlugin.class);
        super.onCreate(savedInstanceState);
        setupEdgeToEdgeTop();
    }

    // Alto de la barra de estado en px CSS (se inyecta como --sat).
    private float statusBarCssPx = 0f;

    /**
     * Barra de estado transparente: la WebView se dibuja DETRÁS de la barra
     * (hora, batería e iconos quedan encima de la app). Solo arriba — abajo
     * se respeta la barra de navegación (padding) para no tapar los modales.
     * Requiere SystemBars.insetsHandling = 'disable' en capacitor.config.ts.
     */
    private void setupEdgeToEdgeTop() {
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        getWindow().setStatusBarColor(Color.TRANSPARENT);

        View decor = getWindow().getDecorView();
        ViewCompat.setOnApplyWindowInsetsListener(decor, (v, insets) -> {
            Insets bars = insets.getInsets(
                WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
            Insets ime = insets.getInsets(WindowInsetsCompat.Type.ime());
            boolean imeVisible = insets.isVisible(WindowInsetsCompat.Type.ime());

            // Arriba 0 (la web se mete bajo la barra); abajo/lados respetan la barra de navegación.
            v.setPadding(bars.left, 0, bars.right, imeVisible ? ime.bottom : bars.bottom);

            statusBarCssPx = bars.top / getResources().getDisplayMetrics().density;
            injectStatusBarInset();

            // Mismo truco que Capacitor: no devolver CONSUMED (rompe el recálculo del WebView).
            return new WindowInsetsCompat.Builder(insets)
                .setInsets(
                    WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout(),
                    Insets.of(0, 0, 0, 0))
                .build();
        });

        // La página puede (re)cargarse después de que llegaron los insets.
        getBridge().addWebViewListener(new WebViewListener() {
            @Override
            public void onPageCommitVisible(WebView view, String url) {
                super.onPageCommitVisible(view, url);
                injectStatusBarInset();
            }
        });
        ViewCompat.requestApplyInsets(decor);
    }

    private void injectStatusBarInset() {
        if (getBridge() == null || getBridge().getWebView() == null) return;
        final String js = "document.documentElement.style.setProperty('--sat','"
            + Math.round(statusBarCssPx) + "px');";
        getBridge().getWebView().post(() -> getBridge().getWebView().evaluateJavascript(js, null));
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
