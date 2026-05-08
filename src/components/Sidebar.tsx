import {
  Archive,
  BookOpen,
  CalendarDays,
  Bot,
  ExternalLink,
  Inbox,
  LockKeyhole,
  Network,
  Search,
  Settings,
  Smartphone,
  type LucideIcon,
} from 'lucide-react';
import type { UiCopy } from '../i18n';

export type AppPage = 'inbox' | 'today' | 'search' | 'projects' | 'graph' | 'archive' | 'settings' | 'mobile';

type SidebarProps = {
  ui: UiCopy;
  blockCount: number;
  hasLoadedStore: boolean;
  appVersion: string;
  aiSecretaryUrl: string;
  activePage: AppPage;
  onPageChange: (page: AppPage) => void;
  onLockVault: () => void;
};

type NavItem = {
  id: AppPage;
  icon: LucideIcon;
  label: string;
};

export function Sidebar({
  ui,
  blockCount,
  hasLoadedStore,
  appVersion,
  aiSecretaryUrl,
  activePage,
  onPageChange,
  onLockVault,
}: SidebarProps) {
  const items: NavItem[] = [
    { id: 'inbox', icon: Inbox, label: ui.navInbox as string },
    { id: 'today', icon: CalendarDays, label: ui.navToday as string },
    { id: 'search', icon: Search, label: ui.navSearch as string },
    { id: 'projects', icon: BookOpen, label: ui.navProjects as string },
    { id: 'graph', icon: Network, label: ui.navGraph as string },
    { id: 'archive', icon: Archive, label: ui.navArchive as string },
    { id: 'settings', icon: Settings, label: ui.navSettings as string },
    { id: 'mobile', icon: Smartphone, label: ui.navMobile as string },
  ];

  return (
    <aside className="sidebar" aria-label="Primary navigation">
      <div className="brand">
        <div className="brandMark">D</div>
        <div>
          <strong>Distill</strong>
          <span>{ui.localThinkingOs as string}</span>
        </div>
      </div>

      <nav className="navList">
        {items.map((item) => {
          const Icon = item.icon;

          return (
            <a
              className={`navItem ${activePage === item.id ? 'active' : ''}`}
              href={`#${item.id}`}
              key={item.id}
              onClick={(event) => {
                event.preventDefault();
                onPageChange(item.id);
              }}
            >
              <Icon size={18} />
              {item.label}
            </a>
          );
        })}
        <a className="navItem companionNavItem" href={aiSecretaryUrl} target="_blank" rel="noreferrer">
          <Bot size={18} />
          {ui.navAiSecretary as string}
          <ExternalLink className="navExternalIcon" size={13} />
        </a>
      </nav>

      <div className="trustPanel">
        <span>{ui.localFirst as string}</span>
        <strong>{ui.blocksIndexed(blockCount)}</strong>
        <small>{hasLoadedStore ? (ui.storageReady as string) : (ui.storageLoading as string)}</small>
        <small>Distill v{appVersion}</small>
        <button className="sidebarLockButton" type="button" onClick={onLockVault}>
          <LockKeyhole size={16} />
          {ui.lockVault as string}
        </button>
      </div>
    </aside>
  );
}
