import { useEffect, useState } from "react";

import type { MemoryCandidateRecord } from "../../api/client";

type CandidateReviewPanelProps = {
  candidates: MemoryCandidateRecord[];
  onAcceptCandidate: (candidateId: string) => Promise<void>;
  onRejectCandidate: (candidateId: string) => Promise<void>;
};

export function CandidateReviewPanel({
  candidates,
  onAcceptCandidate,
  onRejectCandidate
}: CandidateReviewPanelProps) {
  const [busyCandidateId, setBusyCandidateId] = useState<string | null>(null);
  const [targetCandidateId, setTargetCandidateId] = useState(() => getTargetCandidateId());

  useEffect(() => {
    function handleHashChange() {
      setTargetCandidateId(getTargetCandidateId());
    }

    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  async function handleAccept(candidateId: string) {
    setBusyCandidateId(candidateId);
    try {
      await onAcceptCandidate(candidateId);
    } finally {
      setBusyCandidateId(null);
    }
  }

  async function handleReject(candidateId: string) {
    setBusyCandidateId(candidateId);
    try {
      await onRejectCandidate(candidateId);
    } finally {
      setBusyCandidateId(null);
    }
  }

  return (
    <section className="agent-section">
      <div className="agent-section__header">
        <h3>候选审核</h3>
        <p>Observer 和 Agent 提交的共享候选会先停在这里，等待人工接受或拒绝。</p>
      </div>

      <div className="candidate-list">
        {candidates.length === 0 ? <p className="empty-state">当前房间暂无待审核候选。</p> : null}
        {candidates.map((candidate) => {
          const isTargeted = targetCandidateId === candidate.candidateId;

          return (
          <article
            key={candidate.candidateId}
            id={`candidate-${candidate.candidateId}`}
            className={isTargeted ? "candidate-card candidate-card--target" : "candidate-card"}
            aria-current={isTargeted ? "true" : undefined}
          >
            <div className="candidate-card__header">
              <div>
                <strong>{candidate.title}</strong>
                <p>{candidate.body}</p>
              </div>
              <div className="candidate-card__meta">
                <span className="status-pill status-pill--on">{candidate.candidateType}</span>
                <span>{candidate.proposedBy}</span>
              </div>
            </div>
            <div className="candidate-card__actions">
              <button
                type="button"
                className="primary-button"
                disabled={busyCandidateId === candidate.candidateId}
                onClick={() => void handleAccept(candidate.candidateId)}
              >
                接受
              </button>
              <button
                type="button"
                className="secondary-button"
                disabled={busyCandidateId === candidate.candidateId}
                onClick={() => void handleReject(candidate.candidateId)}
              >
                拒绝
              </button>
            </div>
          </article>
          );
        })}
      </div>
    </section>
  );
}

function getTargetCandidateId(): string | null {
  const hash = window.location.hash;
  return hash.startsWith("#candidate-") ? hash.slice("#candidate-".length) : null;
}
