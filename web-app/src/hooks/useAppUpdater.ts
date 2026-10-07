import { isDev } from '@/lib/utils'
import { useState, useCallback, useEffect } from 'react'
import { events, AppEvent } from '@janhq/core'
import type { UpdateInfo } from '@/services/updater/types'
import { getServiceHub } from '@/hooks/useServiceHub'

export interface UpdateState {
  isUpdateAvailable: boolean
  updateInfo: UpdateInfo | null
  isDownloading: boolean
  downloadProgress: number
  downloadedBytes: number
  totalBytes: number
  remindMeLater: boolean
  error: string | null
}

export type UpdateErrorKind =
  | 'signature'
  | 'network'
  | 'diskSpace'
  | 'install'
  | 'unknown'

/**
 * Best-effort mapping of a raw updater error message to a category the UI
 * can show a translated summary for. The raw message stays available next to
 * the summary, so a wrong bucket never hides what actually happened.
 */
export const getUpdateErrorKind = (message: string): UpdateErrorKind => {
  const m = message.toLowerCase()
  if (m.includes('signature') || m.includes('verif')) return 'signature'
  if (
    m.includes('space') ||
    m.includes('enospc') ||
    m.includes('quota') ||
    m.includes('storage')
  ) {
    return 'diskSpace'
  }
  if (
    m.includes('network') ||
    m.includes('internet') ||
    m.includes('offline') ||
    m.includes('dns') ||
    m.includes('timed out') ||
    m.includes('timeout') ||
    m.includes('connect') ||
    m.includes('request') ||
    m.includes('fetch') ||
    m.includes('certificate') ||
    m.includes('tls') ||
    m.includes('ssl')
  ) {
    return 'network'
  }
  if (
    m.includes('install') ||
    m.includes('mount point') ||
    m.includes('appimage') ||
    m.includes('archive') ||
    m.includes('temporary') ||
    m.includes('permission denied') ||
    m.includes('read-only') ||
    m.includes('authentication')
  ) {
    return 'install'
  }
  return 'unknown'
}

export const useAppUpdater = () => {
  const [updateState, setUpdateState] = useState<UpdateState>({
    isUpdateAvailable: false,
    updateInfo: null,
    isDownloading: false,
    downloadProgress: 0,
    downloadedBytes: 0,
    totalBytes: 0,
    remindMeLater: false,
    error: null,
  })

  // Listen for app update state sync events
  useEffect(() => {
    const handleUpdateStateSync = (newState: Partial<UpdateState>) => {
      setUpdateState((prev) => ({
        ...prev,
        ...newState,
      }))
    }

    events.on('onAppUpdateStateSync', handleUpdateStateSync)

    return () => {
      events.off('onAppUpdateStateSync', handleUpdateStateSync)
    }
  }, [])

  const syncStateToOtherInstances = useCallback(
    (partialState: Partial<UpdateState>) => {
      // Emit event to sync state across all useAppUpdater instances
      events.emit('onAppUpdateStateSync', partialState)
    },
    []
  )

  const checkForUpdate = useCallback(
    async (resetRemindMeLater = false) => {
      console.log('Checking for updates...')

      try {
        // Reset remindMeLater if requested (e.g., when called from settings)
        if (resetRemindMeLater && !AUTO_UPDATER_DISABLED) {
          const newState = {
            remindMeLater: false,
          }
          setUpdateState((prev) => ({
            ...prev,
            ...newState,
          }))
          // Sync to other instances
          syncStateToOtherInstances(newState)
        }

        if (!isDev()) {
          // Production mode - use actual Tauri updater
          const update = await getServiceHub().updater().check()

          if (update) {
            if (AUTO_UPDATER_DISABLED) {
              console.log('Auto updater is disabled')
              return null
            }

            const newState = {
              isUpdateAvailable: true,
              remindMeLater: false,
              updateInfo: update,
              error: null,
            }
            setUpdateState((prev) => ({
              ...prev,
              ...newState,
            }))
            // Sync to other instances
            syncStateToOtherInstances(newState)
            console.log('Update available:', update.version)
            return update
          } else {
            // No update available - reset state
            const newState = {
              isUpdateAvailable: false,
              updateInfo: null,
              error: null,
            }
            setUpdateState((prev) => ({
              ...prev,
              ...newState,
            }))
            // Sync to other instances
            syncStateToOtherInstances(newState)
            return null
          }
        } else {
          const newState = {
            isUpdateAvailable: false,
            updateInfo: null,
            error: null,
            ...(resetRemindMeLater && { remindMeLater: false }),
          }
          setUpdateState((prev) => ({
            ...prev,
            ...newState,
          }))
          // Sync to other instances
          syncStateToOtherInstances(newState)
          return null
        }
      } catch (error) {
        console.error('Error checking for updates:', error)
        // Reset state on error
        const newState = {
          isUpdateAvailable: false,
          updateInfo: null,
          error: null,
        }
        setUpdateState((prev) => ({
          ...prev,
          ...newState,
        }))
        // Sync to other instances
        syncStateToOtherInstances(newState)
        return null
      }
    },
    [syncStateToOtherInstances]
  )

  const setRemindMeLater = useCallback(
    (remind: boolean) => {
      const newState = {
        remindMeLater: remind,
      }
      setUpdateState((prev) => ({
        ...prev,
        ...newState,
      }))
      // Sync to other instances
      syncStateToOtherInstances(newState)
    },
    [syncStateToOtherInstances]
  )

  const downloadAndInstallUpdate = useCallback(async () => {
    if (AUTO_UPDATER_DISABLED) {
      console.log('Auto updater is disabled')
      return
    }

    if (!updateState.updateInfo) return

    try {
      setUpdateState((prev) => ({
        ...prev,
        isDownloading: true,
        error: null,
      }))

      let downloaded = 0
      let contentLength = 0

      // The engine, MCP servers and agent shells are stopped by the updater
      // service once the download has verified, not here: a failed download
      // must not take them down.
      await getServiceHub().updater().downloadAndInstallWithProgress((event) => {
        switch (event.event) {
          case 'Started':
            contentLength = event.data?.contentLength || 0
            setUpdateState((prev) => ({
              ...prev,
              totalBytes: contentLength,
            }))
            console.log(`Started downloading ${contentLength} bytes`)

            // Emit app update download started event
            events.emit(AppEvent.onAppUpdateDownloadUpdate, {
              progress: 0,
              downloadedBytes: 0,
              totalBytes: contentLength,
            })
            break
          case 'Progress': {
            downloaded += event.data?.chunkLength || 0
            const progress = contentLength > 0 ? downloaded / contentLength : 0
            setUpdateState((prev) => ({
              ...prev,
              downloadProgress: progress,
              downloadedBytes: downloaded,
            }))
            console.log(`Downloaded ${downloaded} from ${contentLength}`)

            // Emit app update download progress event
            events.emit(AppEvent.onAppUpdateDownloadUpdate, {
              progress: progress,
              downloadedBytes: downloaded,
              totalBytes: contentLength,
            })
            break
          }
          case 'Finished':
            console.log('Download finished')
            // The bundle is downloaded and verified at this point but the
            // install is still running — keep isDownloading so the UI shows
            // the install phase, and only report success once the whole
            // download + install promise resolves.
            setUpdateState((prev) => ({
              ...prev,
              downloadProgress: 1,
            }))
            break
        }
      })

      // Downloaded, verified and installed — safe to report success now.
      // Emitting on the plugin's `Finished` event instead would celebrate a
      // download whose install can still fail.
      events.emit(AppEvent.onAppUpdateDownloadSuccess, {})
      setUpdateState((prev) => ({
        ...prev,
        isDownloading: false,
      }))

      await window.core?.api?.relaunch()

      console.log('Update installed')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      console.error('Error downloading update:', error)
      const newState = {
        isDownloading: false,
        error: message,
      }
      setUpdateState((prev) => ({
        ...prev,
        ...newState,
      }))
      // Sync to other instances
      syncStateToOtherInstances(newState)

      // Emit app update download error event
      events.emit(AppEvent.onAppUpdateDownloadError, {
        message,
      })
    }
  }, [updateState.updateInfo, syncStateToOtherInstances])


  return {
    updateState,
    checkForUpdate,
    downloadAndInstallUpdate,
    setRemindMeLater,
  }
}
