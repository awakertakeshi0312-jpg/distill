import { Archive, BookOpen, CalendarDays, Inbox, Network, Search } from 'lucide-react';
import type { UiCopy } from '../i18n';

type SidebarProps = {
  ui: UiCopy;
  blockCount: number;
  hasLoadedStore: boolean;
  appVersion: string;
};

export function Sidebar({ ui, blockCount, hasLoadedStore, appVersion }: SidebarProps) {
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
        <a className="navItem active" href="#inbox">
          <Inbox size={18} />
          {ui.navInbox as string}
        </a>
        <a className="navItem" href="#today">
          <CalendarDays size={18} />
          {ui.navToday as string}
        </a>
        <a className="navItem" href="#search">
          <Search size={18} />
          {ui.navSearch as string}
        </a>
        <a className="navItem" href="#projects">
          <BookOpen size={18} />
          {ui.navProjects as string}
        </a>
        <a className="navItem" href="#graph">
          <Network size={18} />
          {ui.navGraph as string}
        </a>
        <a className="navItem" href="#archive">
          <Archive size={18} />
          {ui.navArchive as string}
        </a>
      </nav>

      <div className="trustPanel">
        <span>{ui.localFirst as string}</span>
        <strong>{ui.blocksIndexed(blockCount)}</strong>
        <small>{hasLoadedStore ? (ui.storageReady as string) : (ui.storageLoading as string)}</small>
        <small>Distill v{appVersion}</small>
      </div>
    </aside>
  );
}
