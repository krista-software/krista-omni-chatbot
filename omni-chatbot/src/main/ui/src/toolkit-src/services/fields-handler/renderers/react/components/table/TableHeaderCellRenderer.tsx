import React from "react";
import { CancelTokenSource } from "axios";
import { Box } from "@mui/material";
import { FieldsHandlerService } from "../../../../FieldsHandlerService";
import { HeaderCell } from "../../../../state-managers/fields/table/HeaderCell";
import { FormLabel } from "../../components/FormLabel";
import { OpenInModalComponent } from "../../components/OpenInModalComponent";
import { FieldErrorMessage } from "../../components/FieldErrorMessage";
import { EntitySearchResultProps } from "../../../../../../api/types";
import { EntitySearchDto } from "../../entity/EntitySearchDto";

export function TableHeaderCellRenderer({
  asLabel,
  cell,
  getEntities,
}: {
  asLabel: boolean;
  cell: HeaderCell | null;
  getEntities?(data: { payload: EntitySearchDto; timeout?: number }): {
    cancelToken: CancelTokenSource;
    axiosPromise: Promise<EntitySearchResultProps>;
  };
}) {
  let jsx: any = null;
  if (!cell || !cell.field) {
    jsx = null;
  } else if (asLabel) {
    jsx = (
      <FormLabel
        component="div"
        required={false}
        text={cell.getDisplayValue()}
        title={cell.getTitle()}
      />
    );
  } else if (cell.field) {
    if (cell.field.isTabular() || cell.field.isComposite()) {
      const error = !cell.field.isValid ? cell.field.getErrors()[0] : "";
      jsx = (
        <>
          <FieldErrorMessage error={error} />
          <OpenInModalComponent state={cell.field} options={{ getEntities }} />
        </>
      );
    } else {
      const Renderer = FieldsHandlerService.getFieldRenderer(
        cell.field,
        "react"
      );
      jsx = Renderer ? (
        <Renderer kristaTypeField={cell.field} options={{ getEntities }} />
      ) : null;
    }
  }
  return (
    <Box
      sx={{
        my: "auto",
        ...(asLabel ? {} : { width: "100%" }),
      }}
    >
      {jsx}
    </Box>
  );
}
