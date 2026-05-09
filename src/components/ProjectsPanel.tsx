import { ArrowRight, BookOpen, Bot, Sparkles } from 'lucide-react';
import type { Locale, UiCopy } from '../i18n';
import type { Project } from '../model';
import type { ProjectCount } from '../selectors';
import { HelpNote } from './HelpNote';

type ProjectsPanelProps = {
  ui: UiCopy;
  locale: Locale;
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
  onPlanWithAiSecretary: (prompt: string) => void;
};

export function ProjectsPanel({
  ui,
  locale,
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
  onPlanWithAiSecretary,
}: ProjectsPanelProps) {
  const isJa = locale === 'ja';
  const activeProjectCount = projectCounts.filter((project) => project.status === 'Active').length;
  const nextProjectCount = projectCounts.filter((project) => project.status === 'Next').length;
  const totalBlocks = projectCounts.reduce((total, project) => total + project.blocks, 0);
  const portfolioPrompt = isJa
    ? [
        'Distillの全プロジェクトを、AI秘書として目標達成の行動計画に落としてください。',
        '優先順位、今日の次の一手、今週のBig Rock、空き時間に入れる予定案を提案してください。',
        '',
        ...projectCounts.map(
          (project) =>
            `- ${project.name}: 状態=${ui.projectStatus[project.status]}, 関連ブロック=${project.blocks}件, 目的/問い=${project.signal || '未設定'}`,
        ),
      ].join('\n')
    : [
        'Turn all Distill projects into an AI Secretary action plan.',
        'Propose priorities, today’s next action, this week’s Big Rocks, and schedule slots for open time.',
        '',
        ...projectCounts.map(
          (project) =>
            `- ${project.name}: status=${project.status}, blocks=${project.blocks}, signal=${project.signal || 'not set'}`,
        ),
      ].join('\n');

  function projectPrompt(project: ProjectCount) {
    return isJa
      ? [
          `Distillのプロジェクト「${project.name}」を、AI秘書として実行計画に落としてください。`,
          `状態: ${ui.projectStatus[project.status]}`,
          `関連ブロック: ${project.blocks}件`,
          `目的/問い: ${project.signal || '未設定'}`,
          '',
          '今日やるべき次の一手、今週の完了条件、予定に入れるなら何時に何分確保すべきかを提案してください。',
        ].join('\n')
      : [
          `Turn the Distill project "${project.name}" into an execution plan as AI Secretary.`,
          `Status: ${project.status}`,
          `Related blocks: ${project.blocks}`,
          `Signal: ${project.signal || 'not set'}`,
          '',
          'Suggest the next action for today, this week’s done condition, and how much calendar time to reserve.',
        ].join('\n');
  }

  return (
    <section className="panel projectPanel" id="projects">
      <div className="panelHeader">
        <div>
          <p>{ui.navProjects as string}</p>
          <h2>{ui.activeKnowledgeWork as string}</h2>
        </div>
        <HelpNote ui={ui} content={ui.sectionHelp.projects} />
      </div>

      <div className="projectSecretaryCard">
        <div className="projectSecretaryIcon">
          <Bot size={20} />
        </div>
        <div>
          <p>{isJa ? 'AI秘書連携' : 'AI Secretary companion'}</p>
          <strong>{isJa ? 'プロジェクトを予定・タスクへ変換' : 'Turn projects into schedule and tasks'}</strong>
          <span>
            {isJa
              ? `Active ${activeProjectCount}件 / Next ${nextProjectCount}件 / ブロック ${totalBlocks}件を、次の行動に落とします。`
              : `${activeProjectCount} active / ${nextProjectCount} next / ${totalBlocks} blocks will be converted into action.`}
          </span>
        </div>
        <button type="button" onClick={() => onPlanWithAiSecretary(portfolioPrompt)}>
          <Sparkles size={16} />
          {isJa ? '全体をAI秘書に渡す' : 'Plan all with AI Secretary'}
        </button>
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
              <button
                className="projectSecretaryButton"
                type="button"
                onClick={() => onPlanWithAiSecretary(projectPrompt(project))}
              >
                <ArrowRight size={14} />
                {isJa ? 'AI秘書へ' : 'Ask AI'}
              </button>
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
