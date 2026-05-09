import type { PrivateMemoryOverview } from "../../api/client";

type PrivateMemoryOverviewPanelProps = {
  items: PrivateMemoryOverview[];
  resolveDisplayName: (agentId: string) => string;
};

export function PrivateMemoryOverviewPanel({
  items,
  resolveDisplayName
}: PrivateMemoryOverviewPanelProps) {
  return (
    <section className="agent-section">
      <div className="agent-section__header">
        <h3>私有记忆状态</h3>
        <p>这里只展示去敏概览，不暴露任何 Agent 私有记忆原文。</p>
      </div>
      <div className="knowledge-list">
        {items.length === 0 ? <p className="empty-state">当前房间还没有私有记忆状态。</p> : null}
        {items.map((item) => (
          <article key={`${item.agentId}:${item.roomId}`} className="knowledge-card">
            <div className="knowledge-card__header">
              <div>
                <strong>{resolveDisplayName(item.agentId)}</strong>
                <p>
                  {item.totalMemories} 条私有记忆 / {item.shareableMemories} 条可提交候选
                </p>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
