import React from "react";
import { styled, keyframes } from "@mui/material/styles";

// Define the blinking animation using MUI's keyframes
const blinkAnimation = keyframes`
  50% {
    opacity: 0;
  }
`;

// Interface for component props
interface BlinkingDotProps {
  size?: number;
  color?: string;
  duration?: string;
  marginLeft?: number;
  className?: string;
}

// Styled component using MUI's styled function
const StyledBlinkingDot = styled("span")<BlinkingDotProps>(({
  size = 8,
  color = "black",
  duration = "1s",
  marginLeft = 4
}) => ({
  display: "inline-block",
  marginLeft: `${marginLeft}px`,
  width: `${size}px`,
  height: `${size}px`,
  backgroundColor: color,
  borderRadius: "50%",
  animation: `${blinkAnimation} ${duration} step-start infinite`,
  verticalAlign: "middle",
}));

// React component
export const BlinkingDot: React.FC<BlinkingDotProps> = ({
  size = 8,
  color = "black",
  duration = "1s",
  marginLeft = 4,
  className,
  ...props
}) => {
  return (
    <StyledBlinkingDot
      size={size}
      color={color}
      duration={duration}
      marginLeft={marginLeft}
      className={className}
      {...props}
    />
  );
};

export default BlinkingDot;
