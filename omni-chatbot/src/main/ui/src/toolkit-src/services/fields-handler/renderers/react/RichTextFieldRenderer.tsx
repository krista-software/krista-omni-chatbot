import React, {useEffect, useMemo, useRef, useState} from "react";
import {Box, Button, FormControl, Stack, Typography} from "@mui/material";
import {styled} from "@mui/material/styles";
import {Editor, EditorState, RichUtils} from "draft-js";
import {stateFromHTML} from "draft-js-import-html";
import {convertToHTML} from "draft-convert";
import {useTranslation} from "react-i18next";
import {ReactFieldRenderer} from "../types";
import {KristaTypeField} from "../../state-managers";
import {KristaFieldAttributes} from "../../state-managers";
import {FieldTypes} from "../../state-managers";
import {Priorities} from "../../Priorities";
import {KristaValue} from "../../state-managers";
import {FormLabel} from "./components/FormLabel";
import {FieldErrorMessage} from "./components/FieldErrorMessage";
import {KristaFieldValueResolver} from "../../web-components";
import {getSanitizedMarkup} from "../../utils";
import {ReadOnlyFieldContent} from "./components/ReadOnlyFieldContent";

import "draft-js/dist/Draft.css";
import {MessageType} from "../../../messaging";

export const RichTextFieldRenderer = (({kristaTypeField, options = {}}) => {
  const [error, setError] = useState<string>(() => {
    if (!kristaTypeField.isValid) {
      return kristaTypeField.getErrors()[0];
    }
    return "";
  });
  const [editorState, setEditorState] = React.useState(() => {
    const initialValue: string = kristaTypeField.getKristaValue().getValue() || "";
    if (initialValue) {
      let html = KristaFieldValueResolver.escapeNestedKristaField(kristaTypeField.getKristaValue().getValue()) || kristaTypeField.formattedValue;
      let sanitizedHtml = getSanitizedMarkup(html);
      sanitizedHtml = sanitizedHtml.replace(/\n/g, "<br/>");
      const contentState = stateFromHTML(sanitizedHtml);
      return EditorState.createWithContent(contentState);
    } else {
      return EditorState.createEmpty();
    }
  });
  const {maxLineCount, tooltip} = useMemo(() => {
    const _maxLineCount: number = kristaTypeField.attributes.get("maxLineCount") || 2;
    return {
      maxLineCount: _maxLineCount,
      tooltip: kristaTypeField.attributes.toolTip,
    };
  }, []);

  const {t} = useTranslation();
  const editorRef = useRef<Editor>(null);

  function toggleBlockType(blockType: any) {
    setEditorState(RichUtils.toggleBlockType(editorState, blockType));
  }

  function toggleInlineStyle(inlineStyle: any) {
    setEditorState(RichUtils.toggleInlineStyle(editorState, inlineStyle));
  }

  function updateState(value: string): void {
    kristaTypeField.setValue(value);
  }

  function extractPTags(editorState: EditorState): string {
    let htmlString = convertToHTML(editorState.getCurrentContent());
    htmlString = htmlString.replaceAll("</p><p>", "\n");
    htmlString = htmlString.replaceAll("<p>", "");
    htmlString = htmlString.replaceAll("</p>", "");
    return htmlString;
  }

  function handleOnChange(newState: EditorState) {
    const htmlString = extractPTags(newState);
    updateState(htmlString);
    setEditorState(newState);
  }

  useEffect(() => {
    kristaTypeField.dispatch = function onValueUpdate(newValue: KristaValue) {
      setError(kristaTypeField.getErrors()[0] || "");
    };

    const timer = setTimeout(() => {
      if (options.autoFocus && editorRef.current) {
        editorRef.current.focus();
      }
    }, 500);

    return () => {
      clearTimeout(timer);
      kristaTypeField.dispatch = null;
    };
  }, [kristaTypeField]);

  if (kristaTypeField.readOnly || options.readOnly) {
    return (
      <ReadOnlyFieldContent
        label={kristaTypeField.displayLabel}
        required={kristaTypeField.required && options.messageType !== MessageType.Inform}
        hideLabel={kristaTypeField.isInsideTable}
        content={
          <Typography
            dangerouslySetInnerHTML={{
              __html: getSanitizedMarkup(
                kristaTypeField.getKristaValue().getValue() || ""
              ),
            }}
          ></Typography>
        }
        title={tooltip}
      />
    );
  }

  return (
    <FormControl fullWidth>
      {!kristaTypeField.isInsideTable && (
        <FormLabel
          required={kristaTypeField.required}
          text={kristaTypeField.displayLabel}
          title={tooltip}
        />
      )}
      {kristaTypeField.isInsideTable ? <FieldErrorMessage error={error}/> : null}
      <Box>
        {!(kristaTypeField.readOnly || options.readOnly) && (
          <Stack direction="row" flexWrap="wrap" sx={{my: 1, gap: "4px"}}>
            <InlineStyleControls
              editorState={editorState}
              onToggle={toggleInlineStyle}
            />
            <BlockStyleControls
              editorState={editorState}
              onToggle={toggleBlockType}
            />
          </Stack>
        )}
        <Box
          sx={{
            borderBottomWidth: kristaTypeField.readOnly || options.readOnly ? 0 : 1,
            borderBottomColor: "divider",
            borderBottomStyle: kristaTypeField.isInsideTable ? "none" : "solid",
            pb: kristaTypeField.readOnly || options.readOnly ? 0 : 0.5,
            transition:
              "border-bottom-color 200ms cubic-bezier(0.4, 0, 0.2, 1) 0ms",
            "&:hover": {
              borderBottomColor: "text.primary",
            },
            ".public-DraftEditor-content": {
              lineHeight: "1.5rem",
              maxHeight: `${maxLineCount * 1.5}rem`,
              overflow: "auto",
            },
          }}
        >
          <Editor
            ref={editorRef}
            readOnly={kristaTypeField.readOnly || options.readOnly}
            editorState={editorState}
            onChange={handleOnChange}
            placeholder={
              !(kristaTypeField.readOnly || options.readOnly)
                ? t("placeholder.enter", {fieldName: kristaTypeField.label})
                : ""
            }
            spellCheck={true}
          />
        </Box>
      </Box>
      {!kristaTypeField.isInsideTable ? <FieldErrorMessage error={error}/> : null}
    </FormControl>
  );
}) as ReactFieldRenderer;

RichTextFieldRenderer.getPriority = (
  field: KristaTypeField<KristaFieldAttributes, KristaValue>
) => {
  switch (field.fieldType) {
    case FieldTypes.RICH_TEXT_FIELD:
      return Priorities.SpecificType;
    default:
      return Priorities.NotSupported;
  }
};

const BLOCK_TYPES_H_TAG = [
  {label: "H1", style: "header-one"},
  {label: "H2", style: "header-two"},
  {label: "H3", style: "header-three"},
  {label: "H4", style: "header-four"},
  {label: "H5", style: "header-five"},
  {label: "H6", style: "header-six"},
];

const BLOCK_TYPES_FORMATE = [
  {label: "UL", style: "unordered-list-item"},
  {label: "OL", style: "ordered-list-item"},
];

const INLINE_STYLES = [
  {label: "B", style: "BOLD"},
  {label: "I", style: "ITALIC"},
  {label: "U", style: "UNDERLINE"},
];

const ControlButtonStyle = styled(Button)(({theme}) => ({
  fontSize: "0.625rem",
  minWidth: "24px",
  padding: "4px 6px",
  boxShadow: "none",
}));

const StyleButton = (props: any) => {
  function onToggle(e: any) {
    e.preventDefault();
    props.onToggle(props.style);
  }

  return (
    <ControlButtonStyle
      sx={{
        ...(props.style === "BOLD" ? {fontWeight: "bold"} : {}),
        ...(props.style === "ITALIC" ? {fontStyle: "italic"} : {}),
        ...(props.style === "UNDERLINE" ? {textDecoration: "underline"} : {}),
      }}
      variant={props.active ? "contained" : "outlined"}
      disableElevation
      size="small"
      onMouseDown={onToggle}
    >
      {props.label}
    </ControlButtonStyle>
  );
};

const BlockStyleControls = (props: any) => {
  const {editorState} = props;
  const selection = editorState.getSelection();
  const blockType = editorState
    .getCurrentContent()
    .getBlockForKey(selection.getStartKey())
    .getType();

  function getStyleButton(type: any) {
    return (
      <StyleButton
        key={type.label}
        active={type.style === blockType}
        label={type.label}
        onToggle={props.onToggle}
        style={type.style}
      />
    );
  }

  return (
    <>
      {BLOCK_TYPES_H_TAG.map((type) => getStyleButton(type))}
      {BLOCK_TYPES_FORMATE.map((type) => getStyleButton(type))}
    </>
  );
};

const InlineStyleControls = (props: any) => {
  const currentStyle = props.editorState.getCurrentInlineStyle();
  return (
    <>
      {INLINE_STYLES.map((type) => (
        <StyleButton
          key={type.label}
          active={currentStyle.has(type.style)}
          label={type.label}
          onToggle={props.onToggle}
          style={type.style}
        />
      ))}
    </>
  );
};
