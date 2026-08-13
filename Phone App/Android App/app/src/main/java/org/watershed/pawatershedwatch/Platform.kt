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
import android.os.Looper
import android.provider.Settings
import androidx.core.content.ContextCompat
import androidx.core.net.toUri

@SuppressLint("MissingPermission")
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
        manager.getCurrentLocation(provider, CancellationSignal(), context.mainExecutor, onResult)
    } else {
        val listener = object : LocationListener {
            override fun onLocationChanged(location: Location) {
                manager.removeUpdates(this)
                onResult(location)
            }
            override fun onProviderDisabled(provider: String) = onResult(null)
            override fun onProviderEnabled(provider: String) = Unit
            @Deprecated("Legacy callback")
            override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) = Unit
        }
        manager.requestSingleUpdate(provider, listener, Looper.getMainLooper())
    }
}

fun openAppSettings(context: Context) {
    context.startActivity(
        Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, "package:${context.packageName}".toUri())
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    )
}
