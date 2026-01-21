import React from "react";
import { Box } from "@mui/material";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import FirstPageIcon from "@mui/icons-material/FirstPage";
import KeyboardArrowLeft from "@mui/icons-material/KeyboardArrowLeft";
import KeyboardArrowRight from "@mui/icons-material/KeyboardArrowRight";
import LastPageIcon from "@mui/icons-material/LastPage";
import MuiTablePagination from "@mui/material/TablePagination";
import { TablePaginationProps } from "@mui/material";
import { useTranslation } from "react-i18next";

interface TablePaginationActionsProps {
  count: number;
  page: number;
  rowsPerPage: number;
  onPageChange(
    event: React.MouseEvent<HTMLButtonElement> | null,
    page: number
  ): void;
}

function TablePaginationActions(props: TablePaginationActionsProps) {
  const { count, page, rowsPerPage, onPageChange } = props;

  const handleFirstPageButtonClick = (
    event: React.MouseEvent<HTMLButtonElement>
  ) => {
    onPageChange(event, 0);
  };

  const handleBackButtonClick = (
    event: React.MouseEvent<HTMLButtonElement>
  ) => {
    onPageChange(event, page - 1);
  };

  const handleNextButtonClick = (
    event: React.MouseEvent<HTMLButtonElement>
  ) => {
    onPageChange(event, page + 1);
  };

  const handleLastPageButtonClick = (
    event: React.MouseEvent<HTMLButtonElement>
  ) => {
    onPageChange(event, Math.max(0, Math.ceil(count / rowsPerPage) - 1));
  };

  const totalPages = Math.ceil(count / rowsPerPage);
  return (
    <Box sx={{ flexShrink: 0, marginLeft: "auto" }}>
      <IconButton
        onClick={handleFirstPageButtonClick}
        disabled={page === 0}
        aria-label="first page"
      >
        <FirstPageIcon />
      </IconButton>
      <IconButton
        onClick={handleBackButtonClick}
        disabled={page === 0}
        aria-label="previous page"
      >
        <KeyboardArrowLeft />
      </IconButton>
      <Typography sx={{ display: "inline-block", mx: 1 }} variant="body2">
        {page + 1} / {totalPages}
      </Typography>
      <IconButton
        onClick={handleNextButtonClick}
        disabled={page >= totalPages - 1}
        aria-label="next page"
      >
        <KeyboardArrowRight />
      </IconButton>
      <IconButton
        onClick={handleLastPageButtonClick}
        disabled={page >= totalPages - 1}
        aria-label="last page"
      >
        <LastPageIcon />
      </IconButton>
    </Box>
  );
}

export const TablePagination = (props: TablePaginationProps) => {
  const { t } = useTranslation();
  return (
    <MuiTablePagination
      sx={{
        ".MuiToolbar-root": {
          paddingLeft: "0px !important",
        },
        ".MuiTablePagination-spacer": {
          flex: 0,
        },
        ".MuiTablePagination-displayedRows": {
          mr: 2,
        },
        ".MuiTablePagination-selectLabel + .MuiInputBase-formControl": {
          mr: 2,
          fontSize: "0.75rem",
        },
        "& p": {
          marginBottom: "12px",
        },
      }}
      rowsPerPageOptions={props.rowsPerPageOptions}
      component="div"
      count={props.count}
      rowsPerPage={props.rowsPerPage}
      page={props.page}
      onPageChange={props.onPageChange}
      onRowsPerPageChange={props.onRowsPerPageChange}
      ActionsComponent={TablePaginationActions}
      labelRowsPerPage={t("krista.table.rowsPerPage")}
    />
  );
};
