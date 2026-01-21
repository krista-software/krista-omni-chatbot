import React from "react";
import { Box } from "@mui/material";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import ArrowLeft from "@mui/icons-material/ArrowLeft";
import ArrowRight from "@mui/icons-material/ArrowRight";

interface Props {
  hasPrevPage: boolean;
  hasNextPage: boolean;
  pageIndex: number;
  onSearch: (pageIndex: number) => void;
}

export const EntitySearchPagination = ({
  hasPrevPage,
  hasNextPage,
  pageIndex,
  onSearch,
}: Props) => {
  return (
    <Box
      sx={{
        display: "inline-flex",
        width: "100%",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <IconButton
        aria-label="Go to previous page"
        color="primary"
        disabled={!hasPrevPage}
        onClick={() => {
          if (hasPrevPage) {
            onSearch(pageIndex - 1);
          }
        }}
        size="small"
      >
        <ArrowLeft />
      </IconButton>
      <Typography
        sx={{
          padding: "2px 8px",
          borderColor: "divider",
          borderWidth: "1px",
          borderStyle: "solid",
          borderRadius: "6px",
        }}
        component="div"
      >
        {pageIndex}
      </Typography>
      <IconButton
        aria-label="Go to next page"
        color="primary"
        disabled={!hasNextPage}
        onClick={() => {
          if (hasNextPage) {
            onSearch(pageIndex + 1);
          }
        }}
        size="small"
      >
        <ArrowRight />
      </IconButton>
    </Box>
  );
};
