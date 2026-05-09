import type { PrivateMemoryOverview } from "../../api/client";

type PrivateMemoryOverviewPanelProps = {
  items: PrivateMemoryOverview[];
  resolveDisplayName: (agentId: string) => string;
  onShareCandidate: (input: {
    memoryId: string;
    agentId: string;
    candidateType: "summary" | "todo" | "blocker" | "decision";
  }) => Promise<void>;
};

export function PrivateMemoryOverviewPanel({
  items,
  resolveDisplayName,
  onShareCandidate
}: PrivateMemoryOverviewPanelProps) {
  function renderShareMeta(item: PrivateMemoryOverview) {
    if (item.pendingShareCandidate) {
      return (
        <>
          <p>提交于 {item.pendingShareCandidate.submittedAt}</p>
          <p>
            <a href={`#candidate-${item.pendingShareCandidate.candidateId}`}>
              查看候选 {item.pendingShareCandidate.candidateId}
            </a>
          </p>
        </>
      );
    }

    if (item.latestShareOutcome?.reviewedAt) {
      return <p>审核于 {item.latestShareOutcome.reviewedAt}</p>;
    }

    return null;
  }

  function renderShareStatus(item: PrivateMemoryOverview) {
    if (item.pendingShareCandidate) {
      return <span className="status-pill status-pill--on">已提交待审核</span>;
    }

    if (item.latestShareOutcome?.status === "accepted") {
      return <span className="status-pill status-pill--on">已接受进入共享层</span>;
    }

    if (item.latestShareOutcome?.status === "rejected") {
      return <span className="status-pill">已拒绝，等待重新判断</span>;
    }

    return null;
  }

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
                {renderShareMeta(item)}
              </div>
              {renderShareStatus(item)}
              {!item.pendingShareCandidate && item.suggestedShareCandidate ? (
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() =>
                    void onShareCandidate({
                      memoryId: item.suggestedShareCandidate?.memoryId ?? "",
                      agentId: item.agentId,
                      candidateType: item.suggestedShareCandidate?.candidateType ?? "decision"
                    })
                  }
                >
                  提交为共享候选
                </button>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
