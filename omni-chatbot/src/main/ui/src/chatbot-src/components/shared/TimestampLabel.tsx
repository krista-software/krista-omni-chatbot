import React, { useMemo } from "react";
import Tooltip from "@mui/material/Tooltip";
import { Box } from "@mui/material";
import Typography from "@mui/material/Typography";
import { datePlus } from "../../../toolkit-src";

// for the Tooltip to work correct, it's children must be able to take a "ref"
// https://material-ui.com/guides/composition/#caveat-with-refs

// TODO update text on language change
export const TimestampLabel = ({ time }: { time: number }) => {
  const title = useMemo(() => datePlus.fullDateTime(time), [time]);
  const text = useMemo(() => datePlus.calendarTime(time), [time]);
  return (
    <Tooltip disableInteractive title={title} arrow placement="top">
      <Box
        sx={{
          px: 1,
          whiteSpace: "nowrap",
          "&:first-of-type": {
            paddingLeft: 0,
          },
          "&:last-child": {
            paddingRight: 0,
          },
        }}
      >
        <Typography
          sx={{ fontSize: "0.625rem", fontWeight: 400 }}
          variant="caption"
        >
          {text}
        </Typography>
      </Box>
    </Tooltip>
  );
};
