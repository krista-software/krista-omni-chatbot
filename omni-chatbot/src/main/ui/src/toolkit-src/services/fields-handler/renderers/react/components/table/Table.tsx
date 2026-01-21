import React, { useEffect, useState } from "react";
import { CancelTokenSource } from "axios";
import { FormControl } from "@mui/material";
import TableContainer from "@mui/material/TableContainer";
import MuiTable from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import { Box } from "@mui/material";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import AddIcon from "@mui/icons-material/Add";
import SearchIcon from "@mui/icons-material/Search";
import DeleteIcon from "@mui/icons-material/Delete";
import BackIcon from "@mui/icons-material/ArrowBackIosNew";
import RestoreIcon from "@mui/icons-material/Restore";
import { useTranslation } from "react-i18next";
import { FormLabel } from "../FormLabel";
import { TableHeaderRows } from "./TableHeaderRows";
import { TableDataRows } from "./TableDataRows";
import { TableFooterRows } from "./TableFooterRows";
import { TablePagination } from "./TablePagination";
import { DataRow } from "../../../../state-managers/fields/table/DataRow";
import { HeaderRow } from "../../../../state-managers/fields/table/HeaderRow";
import { tableActionCellWidth } from "../../../constants";
import { EntitySearchResultProps } from "../../../../../../api/types";
import { EntitySearchDto } from "../../entity/EntitySearchDto";
import { MessageType } from "../../../../../messaging/message/KSDKMessage";

interface TableProps {
  required: boolean;
  label: string;
  title?: string;
  readOnly: boolean;
  headers: HeaderRow[];
  allowAdd: boolean;
  allowDelete: boolean;
  appendRow(): void;
  deleteRows(): void;
  rows: DataRow[];
  selectedRows: Set<string>;
  messageType?: MessageType;
  resetSelectedRows?(): void;
  toggleRowSelection(row: DataRow): void;
  footers?: HeaderRow[];
  allowEntitySearch?: boolean;
  openSearchModal?(): void;
  deletedRows?: DataRow[];
  restoreDeletedRows?(): void;
  getEntities?(data: { payload: EntitySearchDto; timeout?: number }): {
    cancelToken: CancelTokenSource;
    axiosPromise: Promise<EntitySearchResultProps>;
  };
}

const TableActionsContainer = (props: React.PropsWithChildren<any>) => (
  <Box
    sx={{
      display: "inline-flex",
      borderStyle: "solid",
      borderWidth: "1px 1px 0 1px",
      borderColor: "divider",
      borderRadius: "4px 4px 0 0",
      alignItems: "center",
    }}
  >
    {props.children}
  </Box>
);

export const Table = (props: TableProps) => {
  const {
    required,
    messageType,
    label,
    title,
    readOnly,
    headers,
    footers,
    allowAdd,
    allowDelete,
    appendRow,
    deleteRows,
    rows,
    selectedRows,
    resetSelectedRows,
    toggleRowSelection,
    openSearchModal,
    allowEntitySearch,
    deletedRows,
    restoreDeletedRows,
    getEntities,
  } = props;
  const [rowsPerPage, setRowsPerPage] = useState<number>(25);
  const [page, setPage] = useState<number>(0);
  const [visibleRows, setVisibleRows] = useState<DataRow[]>([]);
  const [showDeletedRows, setShowDeletedRows] = useState(false);
  const [visibleHeaders, setVisibleHeaders] = useState(headers);
  const { t } = useTranslation();

  const handleChangePage = (
    event: React.MouseEvent<HTMLButtonElement> | null,
    newPage: number
  ) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (
    event: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>
  ) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  useEffect(() => {
    let _currentPage = page;
    if (showDeletedRows) {
      if (deletedRows && deletedRows.length > 0) {
        const totalPages = Math.ceil(deletedRows.length / rowsPerPage);
        if (totalPages <= _currentPage) {
          _currentPage = totalPages - 1;
        }
        setVisibleRows(
          deletedRows.slice(
            _currentPage * rowsPerPage,
            _currentPage * rowsPerPage + rowsPerPage
          )
        );
      } else {
        if (resetSelectedRows) {
          resetSelectedRows();
        }
        setVisibleRows([]);
        _currentPage = 0;
        setShowDeletedRows(false);
      }
    } else {
      if (rows.length > 0) {
        const totalPages = Math.ceil(rows.length / rowsPerPage);
        if (totalPages <= _currentPage) {
          _currentPage = totalPages - 1;
        }
        setVisibleRows(
          rows.slice(
            _currentPage * rowsPerPage,
            _currentPage * rowsPerPage + rowsPerPage
          )
        );
      } else {
        _currentPage = 0;
        setVisibleRows([]);
      }
    }
    setPage(_currentPage);
  }, [rows, page, rowsPerPage, deletedRows, showDeletedRows]); // do not add resetSelectedRows in dependencies

  useEffect(() => {
    setVisibleHeaders(
      showDeletedRows ? [headers[headers.length - 1]] : headers
    );
  }, [showDeletedRows, headers]);

  return (
    <FormControl
      component="fieldset"
      sx={{ display: "inline-block", maxWidth: "100%" }}
    >
      <FormLabel
        sx={{ mb: 0.5 }}
        component="legend"
        required={required && messageType !== MessageType.Inform}
        text={label}
        title={title}
      />
      <Box sx={{ overflow: "auto" }}>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            marginLeft:
              readOnly || !allowDelete ? "0px" : `${tableActionCellWidth}px`,
          }}
        >
          <React.Fragment key="cta">
            {!showDeletedRows ? (
              <>
                {(!readOnly &&
                  (allowEntitySearch || allowAdd || allowDelete)) ||
                (deletedRows && deletedRows.length > 0) ? (
                  <TableActionsContainer>
                    {!readOnly && allowEntitySearch && allowAdd ? (
                      <IconButton
                        onClick={() => {
                          if (openSearchModal) {
                            openSearchModal();
                          }
                        }}
                        sx={{ p: 1 }}
                        size="small"
                      >
                        <SearchIcon fontSize="inherit" />
                      </IconButton>
                    ) : null}
                    {!readOnly && allowAdd ? (
                      <IconButton
                        onClick={() => {
                          appendRow();
                        }}
                        sx={{ p: 1 }}
                        size="small"
                      >
                        <AddIcon fontSize="inherit" />
                      </IconButton>
                    ) : null}
                    {!readOnly && allowDelete ? (
                      <IconButton
                        onClick={() => {
                          deleteRows();
                        }}
                        sx={{ p: 1 }}
                        size="small"
                        color="error"
                        disabled={selectedRows.size === 0}
                      >
                        <DeleteIcon fontSize="inherit" />
                      </IconButton>
                    ) : null}
                    {deletedRows && deletedRows.length > 0 ? (
                      <Button
                        type="button"
                        size="small"
                        sx={{ py: 0, m: 0.5 }}
                        variant="outlined"
                        onClick={() => {
                          setPage(0);
                          setShowDeletedRows(!showDeletedRows);
                          if (resetSelectedRows) {
                            resetSelectedRows();
                          }
                        }}
                      >
                        {t("krista.table.deletedRows")}
                      </Button>
                    ) : null}
                  </TableActionsContainer>
                ) : null}
              </>
            ) : (
              <TableActionsContainer>
                <IconButton
                  onClick={() => {
                    setPage(0);
                    setShowDeletedRows(!showDeletedRows);
                    if (resetSelectedRows) {
                      resetSelectedRows();
                    }
                  }}
                  sx={{ p: 1 }}
                  size="small"
                >
                  <BackIcon fontSize="inherit" />
                </IconButton>
                {!readOnly ? (
                  <IconButton
                    onClick={() => {
                      if (restoreDeletedRows) {
                        restoreDeletedRows();
                      }
                    }}
                    sx={{ p: 1 }}
                    size="small"
                    disabled={selectedRows.size === 0}
                  >
                    <RestoreIcon fontSize="inherit" />
                  </IconButton>
                ) : null}
              </TableActionsContainer>
            )}
          </React.Fragment>
          <React.Fragment key="selected-rows">
            {selectedRows.size > 0 ? (
              <Typography sx={{ ml: 2 }}>
                {t("krista.table.selectedRows")} {selectedRows.size}
              </Typography>
            ) : null}
          </React.Fragment>
        </Box>
        <TableContainer sx={{ overflow: "initial" }}>
          <MuiTable
            size="small"
            sx={{
              width: "auto",
              borderStyle: "solid",
              borderColor: "divider",
              borderWidth: "1px",
              tableLayout: "fixed",
              borderCollapse: "collapse",
            }}
            component="table"
          >
            <TableHeaderRows
              headers={visibleHeaders}
              readOnly={readOnly}
              allowDelete={allowDelete}
              getEntities={getEntities}
            />
            {visibleRows.length > 0 && (
              <TableBody component="tbody">
                <TableDataRows
                  readOnly={readOnly}
                  allowAdd={allowAdd}
                  allowDelete={allowDelete}
                  selectedRows={selectedRows}
                  toggleRowSelection={toggleRowSelection}
                  rows={visibleRows}
                  showDeletedRows={showDeletedRows}
                  getEntities={getEntities}
                />
              </TableBody>
            )}
            {footers && !showDeletedRows ? (
              <TableFooterRows
                footers={footers}
                readOnly={readOnly}
                allowDelete={allowDelete}
                getEntities={getEntities}
              />
            ) : null}
          </MuiTable>
        </TableContainer>
      </Box>
      {(showDeletedRows && deletedRows && deletedRows.length > 0) ||
      (!showDeletedRows && rows.length > 0) ? (
        <Box>
          <TablePagination
            rowsPerPageOptions={[10, 15, 20, 25]}
            count={showDeletedRows ? deletedRows?.length || 0 : rows.length}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
          />
        </Box>
      ) : null}
    </FormControl>
  );
};
