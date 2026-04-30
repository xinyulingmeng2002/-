import type { WorkMemoryRecord } from "../../api/client";

type WorkMemoryPanelProps = {
  workMemory: WorkMemoryRecord | null;
};

function WorkMemoryList(props: { title: string; items: string[] }) {
  return (
    <div className="knowledge-card">
      <div className="knowledge-card__header">
        <div>
          <strong>{props.title}</strong>
          {props.items.length === 0 ? (
            <p>暂无条目。</p>
          ) : (
            <p>{props.items.join(" / ")}</p>
          )}
        </div>
      </div>
    </div>
  );
}

export function WorkMemoryPanel({ workMemory }: WorkMemoryPanelProps) {
  return (
    <section className="agent-section">
      <div className="agent-section__header">
        <h3>当前工作记忆</h3>
        <p>这里只展示房间级 L0 热上下文，不展示任何 Agent 私有记忆原文。</p>
      </div>

      {workMemory ? (
        <div className="knowledge-list">
          <WorkMemoryList title="待办" items={workMemory.todoItems} />
          <WorkMemoryList title="阻塞" items={workMemory.blockerItems} />
          <WorkMemoryList title="决策" items={workMemory.decisionItems} />
        </div>
      ) : (
        <p className="empty-state">当前房间还没有工作记忆快照。</p>
      )}
    </section>
  );
}
