import React from "react";
import { Box } from "@mui/material";
import { tableCellMaxHeight, tableCellMinHeight } from "../../../constants";

export const TableCellStyled = (props: React.PropsWithChildren<any>) => {
  return (
    <Box
      component="td"
      sx={{ borderStyle: "solid", borderColor: "divider", borderWidth: "1px" }}
    >
      <Box
        sx={{
          padding: "2px 8px",
          minHeight: tableCellMinHeight,
          maxHeight: tableCellMaxHeight,
          display: "flex",
          flexDirection: "column",
          wordBreak: "break-word",
          overflow: "auto",
        }}
      >
        {props.children}
      </Box>
    </Box>
  );
};
