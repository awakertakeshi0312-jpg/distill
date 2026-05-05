import { useEffect, useMemo, useState } from 'react';
import {
  Archive,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Circle,
  Command,
  Database,
  Download,
  FileText,
  Inbox,
  Link2,
  Network,
  Search,
  Send,
  Sparkles,
  Tag,
  UserRound,
} from 'lucide-react';
import { exportStoreAsJson, exportStoreAsMarkdown, downloadTextFile } from './export';
import { formatBlockMeta, searchBlocks } from './model';
import { addCapture, assignProject, getBlock, toggleProcessed } from './repository';
import { loadStore, saveStore } from './storage';

function App() {
  const [store, setStore] = useState(loadStore);
  const [captureText, setCaptureText] = useState(
    'Meaning search should feel like remembering with help, not querying a database.',
  );
  const [query, setQuery] = useState('how do I trust a semantic result?');
  const [selectedBlockId, setSelectedBlockId] = useState(store.blocks[0]?.id);

  useEffect(() => {
    saveStore(store);
  }, [store]);

  const openBlocks = store.blocks.filter((block) => block.state !== 'processed');
  const selectedBlock = getBlock(store, selectedBlockId);
  const results = useMemo(() => searchBlocks(store.blocks, query), [store.blocks, query]);

  const projectCounts = store.projects.map((project) => ({
    ...project,
    blocks: store.blocks.filter((block) => block.projectId === project.id).length,
  }));

  function captureBlock() {
    if (!captureText.trim()) {
      return;
    }

    const nextStore = addCapture(captureText)(store);
    const block = nextStore.blocks[0];

    setStore(nextStore);
    setSelectedBlockId(block?.id);
    setCaptureText('');
  }

  function exportMarkdown() {
    downloadTextFile('distill-export.md', exportStoreAsMarkdown(store), 'text/markdown');
  }

  function exportJson() {
    downloadTextFile('distill-export.json', exportStoreAsJson(store), 'application/json');
  }

  return (
    <main className="shell">
      <aside className="sidebar" aria-label="Primary navigation">
        <div className="brand">
          <div className="brandMark">D</div>
          <div>
            <strong>Distill</strong>
            <span>Local thinking OS</span>
          </div>
        </div>

        <nav className="navList">
          <a className="navItem active" href="#inbox">
            <Inbox size={18} />
            Inbox
          </a>
          <a className="navItem" href="#today">
            <CalendarDays size={18} />
            Today
          </a>
          <a className="navItem" href="#search">
            <Search size={18} />
            Search
          </a>
          <a className="navItem" href="#projects">
            <BookOpen size={18} />
            Projects
          </a>
          <a className="navItem" href="#graph">
            <Network size={18} />
            Graph
          </a>
          <a className="navItem" href="#archive">
            <Archive size={18} />
            Archive
          </a>
        </nav>

        <div className="trustPanel">
          <span>Local-first</span>
          <strong>{store.blocks.length.toLocaleString()} blocks indexed</strong>
          <small>Prototype storage - local browser persistence</small>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p>Tuesday, May 5</p>
            <h1>Inbox triage</h1>
          </div>
          <button className="iconButton" type="button" aria-label="Open command palette" title="Command palette">
            <Command size={19} />
          </button>
        </header>

        <section className="capture" aria-label="Quick capture">
          <textarea
            aria-label="Capture a thought"
            placeholder="Capture a thought, question, decision, or fragment..."
            value={captureText}
            onChange={(event) => setCaptureText(event.target.value)}
            onKeyDown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                captureBlock();
              }
            }}
          />
          <div className="captureActions">
            <div className="captureHint">
              <Sparkles size={16} />
              Use #tags and [[links]] while capturing
            </div>
            <button type="button" onClick={captureBlock}>
              <Send size={17} />
              Capture
            </button>
          </div>
        </section>

        <div className="contentGrid">
          <section className="panel largePanel" id="inbox">
            <div className="panelHeader">
              <div>
                <p>Unprocessed</p>
                <h2>Thought blocks</h2>
              </div>
              <span className="countBadge">{openBlocks.length} open</span>
            </div>

            <div className="blockList">
              {store.blocks.map((block) => (
                <article
                  className={`thoughtBlock ${selectedBlock?.id === block.id ? 'selected' : ''}`}
                  key={block.id}
                  onClick={() => setSelectedBlockId(block.id)}
                >
                  <button
                    className="statusButton"
                    type="button"
                    aria-label={`Toggle ${block.id}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      setStore(toggleProcessed(block.id));
                    }}
                  >
                    {block.state === 'processed' ? <CheckCircle2 size={18} /> : <Circle size={18} />}
                  </button>
                  <div className="blockBody">
                    <p>{block.content}</p>
                    <div className="blockMeta">
                      <span>{formatBlockMeta(block, store.projects)}</span>
                      {block.tags.map((tag) => (
                        <span className="tag" key={tag}>
                          <Tag size={12} />
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <aside className="panel contextPanel" aria-label="Context inspector">
            <div className="panelHeader compact">
              <div>
                <p>Inspector</p>
                <h2>Related context</h2>
              </div>
            </div>

            <div className="contextList">
              <div className="contextItem">
                <Link2 size={17} />
                <div>
                  <strong>Backlinks</strong>
                  <span>{selectedBlock?.links.length ?? 0} explicit links on selected block</span>
                </div>
              </div>
              <div className="contextItem">
                <UserRound size={17} />
                <div>
                  <strong>People</strong>
                  <span>No linked people yet</span>
                </div>
              </div>
              <div className="contextItem">
                <FileText size={17} />
                <div>
                  <strong>Selected block</strong>
                  <span>{selectedBlock?.id ?? 'No block selected'}</span>
                </div>
              </div>
              <div className="contextItem">
                <Database size={17} />
                <div>
                  <strong>Storage</strong>
                  <span>localStorage now, SQLite schema prepared</span>
                </div>
              </div>
            </div>

            <div className="inspectorControls">
              <label>
                Project
                <select
                  value={selectedBlock?.projectId ?? ''}
                  onChange={(event) => {
                    if (selectedBlock) {
                      setStore(assignProject(selectedBlock.id, event.target.value));
                    }
                  }}
                >
                  <option value="">Inbox</option>
                  {store.projects.map((project) => (
                    <option value={project.id} key={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </label>

              <div className="exportActions">
                <button type="button" onClick={exportMarkdown}>
                  <Download size={16} />
                  Markdown
                </button>
                <button type="button" onClick={exportJson}>
                  <Download size={16} />
                  JSON
                </button>
              </div>
            </div>
          </aside>

          <section className="panel searchPanel" id="search">
            <div className="panelHeader">
              <div>
                <p>Hybrid retrieval</p>
                <h2>Meaning search</h2>
              </div>
              <input aria-label="Search notes" value={query} onChange={(event) => setQuery(event.target.value)} />
            </div>

            <div className="resultList">
              {results.length > 0 ? (
                results.map((result) => (
                  <button
                    className="resultRow"
                    key={result.block.id}
                    type="button"
                    onClick={() => setSelectedBlockId(result.block.id)}
                  >
                    <strong>{result.block.content}</strong>
                    <span>{result.reason}</span>
                  </button>
                ))
              ) : (
                <div className="emptyState">No matching blocks yet.</div>
              )}
            </div>
          </section>

          <section className="panel projectPanel" id="projects">
            <div className="panelHeader">
              <div>
                <p>Projects</p>
                <h2>Active knowledge work</h2>
              </div>
            </div>

            <div className="projectList">
              {projectCounts.map((project) => (
                <article className="projectRow" key={project.name}>
                  <div>
                    <strong>{project.name}</strong>
                    <span>{project.signal}</span>
                  </div>
                  <div className="projectStats">
                    <span>{project.blocks} blocks</span>
                    <b>{project.status}</b>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}

export default App;
