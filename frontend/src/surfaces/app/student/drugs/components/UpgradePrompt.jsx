import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import './UpgradePrompt.css';

export function UpgradePrompt({ freeLimit, onDismiss }) {
  const nav = useNavigate();
  return createPortal(
    <div className="up-overlay" role="dialog" aria-modal="true" aria-label="Upgrade to continue" onClick={onDismiss}>
      <div className="up-card" onClick={e => e.stopPropagation()}>
        <button className="up-close" onClick={onDismiss} aria-label="Close">✕</button>
        <div className="up-icon" aria-hidden="true">🎲</div>
        <h2 className="up-title">You've used all {freeLimit} free spins</h2>
        <p className="up-body">
          Subscribe to get unlimited access to the Drug Randomizer and all study tools.
        </p>
        <button className="up-cta" onClick={() => nav('/app/subscriptions')}>
          View Plans
        </button>
        <p className="up-note">Students with an active subscription get unlimited spins.</p>
      </div>
    </div>,
    document.body
  );
}
