package app.torbox.torbox

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.DocumentsContract
import android.webkit.MimeTypeMap
import androidx.activity.result.ActivityResult
import androidx.documentfile.provider.DocumentFile
import app.tauri.annotation.ActivityCallback
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin
import java.io.File
import java.io.FileInputStream

@InvokeArg
class CopyFileArgs {
  lateinit var treeUri: String
  lateinit var sourcePath: String
  lateinit var fileName: String
}

@InvokeArg
class OpenWritableFileArgs {
  lateinit var treeUri: String
  lateinit var fileName: String
}

@InvokeArg
class FolderNameArgs {
  lateinit var treeUri: String
}

@TauriPlugin
class StoragePlugin(private val activity: Activity) : Plugin(activity) {
  @Command
  fun pickFolder(invoke: Invoke) {
    // Do not put GRANT_* flags on the launch intent — those apply to the result URI only.
    val intent = Intent(Intent.ACTION_OPEN_DOCUMENT_TREE).apply {
      addCategory(Intent.CATEGORY_DEFAULT)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        // Open near public Downloads so users don't try storage root (which Android rejects).
        val downloads = DocumentsContract.buildDocumentUri(
          "com.android.externalstorage.documents",
          "primary:Download"
        )
        putExtra(DocumentsContract.EXTRA_INITIAL_URI, downloads)
      }
    }
    startActivityForResult(invoke, intent, "pickFolderResult")
  }

  @ActivityCallback
  fun pickFolderResult(invoke: Invoke, result: ActivityResult) {
    when (result.resultCode) {
      Activity.RESULT_OK -> {
        val uri = result.data?.data
        if (uri == null) {
          invoke.reject("No folder selected")
          return
        }

        // Always request read+write persistable access. Masking with result flags is often 0
        // on OEMs and then takePersistableUriPermission becomes a no-op.
        val takeFlags =
          Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION
        try {
          activity.contentResolver.takePersistableUriPermission(uri, takeFlags)
        } catch (e: SecurityException) {
          invoke.reject(
            "Android refused permanent access to that folder. Pick Downloads or a folder you created, not storage root."
          )
          return
        }

        val doc = DocumentFile.fromTreeUri(activity, uri)
        if (doc == null || !doc.exists()) {
          invoke.reject("Could not open the selected folder")
          return
        }

        // canWrite() is unreliable on some tree roots; only hard-fail when clearly denied.
        if (doc.canWrite() == false && !hasWriteGrant(uri)) {
          invoke.reject(
            "That folder is not writable. Choose Downloads or create a subfolder (Android blocks storage root)."
          )
          return
        }

        val name = doc.name ?: decodeTreeLabel(uri) ?: "Selected folder"
        val ret = JSObject()
        ret.put("uri", uri.toString())
        ret.put("name", name)
        invoke.resolve(ret)
      }
      Activity.RESULT_CANCELED -> invoke.reject("cancelled")
      else -> invoke.reject("Failed to pick folder")
    }
  }

  @Command
  fun getFolderName(invoke: Invoke) {
    val args = invoke.parseArgs(FolderNameArgs::class.java)
    val uri = Uri.parse(args.treeUri)
    val name =
      DocumentFile.fromTreeUri(activity, uri)?.name
        ?: decodeTreeLabel(uri)
        ?: args.treeUri
    val ret = JSObject()
    ret.put("name", name)
    invoke.resolve(ret)
  }

  @Command
  fun openWritableFile(invoke: Invoke) {
    try {
      val args = invoke.parseArgs(OpenWritableFileArgs::class.java)
      val treeUri = Uri.parse(args.treeUri)
      ensurePersistedAccess(treeUri)

      val dir =
        DocumentFile.fromTreeUri(activity, treeUri)
          ?: run {
            invoke.reject("Invalid folder URI — pick the folder again in Settings")
            return
          }

      // Reuse an existing file so pause/resume can append; create otherwise so the
      // file is visible in the selected folder while the download is in progress.
      val target =
        dir.findFile(args.fileName)
          ?: createUniqueFile(dir, args.fileName)
          ?: run {
            invoke.reject(
              "Cannot create files in the selected folder. Pick Downloads or a subfolder you own."
            )
            return
          }

      val pfd =
        activity.contentResolver.openFileDescriptor(target.uri, "rw")
          ?: run {
            invoke.reject("Cannot open writable file descriptor for the selected folder")
            return
          }

      // Transfer FD ownership to Rust (caller must close it).
      val fd = pfd.detachFd()
      pfd.close()

      val ret = JSObject()
      ret.put("uri", target.uri.toString())
      ret.put("fd", fd)
      invoke.resolve(ret)
    } catch (e: SecurityException) {
      invoke.reject(
        "Lost access to the selected folder. Open Settings and choose the folder again."
      )
    } catch (e: Exception) {
      invoke.reject(e.message ?: "Failed to open writable file")
    }
  }

  @Command
  fun copyFile(invoke: Invoke) {
    try {
      val args = invoke.parseArgs(CopyFileArgs::class.java)
      val treeUri = Uri.parse(args.treeUri)
      ensurePersistedAccess(treeUri)

      val dir =
        DocumentFile.fromTreeUri(activity, treeUri)
          ?: run {
            invoke.reject("Invalid folder URI — pick the folder again in Settings")
            return
          }

      val source = File(args.sourcePath)
      if (!source.exists()) {
        invoke.reject("Source file missing: ${args.sourcePath}")
        return
      }

      // Replace existing target with the same display name.
      dir.findFile(args.fileName)?.delete()

      val target =
        createUniqueFile(dir, args.fileName)
          ?: run {
            invoke.reject(
              "Cannot create files in the selected folder. Pick Downloads or a subfolder you own."
            )
            return
          }

      activity.contentResolver.openOutputStream(target.uri, "w")?.use { out ->
        FileInputStream(source).use { input -> input.copyTo(out) }
      }
        ?: run {
          invoke.reject("Cannot open output stream for the selected folder")
          return
        }

      val ret = JSObject()
      ret.put("uri", target.uri.toString())
      invoke.resolve(ret)
    } catch (e: SecurityException) {
      invoke.reject(
        "Lost access to the selected folder. Open Settings and choose the folder again."
      )
    } catch (e: Exception) {
      invoke.reject(e.message ?: "Copy failed")
    }
  }

  private fun ensurePersistedAccess(uri: Uri) {
    val takeFlags =
      Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION
    val already =
      activity.contentResolver.persistedUriPermissions.any {
        it.uri == uri && it.isWritePermission
      }
    if (!already) {
      try {
        activity.contentResolver.takePersistableUriPermission(uri, takeFlags)
      } catch (_: SecurityException) {
      }
    }
  }

  private fun hasWriteGrant(uri: Uri): Boolean {
    return activity.contentResolver.persistedUriPermissions.any {
      it.uri == uri && it.isWritePermission
    }
  }

  private fun createUniqueFile(dir: DocumentFile, fileName: String): DocumentFile? {
    val mime = guessMime(fileName)
    dir.createFile(mime, fileName)?.let { return it }
    // Some providers reject application/octet-stream or names with extensions twice.
    val base = fileName.substringBeforeLast('.', fileName)
    dir.createFile(mime, base)?.let { return it }
    dir.createFile("application/octet-stream", fileName)?.let { return it }
    return dir.createFile("*/*", fileName)
  }

  private fun decodeTreeLabel(uri: Uri): String? {
    val segment = uri.lastPathSegment ?: return null
    val decoded = Uri.decode(segment)
    return decoded.substringAfterLast(':').ifEmpty { decoded }
  }

  private fun guessMime(name: String): String {
    val ext = name.substringAfterLast('.', missingDelimiterValue = "")
    if (ext.isEmpty()) {
      return "application/octet-stream"
    }
    return MimeTypeMap.getSingleton().getMimeTypeFromExtension(ext.lowercase())
      ?: "application/octet-stream"
  }
}
