import React from "react";
import { CancelTokenSource } from "axios";
import { Box } from "@mui/material";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
// import { lighten } from "@mui/material/styles";
import { HeaderRow } from "../../../../state-managers/fields/table/HeaderRow";
import { tableActionCellWidth } from "../../../constants";
import { TableHeaderCellStyled } from "./TableHeaderCellStyled";
import { TableHeaderCellRenderer } from "./TableHeaderCellRenderer";
import { EntitySearchDto } from "../../entity/EntitySearchDto";
import { EntitySearchResultProps } from "../../../../../../api/types";

interface Props {
  headers: HeaderRow[];
  readOnly: boolean;
  allowDelete: boolean;
  getEntities?(data: { payload: EntitySearchDto; timeout?: number }): {
    cancelToken: CancelTokenSource;
    axiosPromise: Promise<EntitySearchResultProps>;
  };
}

export const TableHeaderRows = ({
  headers,
  readOnly,
  allowDelete,
  getEntities,
}: Props) => {
  return (
    <TableHead
      component="thead"
      // sx={(theme) => ({
      //   backgroundColor: lighten(theme.palette.divider, 0.6),
      // })}
    >
      {headers.map((header, headerRowIndex) => {
        const headerRowsMatrix = header.getCellMatrix();

        return (
          <React.Fragment key={headerRowIndex}>
            {headerRowsMatrix.map((headerRow, rowIndex) => (
              <TableRow key={rowIndex} component="tr">
                {!readOnly && allowDelete && rowIndex === 0 ? (
                  <Box
                    component="td"
                    rowSpan={headerRowsMatrix.length}
                    sx={{
                      borderStyle: "solid",
                      borderColor: "divider",
                      borderWidth: "1px",
                      padding: "1px 4px",
                      width: `${tableActionCellWidth}px`,
                      minWidth: `${tableActionCellWidth}px`,
                      maxWidth: `${tableActionCellWidth}px`,
                    }}
                  />
                ) : null}
                {headerRow.map((headerCell, columnIndex) => (
                  <React.Fragment key={columnIndex}>
                    {headerCell ? (
                      <TableHeaderCellStyled
                        key={columnIndex}
                        colSpan={headerCell ? headerCell.colSpan : 1}
                        rowSpan={headerCell ? headerCell.rowSpan : 1}
                        isLabelRow={header.displayAsLabel}
                        readOnly={readOnly}
                        colMultiplier={
                          headerCell && headerCell.field
                            ? headerCell.colMultiplier
                            : 0
                        }
                      >
                        <TableHeaderCellRenderer
                          asLabel={header.displayAsLabel}
                          cell={headerCell}
                          getEntities={getEntities}
                        />
                      </TableHeaderCellStyled>
                    ) : null}
                  </React.Fragment>
                ))}
              </TableRow>
            ))}
          </React.Fragment>
        );
      })}
    </TableHead>
  );
};
