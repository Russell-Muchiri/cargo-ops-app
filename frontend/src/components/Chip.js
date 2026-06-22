import React from "react";

export const Chip = ({ color, large = false, testId }) => (
  <span
    data-testid={testId || `chip-${color}`}
    aria-label={`${color} marker`}
    className={`chip chip-${color} ${large ? "chip-lg" : ""}`}
  />
);

export default Chip;
