import React from "react";
import SvgIcon from "@mui/material/SvgIcon";
import { Box } from "@mui/material";
import { DotsStyleLoading } from "./LoadingSkeleton";

export const ListLoader = () => {
  return (
    <Box sx={{ display: "flex", justifyContent: "center", padding: 1 }}>
      <SvgIcon color="primary" viewBox="0 0 120 30">
        <DotsStyleLoading />
      </SvgIcon>
    </Box>
  );
};
