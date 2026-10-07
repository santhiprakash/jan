import {
  getUpdateErrorKind,
  useAppUpdater,
  type UpdateErrorKind,
} from '@/hooks/useAppUpdater'

import { IconAlertTriangle, IconDownload } from '@tabler/icons-react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { CopyButton } from '@/containers/CopyButton'

import { useState, useEffect } from 'react'
import { useReleaseNotes } from '@/hooks/useReleaseNotes'
import { RenderMarkdown } from '../RenderMarkdown'
import { cn, isDev } from '@/lib/utils'
import { isNightly, isBeta } from '@/lib/version'
import { useTranslation } from '@/i18n/react-i18next-compat'

const ERROR_I18N_KEYS: Record<UpdateErrorKind, string> = {
  signature: 'updater:errorSignature',
  network: 'updater:errorNetwork',
  diskSpace: 'updater:errorDiskSpace',
  install: 'updater:errorInstall',
  unknown: 'updater:errorGeneric',
}

const DialogAppUpdater = () => {
  const { t } = useTranslation()
  const { updateState, downloadAndInstallUpdate, setRemindMeLater } =
    useAppUpdater()
  const [showReleaseNotes, setShowReleaseNotes] = useState(false)
  const [showErrorDetails, setShowErrorDetails] = useState(false)

  const handleUpdate = async () => {
    // Awaited so the popup stays mounted for the whole attempt: a failure has
    // somewhere to render instead of the dialog vanishing on click.
    await downloadAndInstallUpdate()
  }

  const { release, fetchLatestRelease } = useReleaseNotes()

  useEffect(() => {
    if (!isDev()) {
      fetchLatestRelease(isBeta)
    }
  }, [fetchLatestRelease])

  const [appUpdateState, setAppUpdateState] = useState({
    remindMeLater: false,
    isUpdateAvailable: false,
  })

  useEffect(() => {
    setAppUpdateState({
      remindMeLater: updateState.remindMeLater,
      isUpdateAvailable: updateState.isUpdateAvailable,
    })
  }, [updateState])

  if (appUpdateState.remindMeLater) return null

  const isInstalling =
    updateState.isDownloading && updateState.downloadProgress >= 1

  return (
    <>
      {appUpdateState.isUpdateAvailable && (
        <div
          className={cn(
            'fixed z-50 bottom-3 right-3 bg-background flex items-center justify-center border rounded-lg shadow-md'
          )}
        >
          <div className="px-2 py-4">
            <div className="px-4">
              <div className="flex items-start gap-2">
                {updateState.error ? (
                  <IconAlertTriangle
                    size={20}
                    className="shrink-0 text-destructive mt-1"
                  />
                ) : (
                  <IconDownload
                    size={20}
                    className="shrink-0 text-muted-foreground mt-1"
                  />
                )}
                <div>
                  <div className="text-base font-medium">
                    {updateState.error
                      ? t('updater:updateFailed')
                      : t('updater:newVersion', {
                          version: updateState.updateInfo?.version,
                        })}
                  </div>
                  <div className="mt-1 text-muted-foreground font-normal mb-2">
                    {updateState.error
                      ? t(ERROR_I18N_KEYS[getUpdateErrorKind(updateState.error)])
                      : isInstalling
                        ? t('updater:installing')
                        : t('updater:updateAvailable')}
                  </div>
                </div>
              </div>
            </div>

            {updateState.error && (
              <div className="px-4 pb-2 w-[320px]">
                <button
                  type="button"
                  onClick={() => setShowErrorDetails((prev) => !prev)}
                  className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                >
                  {showErrorDetails ? (
                    <ChevronDown className="size-3" />
                  ) : (
                    <ChevronRight className="size-3" />
                  )}
                  {t('common:errorDialog.details')}
                </button>
                {showErrorDetails && (
                  <div className="mt-2 flex items-start gap-1">
                    <div className="flex-1 max-h-[120px] overflow-y-auto break-all rounded bg-muted p-2 text-xs leading-relaxed text-muted-foreground">
                      {updateState.error}
                    </div>
                    <CopyButton text={updateState.error} />
                  </div>
                )}
              </div>
            )}

            {!updateState.error && updateState.isDownloading && (
              <div className="w-[320px] px-4 pb-2">
                <Progress
                  value={updateState.downloadProgress * 100}
                  className="h-2 rounded-md bg-muted-foreground/10"
                />
                <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    {isInstalling
                      ? t('updater:installing')
                      : t('updater:downloading')}
                  </span>
                  <span>
                    {Math.round(updateState.downloadProgress * 100)}%
                  </span>
                </div>
              </div>
            )}

            {showReleaseNotes && !updateState.error && (
              <div className="max-h-[500px] p-4 w-[400px] overflow-y-scroll  text-sm font-normal leading-relaxed">
                {isNightly && !isBeta ? (
                  <p className="text-sm font-normal">
                    {t('updater:nightlyBuild')}
                  </p>
                ) : (
                  <RenderMarkdown
                    components={{
                      a: ({ ...props }) => (
                        <a
                          {...props}
                          target="_blank"
                          rel="noopener noreferrer"
                        />
                      ),
                      h2: ({ ...props }) => (
                        <h2 {...props} className="text-xl! mt-0!" />
                      ),
                    }}
                    content={release?.body}
                  />
                )}
              </div>
            )}

            <div className="pt-3 px-4">
              {updateState.error ? (
                <div className="flex gap-x-2 w-full items-center justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setRemindMeLater(true)}
                  >
                    {t('common:dismiss')}
                  </Button>
                  <Button
                    onClick={() => void handleUpdate()}
                    disabled={updateState.isDownloading}
                    size="sm"
                  >
                    {t('updater:retry')}
                  </Button>
                </div>
              ) : (
                <div className="flex gap-x-0 w-full items-center justify-between">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowReleaseNotes(!showReleaseNotes)}
                  >
                    {showReleaseNotes
                      ? t('updater:hideReleaseNotes')
                      : t('updater:showReleaseNotes')}
                  </Button>
                  <div className="flex gap-x-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setRemindMeLater(true)}
                    >
                      {t('updater:remindMeLater')}
                    </Button>
                    <Button
                      onClick={() => void handleUpdate()}
                      disabled={updateState.isDownloading}
                      size="sm"
                    >
                      {updateState.isDownloading
                        ? isInstalling
                          ? t('updater:installing')
                          : t('updater:downloading')
                        : t('updater:updateNow')}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default DialogAppUpdater
