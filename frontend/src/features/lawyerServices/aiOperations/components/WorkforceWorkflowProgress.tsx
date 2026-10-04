import { AIWorkflowProgress, type WorkflowStage } from "../../../../components/common/AIWorkflowProgress";
export type { WorkflowStage, WorkflowStageState } from "../../../../components/common/AIWorkflowProgress";

export function WorkforceWorkflowProgress({ stages, title, description }: {
  stages: WorkflowStage[]; title: string; description: string;
}) {
  return <AIWorkflowProgress stages={stages} title={title} description={description}
    ariaLabel="Workforce workflow progress" replayConfirmedStages
    completionText={stages.length === 4 && stages.every(stage => stage.state === "COMPLETE") ? "4 system checks completed" : undefined}
    shortLabels={{ demand: "Demand", capacity: "Capacity", coverage: "Coverage", recruitment: "Recruitment", proposal: "AI Draft", review: "Review", career: "Career" }}
    responsibilities={{ system: "Demand, capacity and recruitment analysis", ai: "Hiring proposal generation only", human: "Final review and approval" }} />;
}
