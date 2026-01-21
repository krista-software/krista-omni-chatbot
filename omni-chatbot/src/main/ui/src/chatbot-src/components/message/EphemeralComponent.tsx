import { useEffect, useRef, useState } from "react";
import CircularProgress from "@mui/material/CircularProgress";
import { Box } from "@mui/material";
import LockIcon from "@mui/icons-material/Lock";
import Tooltip from "@mui/material/Tooltip";
import { KSDKMessage, MessageType, datePlus } from "../../../toolkit-src";

export function EphemeralComponent({
  message,
  freezeInput,
  ephemeralTime,
}: {
  message: KSDKMessage;
  ephemeralTime: { start: number; end: number };
  freezeInput: (bool: boolean) => void;
}) {
  const expiryTimer = useRef<any>();
  const [timeElapsedPercent, setTimeElapsedPercent] = useState<number>(0);

  useEffect(() => {
    if (message.messageType === MessageType.Ask && message.timer) {
      const startTime = message.timer.startTime;
      const endTime = message.timer.endTime;
      const timePassed = calcTimeElapsedPercent(startTime, endTime);
      setTimeElapsedPercent(timePassed);
      if (timePassed >= 100) {
        if (message.form) {
          message.form.readOnly = true;
        }
        freezeInput(true);
      } else {
        startTimer(startTime, endTime);
      }
    }
    return () => {
      stopTimer();
    };
  }, []);

  const startTimer = (startTime: number, endTime: number) => {
    stopTimer();
    // How often the timer needs to be refreshed is calculated based on total time left
    const optimalInterval = calcOptimalInterval(startTime, endTime, 1000);
    expiryTimer.current = setTimeout(() => {
      const newCalcTime = calcTimeElapsedPercent(startTime, endTime);
      setTimeElapsedPercent(newCalcTime);
      if (newCalcTime >= 100) {
        if (message.form) {
          message.form.readOnly = true;
        }
        freezeInput(true);
        stopTimer();
      } else {
        startTimer(startTime, endTime);
      }
    }, optimalInterval);
  };

  const stopTimer = () => {
    if (expiryTimer.current) {
      clearInterval(expiryTimer.current);
      expiryTimer.current = null;
    }
  };

  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minWidth: "36px",
        minHeight: "36px",
        position: "relative",
      }}
    >
      <Box
        sx={{
          position: "absolute",
          width: 32,
          height: 32,
          borderRadius: "50%",
          border: (theme) => `1px solid ${theme.palette.divider}`,
        }}
      />
      <CircularProgress
        sx={{ color: "error.main" }}
        size={32}
        variant="determinate"
        value={timeElapsedPercent}
      />
      <Tooltip
        disableInteractive
        title={datePlus.fullDateTime(ephemeralTime.end)}
        arrow
        placement="top"
      >
        <Box
          sx={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: 0,
            right: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <LockIcon sx={{ color: "error.main", fontSize: "1rem" }} />
        </Box>
      </Tooltip>
    </Box>
  );
}

function calcOptimalInterval(
  startTime: number,
  endTime: number,
  min?: number
): number {
  if (startTime > endTime) {
    return min !== undefined ? min : 1000;
  }
  const interval = Math.ceil(Math.abs(endTime - startTime) / 200);
  return min !== undefined && min > interval ? min : interval;
}

function calcTimeElapsedPercent(startTime: number, endTime: number): number {
  const currentTime = new Date().valueOf();
  if (currentTime >= endTime) {
    return 100;
  }
  const diffInMilliSeconds = endTime - startTime;
  const timePassed = currentTime - startTime;

  return (timePassed / diffInMilliSeconds) * 100;
}
