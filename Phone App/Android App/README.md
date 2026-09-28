# PA Watershed Watch for Android

Native Kotlin and Jetpack Compose frontend for the PA Watershed Watch field workflow. The app shares the field-collection contract with iOS and uses app-private draft persistence. Configure Firebase through the project’s Android configuration before a connected run.

## Run

Open this folder in Android Studio, or use:

```bash
export ANDROID_HOME="$HOME/Library/Android/sdk"
./gradlew testDebugUnitTest assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

Do not put test credentials in source. Use a provisioned development collector account through the normal Firebase sign-in flow.

Location permission is requested only for the field-location workflow. Photo/audio capture and upload are deliberately deferred in the current release, so the app does not request camera or microphone permissions. Water Temperature remains the only currently confirmed mandatory science measurement.