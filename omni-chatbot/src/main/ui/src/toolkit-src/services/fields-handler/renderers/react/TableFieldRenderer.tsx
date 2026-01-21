import React, { useEffect, useMemo, useState } from "react";
import { Typography } from "@mui/material";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import { useTranslation } from "react-i18next";

import { ReactFieldRenderer } from "../types";
import { Priorities } from "../../Priorities";
import { FieldTypes } from "../../state-managers";
import { KristaTypeField } from "../../state-managers";
import { KristaFieldAttributes } from "../../state-managers";
import { KristaValue } from "../../state-managers";
import { TableField } from "../../state-managers";
import { DataRow } from "../../state-managers";
import { FieldErrorMessage } from "./components/FieldErrorMessage";
import { EntitySearchModal } from "./entity/EntitySearchModal";
import { ReadOnlyFieldContent } from "./components/ReadOnlyFieldContent";
import { IEntitySearchResult } from "./entity";
import { Table } from "./components/table/Table";
import { MessageType } from "../../../messaging";
import { consoleLog } from "../../../../common/utils";

export const TableFieldRenderer = (({ kristaTypeField, options = {} }) => {
  const fieldState = kristaTypeField as TableField;
  const [rows, setRows] = useState<DataRow[]>([]);
  const { t } = useTranslation();
  const [deletedRows, setDeletedRows] = useState<DataRow[]>([]);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [showDeleteConfirm, toggleDeleteConfirm] = useState(false);
  const [error, setError] = useState<string>(() => {
    if (!kristaTypeField.isValid) {
      return kristaTypeField.getErrors()[0];
    }
    return "";
  });
  const [entityModalOpen, setEntityModalOpen] = useState(false);
  const {
    allowAdd,
    allowDelete,
    allowSystemDelete,
    headers,
    footers,
    tooltip,
  } = useMemo(() => {
    const _allowAdd = fieldState.attributes.get("allowAdd");
    const _allowDelete = fieldState.attributes.get("allowDelete");
    const _allowSystemDelete = fieldState.attributes.get("allowSystemDelete");
    const _headers = fieldState.getHeaders();
    const _footers = fieldState.getFooters();
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
      allowSystemDelete: _allowSystemDelete,
      headers: _headers,
      footers: _footers,
      tooltip: kristaTypeField.attributes.toolTip,
    };
  }, []);

  function appendRow() {
    consoleLog("17 AddRow start");
    fieldState.addRow();
    consoleLog("17 AddRow end");
    setRows(fieldState.getDataRows());
    setDeletedRows(fieldState.getDeletedRows());
  }

  function openSearchModal() {
    setEntityModalOpen(true);
  }

  function toggleRowSelection(row: DataRow) {
    if (selectedRows.has(row.rowId)) {
      selectedRows.delete(row.rowId);
    } else {
      selectedRows.add(row.rowId);
    }
    setSelectedRows(new Set(selectedRows));
  }

  function deleteRows() {
    if (selectedRows.size > 0) {
      if (allowSystemDelete) {
        toggleDeleteConfirm(true);
      } else {
        reallyDeleteRows();
      }
    }
  }

  function reallyDeleteRows() {
    if (selectedRows.size > 0) {
      consoleLog("23: delete start");
      fieldState.deleteRows(Array.from(selectedRows), allowSystemDelete);
      consoleLog("23: delete end");
      setRows(fieldState.getDataRows());
      setDeletedRows(fieldState.getDeletedRows());
      setSelectedRows(new Set());
    }
  }

  function restoreDeletedRows() {
    if (selectedRows.size > 0) {
      consoleLog("2: restore start");
      fieldState.restoreDeletedRows(Array.from(selectedRows));
      consoleLog("2: restore start");
      setRows(fieldState.getDataRows());
      setDeletedRows(fieldState.getDeletedRows());
      setSelectedRows(new Set());
    }
  }

  const handleEntityModalClose = () => setEntityModalOpen(false);

  function handleEntitySelection(selection?: IEntitySearchResult[]) {
    handleEntityModalClose();
    if (!selection || selection.length === 0) {
      return;
    }
    const rowValues: any[] = [];
    selection.forEach((selectedEntity) => {
      const rowValue: any = {};
      if (fieldState.attributes.getPrimaryKeyId()) {
        rowValue[fieldState.attributes.getPrimaryKeyId()] =
          selectedEntity.value.meta.primaryKey;
      }
      selectedEntity.fields.forEach((fs) => {
        rowValue[fs.fieldId] = fs.toResponse();
      });
      rowValues.push(rowValue);
    });
    fieldState.addRows(rowValues);
    setRows(fieldState.getDataRows());
    setDeletedRows(fieldState.getDeletedRows());
  }

  const forceUpdate = useState(Date.now())[1];

  useEffect(() => {
    if (!fieldState.initDone) {
      consoleLog(
        "ZZ: TableRenderer: setValue: start",
        fieldState.getKristaValue().getValue()
      );
      fieldState.setValue(fieldState.getKristaValue().getValue());
      consoleLog("ZZ: TableRenderer: setValue: done");
    }
    setRows(fieldState.getDataRows());
    setDeletedRows(fieldState.getDeletedRows());
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
      />
    );
  }

  return (
    <React.Fragment>
      {entityModalOpen && fieldState.attributes.tableMeta.entitySelectorMeta ? (
        <EntitySearchModal
          entitySelectorMeta={
            fieldState.attributes.tableMeta.entitySelectorMeta
          }
          onClose={handleEntityModalClose}
          onSelect={(_selection) => handleEntitySelection(_selection)}
          field={fieldState.field}
          getEntities={options.getEntities}
        />
      ) : null}
      {allowSystemDelete ? (
        <Dialog
          open={showDeleteConfirm}
          onClose={() => toggleDeleteConfirm(false)}
        >
          <DialogTitle>{t("krista.general.delete")}</DialogTitle>
          <DialogContent>
            <DialogContentText>
              {t("krista.table.confirmDelete")}
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button
              onClick={() => {
                toggleDeleteConfirm(false);
              }}
            >
              {t("krista.general.cancel")}
            </Button>
            <Button
              onClick={() => {
                reallyDeleteRows();
                toggleDeleteConfirm(false);
              }}
            >
              {t("krista.general.ok")}
            </Button>
          </DialogActions>
        </Dialog>
      ) : null}
      <Table
        required={kristaTypeField.required}
        messageType={options.messageType}
        label={kristaTypeField.displayLabel}
        title={tooltip}
        readOnly={kristaTypeField.readOnly || !!options.readOnly}
        headers={headers}
        footers={footers}
        allowAdd={allowAdd}
        allowDelete={allowDelete}
        appendRow={appendRow}
        deleteRows={deleteRows}
        deletedRows={deletedRows}
        restoreDeletedRows={restoreDeletedRows}
        rows={rows}
        selectedRows={selectedRows}
        resetSelectedRows={() => {
          setSelectedRows(new Set());
        }}
        toggleRowSelection={toggleRowSelection}
        allowEntitySearch={fieldState.entitySelectorMeta?.hasEntity}
        openSearchModal={openSearchModal}
        getEntities={options.getEntities}
      />
      <FieldErrorMessage error={error} />
    </React.Fragment>
  );
}) as ReactFieldRenderer;

TableFieldRenderer.getPriority = (
  field: KristaTypeField<KristaFieldAttributes, KristaValue>
) => {
  switch (field.fieldType) {
    case FieldTypes.TABLE_FIELD:
      return Priorities.SpecificType;
    default:
      return Priorities.NotSupported;
  }
};
