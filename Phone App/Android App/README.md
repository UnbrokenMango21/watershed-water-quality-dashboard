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

Location, camera, and microphone permissions are requested only in the field action that needs them. Existing photos use Android's system photo picker and need no broad media-library permission.
