package org.watershed.pawatershedwatch

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Build
import android.os.Bundle
import android.os.CancellationSignal
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import androidx.core.content.ContextCompat
import androidx.core.net.toUri
import kotlin.math.abs

@SuppressLint("MissingPermission")
@Suppress("DEPRECATION")
fun captureCurrentLocation(context: Context, onResult: (Location?) -> Unit) {
    val coarse = ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED
    if (!coarse) {
        onResult(null)
        return
    }
    val manager = context.getSystemService(LocationManager::class.java)
    val provider = when {
        manager.isProviderEnabled(LocationManager.GPS_PROVIDER) -> LocationManager.GPS_PROVIDER
        manager.isProviderEnabled(LocationManager.NETWORK_PROVIDER) -> LocationManager.NETWORK_PROVIDER
        else -> null
    }
    if (provider == null) {
        onResult(null)
        return
    }
    if (Build.VERSION.SDK_INT >= 30) {
        val signal = CancellationSignal()
        val handler = Handler(Looper.getMainLooper())
        var completed = false
        fun finish(location: Location?) {
            if (completed) return
            completed = true
            handler.removeCallbacksAndMessages(null)
            signal.cancel()
            onResult(location?.takeIf(::isUsableFieldFix))
        }
        handler.postDelayed({ finish(null) }, LOCATION_TIMEOUT_MS)
        manager.getCurrentLocation(provider, signal, context.mainExecutor, ::finish)
    } else {
        val handler = Handler(Looper.getMainLooper())
        var completed = false
        val listener = object : LocationListener {
            override fun onLocationChanged(location: Location) {
                finish(location)
            }
            override fun onProviderDisabled(provider: String) = finish(null)
            override fun onProviderEnabled(provider: String) = Unit
            @Deprecated("Legacy callback")
            override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) = Unit

            private fun finish(location: Location?) {
                if (completed) return
                completed = true
                handler.removeCallbacksAndMessages(null)
                manager.removeUpdates(this)
                onResult(location?.takeIf(::isUsableFieldFix))
            }
        }
        handler.postDelayed({
            if (!completed) {
                completed = true
                manager.removeUpdates(listener)
                onResult(null)
            }
        }, LOCATION_TIMEOUT_MS)
        manager.requestSingleUpdate(provider, listener, Looper.getMainLooper())
    }
}

private const val LOCATION_TIMEOUT_MS = 15_000L
private const val MAX_LOCATION_AGE_MS = 30_000L

internal fun isUsableFieldFix(location: Location): Boolean =
    location.latitude in -90.0..90.0 && location.longitude in -180.0..180.0 &&
        !(location.latitude == 0.0 && location.longitude == 0.0) &&
        location.accuracy.isFinite() && location.accuracy >= 0 &&
        abs(System.currentTimeMillis() - location.time) <= MAX_LOCATION_AGE_MS

fun openAppSettings(context: Context) {
    context.startActivity(
        Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, "package:${context.packageName}".toUri())
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    )
}
