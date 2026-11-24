package expo.modules.landlyappsigning

import android.content.Context
import android.content.pm.PackageInfo
import android.content.pm.PackageManager
import android.os.Build
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.security.MessageDigest

// Reports which signing certificate and which installer this install has, for the Google sign-in error detail
// (landly-mobile/src/auth/nativeBuildInfo.ts). Android reports error 10 (DEVELOPER_ERROR) when Google has no OAuth
// client for this package + signing-certificate SHA-1, and from the app's side the certificate is otherwise invisible.
// A certificate's SHA-1 is public; nothing secret is read. Every read is guarded: a failure leaves its field out.
class LandlyAppSigningModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("LandlyAppSigning")

    // { signingSha1?: "AA:BB:...", signerCount?: number, installer?: "play" | "sideload" | "other" }
    Function("getInfo") {
      val info = mutableMapOf<String, Any>()
      val packageName = context.packageName
      val packageManager = context.packageManager

      try {
        val digests = signingCertificates(packageManager, packageName).map { sha1(it) }
        if (digests.isNotEmpty()) {
          info["signingSha1"] = digests.first()
          info["signerCount"] = digests.size
        }
      } catch (_: Throwable) {
        // omitted
      }

      try {
        info["installer"] = installerKind(installerPackage(packageManager, packageName))
      } catch (_: Throwable) {
        // omitted
      }

      info
    }
  }

  // The certificates this APK is signed with now (the app signing key for a Play install, the upload key for a sideload).
  @Suppress("DEPRECATION")
  private fun signingCertificates(packageManager: PackageManager, packageName: String): List<ByteArray> {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
      val signingInfo = packageInfo(packageManager, packageName, PackageManager.GET_SIGNING_CERTIFICATES).signingInfo
        ?: return emptyList()
      return signingInfo.apkContentsSigners.map { it.toByteArray() }
    }
    return packageInfo(packageManager, packageName, PackageManager.GET_SIGNATURES).signatures?.map { it.toByteArray() }
      ?: emptyList()
  }

  @Suppress("DEPRECATION")
  private fun packageInfo(packageManager: PackageManager, packageName: String, flags: Int): PackageInfo =
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      packageManager.getPackageInfo(packageName, PackageManager.PackageInfoFlags.of(flags.toLong()))
    } else {
      packageManager.getPackageInfo(packageName, flags)
    }

  @Suppress("DEPRECATION")
  private fun installerPackage(packageManager: PackageManager, packageName: String): String? =
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
      packageManager.getInstallSourceInfo(packageName).installingPackageName
    } else {
      packageManager.getInstallerPackageName(packageName)
    }

  // Only the kind leaves the module, never the installer's package name.
  private fun installerKind(installer: String?): String = when (installer) {
    null -> "sideload"
    "com.android.vending" -> "play"
    else -> "other"
  }

  private fun sha1(certificate: ByteArray): String =
    MessageDigest.getInstance("SHA-1").digest(certificate).joinToString(":") { "%02X".format(it) }
}
