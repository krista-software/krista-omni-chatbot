import React, { useMemo } from "react";
import { Box } from "@mui/material";
import {
  tableCellMinHeight,
  tableCellMinWidth,
  tableCellWidth,
} from "../../../constants";

interface HeaderCellProps {
  colMultiplier: number;
  isLabelRow: boolean;
  readOnly: boolean;
  colSpan: number;
  rowSpan?: number;
}

export const TableHeaderCellStyled = (
  props: React.PropsWithChildren<HeaderCellProps>
) => {
  const widthStyles = useMemo(() => {
    if (props.colMultiplier > 0) {
      if (props.readOnly) {
        return {
          minWidth: tableCellMinWidth,
        };
      } else if (
        (props.isLabelRow && props.colSpan === 1) ||
        !props.isLabelRow
      ) {
        const width = props.colMultiplier * tableCellWidth;
        return {
          width,
          minWidth: width,
          maxWidth: width,
        };
      }
    }
    return {};
  }, [props.colMultiplier, props.colSpan, props.isLabelRow, props.readOnly]);

  return (
    <Box
      component="td"
      colSpan={props.colSpan || 1}
      rowSpan={props.rowSpan || 1}
      sx={{
        borderStyle: "solid",
        borderColor: "divider",
        borderWidth: "1px",
        ...widthStyles,
      }}
    >
      <Box
        sx={{
          padding: "2px 8px",
          minHeight: tableCellMinHeight,
          maxHeight: 3 * tableCellMinHeight,
          display: "flex",
          flexDirection: "column",
          wordBreak: "break-word",
          overflow: "auto",
          alignItems:
            (props.colSpan || 1) > 1 && props.isLabelRow
              ? "center"
              : "flex-start",
        }}
      >
        {props.children}
      </Box>
    </Box>
  );
};

export function ActionTableCell(props: React.PropsWithChildren<any>) {
  return (
    <Box
      component="td"
      sx={{ borderStyle: "solid", borderColor: "divider", borderWidth: "1px" }}
    >
      <Box
        sx={{
          padding: "2px 4px",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        {props.children}
      </Box>
    </Box>
  );
}
