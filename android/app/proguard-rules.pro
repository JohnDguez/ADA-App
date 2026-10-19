# Reglas de R8 / ProGuard de LunaPay (v0.9.735).
#
# Enfoque CONSERVADOR: R8 reduce (y ofusca) las librerías de terceros —
# Firebase, ML Kit, Play Billing, AndroidX—, que traen sus propias reglas
# "consumer"; el código de ESTE proyecto y de los plugins de Capacitor/Cordova
# se conserva tal cual, porque se carga por reflexión (capacitor.plugins.json,
# config.xml de Cordova, anotaciones @PluginMethod) y ofuscarlo rompería el
# puente con la web sin ahorrar casi peso.
#
# Si una compilación de release falla con "Missing class ...", R8 escribe las
# reglas sugeridas en android/app/build/outputs/mapping/release/missing_rules.txt;
# pégalas aquí. Si algo funciona en debug pero no en release, es casi seguro
# una clase que falta conservar: revisa Logcat (ClassNotFoundException /
# NoSuchMethodException) y añade su `-keep`.

# Anotaciones, genéricos y números de línea (para stack traces legibles en Play Console).
-keepattributes *Annotation*, Signature, InnerClasses, EnclosingMethod, SourceFile, LineNumberTable
-renamesourcefileattribute SourceFile

# Interfaces JavaScript del WebView (Capacitor expone varias).
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Código propio: MainActivity, widget de Luna y su plugin local.
-keep class app.luna_pay.mobile.** { *; }

# Capacitor y sus plugins (se registran por nombre desde capacitor.plugins.json).
-keep class com.getcapacitor.** { *; }
-keep class com.capacitorjs.** { *; }
-keep class io.capawesome.** { *; }
-keep class app.capgo.** { *; }

# Cordova: cordova-plugin-purchase se instancia por nombre de clase.
-keep class org.apache.cordova.** { *; }
-keep class cc.fovea.** { *; }

# capacitor-firebase-authentication trae soporte opcional para Facebook (no lo usamos,
# el SDK no está incluido): R8 reclamaba com.facebook.AccessToken en el build de release.
-dontwarn com.facebook.**
