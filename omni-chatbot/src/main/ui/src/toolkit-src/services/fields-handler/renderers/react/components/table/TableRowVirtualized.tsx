import React from "react";
import TableRow from "@mui/material/TableRow";
import IconButton from "@mui/material/IconButton";
import DeleteIcon from "@mui/icons-material/Delete";
import { FixedSizeList } from "react-window";
import { DataRow } from "../../../../state-managers/fields/table/DataRow";
import { TableDataCellRenderer } from "./TableDataCellRenderer";
import { TableCellStyled } from "./TableCellStyled";
import { ActionTableCell } from "./TableHeaderCellStyled";
import { tableCellMinHeight } from "../../../constants";

interface Props {
  width: number;
  height: number;
  readOnly: boolean;
  allowAdd: boolean;
  allowDelete: boolean;
  showDeletedRows: boolean;
  deleteRow: (row: DataRow) => void;
  rows: DataRow[];
}

const itemKey = (index: number, data: DataRow[]) => data[index].rowId;

export const TableRowVirtualized = ({
  width,
  height,
  readOnly,
  allowAdd,
  allowDelete,
  showDeletedRows,
  deleteRow,
  rows,
}: Props) => {
  return (
    <>
      <FixedSizeList
        height={Math.min(height, 200)}
        width={width}
        itemCount={rows.length}
        itemSize={tableCellMinHeight}
        itemKey={itemKey}
        itemData={rows}
      >
        {({
          index,
          style,
          data,
        }: {
          index: number;
          style: any;
          data: DataRow[];
        }) => {
          const dataRow = data[index];
          const dataRowMatrix = dataRow.getCellMatrix();
          return (
            <React.Fragment key={dataRow.rowId}>
              {dataRowMatrix.map((bodyRow, rowIndex) => (
                <TableRow
                  style={style}
                  component="div"
                  key={dataRow.rowId + rowIndex}
                  sx={{ display: "flex" }}
                >
                  {rowIndex === 0 && !readOnly && (allowAdd || allowDelete) ? (
                    <ActionTableCell>
                      {allowDelete ? (
                        <IconButton
                          aria-label="delete row"
                          onClick={() => {
                            deleteRow(dataRow);
                          }}
                          sx={{ p: 1 }}
                          size="small"
                        >
                          <DeleteIcon fontSize="inherit" />
                        </IconButton>
                      ) : null}
                    </ActionTableCell>
                  ) : null}
                  {bodyRow.map((bodyCell, columnIndex) => (
                    <TableCellStyled key={columnIndex}>
                      <TableDataCellRenderer
                        cell={bodyCell}
                        readOnly={showDeletedRows || readOnly}
                      />
                    </TableCellStyled>
                  ))}
                </TableRow>
              ))}
            </React.Fragment>
          );
        }}
      </FixedSizeList>
    </>
  );
};
