import type { SharedKnowledgeRecord } from "../../api/client";

type SharedKnowledgePanelProps = {
  items: SharedKnowledgeRecord[];
};

export function SharedKnowledgePanel({ items }: SharedKnowledgePanelProps) {
  return (
    <section className="agent-section">
      <div className="agent-section__header">
        <h3>共享知识</h3>
        <p>这里只展示已经被接受并进入共享层的房间沉淀，不暴露任何 Agent 私有记忆原文。</p>
      </div>

      <div className="knowledge-list">
        {items.length === 0 ? <p className="empty-state">当前房间还没有共享知识条目。</p> : null}
        {items.map((item) => (
          <article key={item.knowledgeId} className="knowledge-card">
            <div className="knowledge-card__header">
              <div>
                <strong>{item.title}</strong>
                <p>{item.body}</p>
              </div>
              <div className="knowledge-card__meta">
                <span className="status-pill status-pill--on">{item.kind}</span>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
