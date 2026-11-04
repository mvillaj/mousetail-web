import { RefreshCw, WifiOff } from 'lucide-react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { useOnline } from '../lib/online';
import { Banner } from './ui';

/**
 * The two things the installed app needs to say outside any one page: that the
 * network has gone (the shell still loads from cache, but nothing can be read
 * or saved), and that a new version is waiting. Updates wait for a tap rather
 * than reloading on their own, so a half-logged shot is never thrown away.
 */
export default function AppStatus() {
  const online = useOnline();
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (online && !needRefresh) return null;

  return (
    <div className="app-status" role="status">
      {!online ? (
        <Banner kind="warn" icon={WifiOff}>
          <span>You're offline. Shots and changes can't be saved until you're back.</span>
        </Banner>
      ) : null}
      {needRefresh ? (
        <Banner icon={RefreshCw}>
          <span>A new version of Mousetail is ready.</span>
          <button
            className="btn btn-sm"
            type="button"
            onClick={() => void updateServiceWorker(true)}
          >
            Reload
          </button>
        </Banner>
      ) : null}
    </div>
  );
}
