import { useNavigate } from 'react-router-dom';
import './UpgradePrompt.css';

export function UpgradePrompt({ freeLimit }) {
  const nav = useNavigate();
  return (
    <div className="up-overlay" role="dialog" aria-modal="true" aria-label="Upgrade to continue">
      <div className="up-card">
        <div className="up-icon" aria-hidden="true">🎲</div>
        <h2 className="up-title">You've used all {freeLimit} free spins</h2>
        <p className="up-body">
          Subscribe to get unlimited access to the Drug Randomizer and all study tools.
        </p>
        <button className="up-cta" onClick={() => nav('/app/plans')}>
          View Plans
        </button>
        <p className="up-note">Students with an active subscription get unlimited spins.</p>
      </div>
    </div>
  );
}
