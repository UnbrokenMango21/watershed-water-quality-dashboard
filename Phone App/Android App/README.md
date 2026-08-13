# PA Watershed Watch for Android

Native Kotlin and Jetpack Compose frontend for the PA Watershed Watch field workflow. This phase uses local mock data and app-private draft persistence only; it does not connect to Firebase.

## Run

Open this folder in Android Studio, or use:

```bash
export ANDROID_HOME="$HOME/Library/Android/sdk"
./gradlew testDebugUnitTest assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

The mock sign-in is prefilled:

- Email: `maya.chen@psu.edu`
- Password: `watershed`

Location, camera, and microphone permissions are requested only in the field action that needs them. Existing photos use Android's system photo picker and need no broad media-library permission.
