package art.brushowl.app;

import android.graphics.Color;
import android.os.Bundle;
import android.view.Window;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final int HEADER_STATUS_COLOR = Color.parseColor("#E8F4F5");

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        Window window = getWindow();
        // On Android 15+/16 the status bar is transparent; paint the window
        // behind it so the status-bar strip matches the app header.
        window.setStatusBarColor(HEADER_STATUS_COLOR);
        window.getDecorView().setBackgroundColor(HEADER_STATUS_COLOR);

        // Keep the WebView below the status bar (legacy non-overlay layout).
        WindowCompat.setDecorFitsSystemWindows(window, true);

        WindowInsetsControllerCompat controller =
            WindowCompat.getInsetsController(window, window.getDecorView());
        if (controller != null) {
            controller.setAppearanceLightStatusBars(true);
        }
    }
}
