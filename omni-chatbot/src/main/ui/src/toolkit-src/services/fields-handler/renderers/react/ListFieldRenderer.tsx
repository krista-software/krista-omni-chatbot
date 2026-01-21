import React, { useEffect, useMemo, useState } from "react";
import { Typography } from "@mui/material";
import { useTranslation } from "react-i18next";

import { ReactFieldRenderer } from "../types";
import { Priorities } from "../../Priorities";
import { FieldTypes } from "../../state-managers";
import { KristaTypeField } from "../../state-managers";
import { KristaFieldAttributes } from "../../state-managers";
import { KristaValue } from "../../state-managers";
import { ListField } from "../../state-managers";
import { DataRow } from "../../state-managers";
import { FieldErrorMessage } from "./components/FieldErrorMessage";
import { ReadOnlyFieldContent } from "./components/ReadOnlyFieldContent";
import { Table } from "./components/table/Table";
import { MessageType } from "../../../messaging";
import { consoleLog } from "../../../../common/utils";

export const ListFieldRenderer = (({ kristaTypeField, options = {} }) => {
  const fieldState = kristaTypeField as ListField;
  const [rows, setRows] = useState<DataRow[]>([]);
  const { t } = useTranslation();
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string>(() => {
    if (!kristaTypeField.isValid) {
      return kristaTypeField.getErrors()[0];
    }
    return "";
  });
  const forceUpdate = useState(Date.now())[1];
  const { allowAdd, allowDelete, headers, tooltip } = useMemo(() => {
    const _allowAdd = !(fieldState.readOnly || options.readOnly);
    const _allowDelete = !(fieldState.readOnly || options.readOnly);
    const _headers = fieldState.getHeaders();
    // const lastHeaderRow = _headers[_headers.length - 1];
    // const headerRowMatrix = lastHeaderRow.getCellMatrix();
    // let _tableWidth =
    //   headerRowMatrix[0].reduce(
    //     (multiplier, item) => multiplier + (item && item.field ? item.colMultiplier : 0),
    //     0
    //   ) * tableCellWidth;
    // if (!fieldState.readOnly) {
    //   _tableWidth += tableActionCellWidth;
    // }

    return {
      allowAdd: _allowAdd,
      allowDelete: _allowDelete,
      headers: _headers,
      tooltip: kristaTypeField.attributes.toolTip,
    };
  }, []);

  function toggleRowSelection(row: DataRow) {
    if (selectedRows.has(row.rowId)) {
      selectedRows.delete(row.rowId);
    } else {
      selectedRows.add(row.rowId);
    }
    setSelectedRows(new Set(selectedRows));
  }

  function appendRow() {
    consoleLog("24 AddRow start");
    fieldState.addRow();
    consoleLog("24 AddRow end");
    setRows(fieldState.getDataRows());
  }

  function deleteRows() {
    if (selectedRows.size > 0) {
      fieldState.deleteRows(Array.from(selectedRows));
      setRows(fieldState.getDataRows());
      setSelectedRows(new Set());
    }
  }

  useEffect(() => {
    if (!fieldState.initDone) {
      consoleLog(
        "AA: ListRenderer: setValue: start",
        fieldState.getKristaValue().getValue()
      );
      fieldState.setValue(fieldState.getKristaValue().getValue());
      consoleLog("AA: ListRenderer: setValue: done");
    }
    setRows(fieldState.getDataRows());
  }, [fieldState]);

  useEffect(() => {
    kristaTypeField.dispatch = function onValueUpdate(
      newValue: KristaValue,
      onSubmit?: boolean
    ) {
      setError(kristaTypeField.getErrors()[0] || "");
      // forceUpdate is needed for validation errors to update
      if (onSubmit) {
        forceUpdate(Date.now());
      }
    };
    return () => {
      kristaTypeField.dispatch = null;
    };
  }, [kristaTypeField, forceUpdate]);

  if (
    (kristaTypeField.readOnly || options.readOnly) &&
    fieldState.initDone &&
    rows.length === 0
  ) {
    return (
      <ReadOnlyFieldContent
        label={kristaTypeField.displayLabel}
        required={kristaTypeField.required && options.messageType !== MessageType.Inform}
        hideLabel={kristaTypeField.isInsideTable}
        content={
          <Typography
            sx={{
              fontStyle: "italic",
              fontSize: "0.8125rem",
              color: "text.secondary",
            }}
          >
            {t("krista.table.noData")}
          </Typography>
        }
        title={tooltip}
      />
    );
  }

  return (
    <React.Fragment>
      <Table
        required={kristaTypeField.required}
        messageType={options.messageType}
        label={kristaTypeField.displayLabel}
        title={tooltip}
        readOnly={kristaTypeField.readOnly || !!options.readOnly}
        headers={headers}
        allowAdd={allowAdd}
        allowDelete={allowDelete}
        appendRow={appendRow}
        deleteRows={deleteRows}
        rows={rows}
        selectedRows={selectedRows}
        toggleRowSelection={toggleRowSelection}
        getEntities={options.getEntities}
      />
      <FieldErrorMessage error={error} />
    </React.Fragment>
  );
}) as ReactFieldRenderer;

ListFieldRenderer.getPriority = (
  field: KristaTypeField<KristaFieldAttributes, KristaValue>
) => {
  switch (field.fieldType) {
    case FieldTypes.LIST_FIELD:
      return Priorities.SpecificType;
    default:
      return Priorities.NotSupported;
  }
};
