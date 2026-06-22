import React from "react";

export const ProgressBar = ({ value, max, variant = "checkin", testId }) => {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className={`bar ${variant}`} data-testid={testId}>
      <span style={{ width: `${pct}%` }} />
    </div>
  );
};

export default ProgressBar;
