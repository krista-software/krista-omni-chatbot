import React from "react";
import { CancelTokenSource } from "axios";
import { Box } from "@mui/material";
import { FieldsHandlerService } from "../../../../FieldsHandlerService";
import { DataCell } from "../../../../state-managers/fields/table/DataCell";
import { OpenInModalComponent } from "../../components/OpenInModalComponent";
import { FieldErrorMessage } from "../../components/FieldErrorMessage";
import { EntitySearchResultProps } from "../../../../../../api/types";
import { EntitySearchDto } from "../../entity/EntitySearchDto";

export const TableDataCellRenderer = ({
  cell,
  readOnly,
  getEntities,
}: {
  cell: DataCell;
  readOnly: boolean;
  getEntities?(data: { payload: EntitySearchDto; timeout?: number }): {
    cancelToken: CancelTokenSource;
    axiosPromise: Promise<EntitySearchResultProps>;
  };
}) => {
  let jsx = null;
  if (!cell.field) {
    jsx = null;
  } else if (cell.field.isTabular()) {
    const error = !cell.field.isValid ? cell.field.getErrors()[0] : "";
    jsx = (
      <>
        <FieldErrorMessage error={error} />
        <OpenInModalComponent
          state={cell.field}
          options={{ readOnly, getEntities }}
        />
      </>
    );
  } else {
    const FormFieldRenderer = FieldsHandlerService.getFieldRenderer(
      cell.field,
      "react"
    );
    jsx = FormFieldRenderer ? (
      <FormFieldRenderer
        kristaTypeField={cell.field}
        options={{ readOnly, getEntities }}
      />
    ) : null;
  }

  return (
    <Box
      sx={{
        my: "auto",
        width: "100%",
      }}
    >
      {jsx}
    </Box>
  );
};
