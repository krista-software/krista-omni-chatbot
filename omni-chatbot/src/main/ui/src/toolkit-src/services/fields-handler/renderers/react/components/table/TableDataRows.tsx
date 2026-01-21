import React from "react";
import { CancelTokenSource } from "axios";
import TableRow from "@mui/material/TableRow";
import Checkbox from "@mui/material/Checkbox";
import { DataRow } from "../../../../state-managers/fields/table/DataRow";
import { TableDataCellRenderer } from "./TableDataCellRenderer";
import { TableCellStyled } from "./TableCellStyled";
import { ActionTableCell } from "./TableHeaderCellStyled";
import { EntitySearchResultProps } from "../../../../../../api/types";
import { EntitySearchDto } from "../../entity/EntitySearchDto";

interface Props {
  readOnly: boolean;
  allowAdd: boolean;
  allowDelete: boolean;
  showDeletedRows: boolean;
  toggleRowSelection: (row: DataRow) => void;
  rows: DataRow[];
  selectedRows: Set<string>;
  getEntities?(data: { payload: EntitySearchDto; timeout?: number }): {
    cancelToken: CancelTokenSource;
    axiosPromise: Promise<EntitySearchResultProps>;
  };
}

export const TableDataRows = ({
  readOnly,
  toggleRowSelection,
  allowDelete,
  showDeletedRows,
  rows,
  selectedRows,
  getEntities,
}: Props) => {
  return (
    <React.Fragment>
      {rows.map((dataRow) => {
        const dataRowMatrix = dataRow.getCellMatrix();
        return (
          <React.Fragment key={dataRow.rowId}>
            {dataRowMatrix.map((bodyRow, rowIndex) => (
              <TableRow component="tr" key={dataRow.rowId + rowIndex}>
                {rowIndex === 0 && !readOnly && allowDelete ? (
                  <ActionTableCell>
                    {allowDelete ? (
                      <Checkbox
                        sx={{ p: 0.5 }}
                        size="small"
                        checked={selectedRows.has(dataRow.rowId)}
                        onChange={() => {
                          toggleRowSelection(dataRow);
                        }}
                      />
                    ) : null}
                  </ActionTableCell>
                ) : null}
                {bodyRow.map((bodyCell, columnIndex) => (
                  <TableCellStyled key={columnIndex}>
                    <TableDataCellRenderer
                      cell={bodyCell}
                      readOnly={showDeletedRows || readOnly}
                      getEntities={getEntities}
                    />
                  </TableCellStyled>
                ))}
              </TableRow>
            ))}
          </React.Fragment>
        );
      })}
    </React.Fragment>
  );
};
