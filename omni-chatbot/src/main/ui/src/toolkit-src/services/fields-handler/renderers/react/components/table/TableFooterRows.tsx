import React from "react";
import { CancelTokenSource } from "axios";
import TableRow from "@mui/material/TableRow";
// import { lighten } from "@mui/material/styles";
import { HeaderRow } from "../../../../state-managers/fields/table/HeaderRow";
import { TableHeaderCellRenderer } from "./TableHeaderCellRenderer";
import {
  ActionTableCell,
  TableHeaderCellStyled,
} from "./TableHeaderCellStyled";
import { EntitySearchResultProps } from "../../../../../../api/types";
import { EntitySearchDto } from "../../entity/EntitySearchDto";
import {TableFooter} from "@mui/material";

interface Props {
  footers: HeaderRow[];
  readOnly: boolean;
  allowDelete: boolean;
  getEntities?(data: { payload: EntitySearchDto; timeout?: number }): {
    cancelToken: CancelTokenSource;
    axiosPromise: Promise<EntitySearchResultProps>;
  };
}

export const TableFooterRows = ({
  footers,
  readOnly,
  allowDelete,
  getEntities,
}: Props) => {
  return (
    <TableFooter
      component="tfoot"
      // sx={(theme) => ({
      //   backgroundColor: lighten(theme.palette.divider, 0.6),
      // })}
    >
      {footers.map((footer, footerRowIndex) => {
        const footerRowsMatrix = footer.getCellMatrix();

        return (
          <React.Fragment key={footerRowIndex}>
            {footerRowsMatrix.map((headerRow, rowIndex) => (
              <TableRow key={rowIndex} component="tr">
                {!readOnly && allowDelete ? <ActionTableCell /> : null}
                {headerRow.map((headerCell, columnIndex) => (
                  <TableHeaderCellStyled
                    key={columnIndex}
                    colSpan={headerCell ? headerCell.colSpan : 1}
                    colMultiplier={
                      headerCell && headerCell.field
                        ? headerCell.colMultiplier
                        : 0
                    }
                    isLabelRow={false}
                    readOnly={readOnly}
                  >
                    <TableHeaderCellRenderer
                      asLabel={footer.displayAsLabel}
                      cell={headerCell}
                      getEntities={getEntities}
                    />
                  </TableHeaderCellStyled>
                ))}
              </TableRow>
            ))}
          </React.Fragment>
        );
      })}
    </TableFooter>
  );
};
