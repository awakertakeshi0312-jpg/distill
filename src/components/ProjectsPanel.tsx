import { BookOpen } from 'lucide-react';
import type { UiCopy } from '../i18n';
import type { Project } from '../model';
import type { ProjectCount } from '../selectors';
import { HelpNote } from './HelpNote';

type ProjectsPanelProps = {
  ui: UiCopy;
  projectCounts: ProjectCount[];
  newProjectName: string;
  newProjectSignal: string;
  newProjectStatus: Project['status'];
  projectFormError: string;
  onNewProjectNameChange: (name: string) => void;
  onNewProjectSignalChange: (signal: string) => void;
  onNewProjectStatusChange: (status: Project['status']) => void;
  onClearProjectFormError: () => void;
  onSubmitNewProject: () => void;
};

export function ProjectsPanel({
  ui,
  projectCounts,
  newProjectName,
  newProjectSignal,
  newProjectStatus,
  projectFormError,
  onNewProjectNameChange,
  onNewProjectSignalChange,
  onNewProjectStatusChange,
  onClearProjectFormError,
  onSubmitNewProject,
}: ProjectsPanelProps) {
  return (
    <section className="panel projectPanel" id="projects">
      <div className="panelHeader">
        <div>
          <p>{ui.navProjects as string}</p>
          <h2>{ui.activeKnowledgeWork as string}</h2>
        </div>
        <HelpNote ui={ui} content={ui.sectionHelp.projects} />
      </div>

      <div className="projectList">
        {projectCounts.map((project) => (
          <article className="projectRow" key={project.name}>
            <div>
              <strong>{project.name}</strong>
              <span>{project.signal}</span>
            </div>
            <div className="projectStats">
              <span>{ui.blocks(project.blocks)}</span>
              <b>{ui.projectStatus[project.status]}</b>
            </div>
          </article>
        ))}
      </div>

      <div className="projectComposer">
        <div className="composerHeader">
          <p>{ui.newProject as string}</p>
          <strong>{ui.createProject as string}</strong>
        </div>
        <div className="projectFormGrid">
          <label>
            {ui.projectName as string}
            <input
              value={newProjectName}
              placeholder={ui.projectNamePlaceholder as string}
              onChange={(event) => {
                onNewProjectNameChange(event.target.value);
                onClearProjectFormError();
              }}
            />
          </label>
          <label>
            {ui.projectSignal as string}
            <input
              value={newProjectSignal}
              placeholder={ui.projectSignalPlaceholder as string}
              onChange={(event) => onNewProjectSignalChange(event.target.value)}
            />
          </label>
          <label>
            {ui.projectStatusLabel as string}
            <select value={newProjectStatus} onChange={(event) => onNewProjectStatusChange(event.target.value as Project['status'])}>
              <option value="Active">{ui.projectStatus.Active}</option>
              <option value="Design">{ui.projectStatus.Design}</option>
              <option value="Next">{ui.projectStatus.Next}</option>
            </select>
          </label>
          <button type="button" onClick={onSubmitNewProject}>
            <BookOpen size={16} />
            {ui.createProject as string}
          </button>
        </div>
        {projectFormError && <p className="formError">{projectFormError}</p>}
      </div>
    </section>
  );
}
